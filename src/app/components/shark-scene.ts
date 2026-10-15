import { afterNextRender, Component, DestroyRef, ElementRef, inject, input, isDevMode } from '@angular/core';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';

// 3D-акулы на фоне (страница /test, коллаборация с Attack Shark).
// Модель: «Animated Swimming Great White Shark Loop» — LasquetiSpice, Sketchfab, CC BY 4.0 (подпись — на странице).
// Three.js грузится только здесь (динамический import) — остальной сайт его не тянет.
// Нет файла модели, включено «уменьшение движения» или экономия трафика — сцена не стартует, остаются CSS-слои.

const MODEL_URL = 'models/shark.glb';
/** поворот модели, чтобы голова смотрела по ходу движения (зависит от того, как модель экспортирована) */
const HEAD_YAW = 0;

let model: Promise<GLTF> | null = null;

type Mode = 'hero' | 'partner';

@Component({
  selector: 'app-shark-scene',
  template: `<canvas aria-hidden="true"></canvas>`,
  styles: `
    :host { position: absolute; inset: 0; display: block; pointer-events: none; opacity: 0; transition: opacity 1.2s ease; }
    :host(.ready) { opacity: 1; }
    canvas { display: block; width: 100%; height: 100%; }
  `,
})
export class SharkScene {
  readonly mode = input<Mode>('hero');

  constructor() {
    const host = inject(ElementRef).nativeElement as HTMLElement;
    let stop: (() => void) | null = null;
    let dead = false;
    inject(DestroyRef).onDestroy(() => {
      dead = true;
      stop?.();
    });
    afterNextRender(() => {
      const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches || conn?.saveData) return;
      run(host, this.mode())
        .then((s) => (dead ? s() : ((stop = s), host.classList.add('ready'))))
        .catch(() => {}); // модели нет / WebGL недоступен — остаются CSS-слои страницы
    });
  }
}

async function run(host: HTMLElement, mode: Mode): Promise<() => void> {
  const [THREE, { GLTFLoader }, { clone }, { MeshoptDecoder }] = await Promise.all([
    import('three'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/utils/SkeletonUtils.js'),
    import('three/addons/libs/meshopt_decoder.module.js'),
  ]);
  // модель сжата meshopt (17 МБ → ~0.9 МБ, без упрощения геометрии)
  model ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(MODEL_URL);
  const gltf = await model.catch((e) => {
    model = null;
    throw e;
  });

  const canvas = host.querySelector('canvas')!;
  // фон в тумане — сглаживание и полное разрешение не нужны: рендерим в ~80% и без MSAA (главная экономия FPS)
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1) * 0.8);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  camera.position.set(0, 0, 14);

  // цвета — из темы сайта: туман глубины = фон темы, смешанный с акцентом; свет сверху — подкрашен акцентом
  const fog = new THREE.FogExp2(0x000000, mode === 'hero' ? 0.05 : 0.06);
  scene.fog = fog;
  const sky = new THREE.HemisphereLight(0xffffff, 0x000000, 1.6);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(2, 12, 6);
  scene.add(sky, sun, new THREE.AmbientLight(0xffffff, 0.25));
  const snowMat = new THREE.PointsMaterial({ size: 0.05, transparent: true, opacity: 0.55, depthWrite: false });
  const theme = () => {
    const css = getComputedStyle(document.documentElement);
    const primary = new THREE.Color(css.getPropertyValue('--primary').trim() || '#0abab5');
    const bg = new THREE.Color(css.getPropertyValue('--canvas').trim() || '#000000');
    fog.color.copy(bg).lerp(primary, 0.22);
    sky.color.copy(primary).lerp(new THREE.Color(0xffffff), 0.55);
    sky.groundColor.copy(bg);
    snowMat.color.copy(primary).lerp(new THREE.Color(0xffffff), 0.6);
  };
  theme();
  const themeWatch = new MutationObserver(theme);
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // модель: приводим к длине ~5 единиц и центрируем
  const proto = gltf.scene;
  const box = new THREE.Box3().setFromObject(proto);
  const size = box.getSize(new THREE.Vector3());
  const k = 5 / Math.max(size.x, size.y, size.z);
  const clip = gltf.animations.find((a) => /swim/i.test(a.name)) ?? gltf.animations[0];
  const biteClip = gltf.animations.find((a) => /bite/i.test(a.name));

  interface Shark {
    root: InstanceType<typeof THREE.Group>;
    mixer: InstanceType<typeof THREE.AnimationMixer>;
    t: number; // 0…1 — путь через кадр
    dur: number; // секунд на проход
    dir: 1 | -1;
    z: number;
    y: number;
    wait: number; // пауза до следующего прохода
    close: boolean; // атака: плывёт из глубины прямо на зрителя
    swim?: InstanceType<typeof THREE.AnimationAction>;
    bite?: InstanceType<typeof THREE.AnimationAction>;
    bitten: boolean; // уже «клацнула» в этом проходе
  }
  const make = (z: number, y: number, dur: number, close = false): Shark => {
    // root — смотрит по ходу движения (lookAt), pivot — доворот модели головой вперёд, body — отцентрованная модель
    const body = clone(proto);
    body.scale.setScalar(k);
    body.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-k);
    const pivot = new THREE.Group();
    pivot.rotation.y = HEAD_YAW;
    pivot.add(body);
    const root = new THREE.Group();
    root.add(pivot);
    scene.add(root);
    const mixer = new THREE.AnimationMixer(body);
    const swim = clip ? mixer.clipAction(clip).play() : undefined;
    // у крупной акулы — укус посреди прохода у камеры, потом снова плывёт
    const bite = close && biteClip ? mixer.clipAction(biteClip).setLoop(THREE.LoopOnce, 1) : undefined;
    if (bite && swim) mixer.addEventListener('finished', () => bite.crossFadeTo(swim.reset().play(), 0.25, false));
    return { root, mixer, t: Math.random(), dur, dir: Math.random() < 0.5 ? 1 : -1, z, y, wait: 0, close, swim, bite, bitten: false };
  };
  const sharks: Shark[] =
    mode === 'hero'
      ? [make(-6, 1.2, 10), make(-16, -1.6, 13), make(-40, 0, 6.5, true)] // две «на охоте» + атакующая
      : [make(-3, 0, 30)];
  if (mode === 'hero') {
    // охотницы появляются по одной и редко; атака — впервые через ~22 с, дальше раз в 45–70 с
    const [a, b, atk] = sharks;
    Object.assign(a, { t: 1, wait: 1.5 });
    Object.assign(b, { t: 1, wait: 8 });
    Object.assign(atk, { t: 1, wait: 22 });
  }

  // «морской снег» — медленно оседающие частицы
  const N = mode === 'hero' ? 300 : 160;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 40;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
    pos[i * 3 + 2] = -Math.random() * 30 + 6;
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(snowGeo, snowMat));

  // ширина кадра на глубине z — чтобы акула заплывала из-за края и уплывала за другой
  const halfWidth = (z: number) => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - z) * camera.aspect + 6;

  const resize = () => {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // камера чуть следует за курсором — глубина «оживает»
  const mouse = { x: 0, y: 0 };
  const onMove = (e: PointerEvent) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = (e.clientY / innerHeight) * 2 - 1;
  };
  addEventListener('pointermove', onMove, { passive: true });

  // локальная отладка: можно остановить и расставить акул из консоли
  if (isDevMode()) (window as unknown as Record<string, unknown>)['__sharks_' + mode] = { sharks, camera, scene };

  const clock = new THREE.Clock();
  const ahead = new THREE.Vector3();
  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    for (const s of sharks) {
      if (s.t >= 1) {
        s.wait -= dt;
        s.root.visible = false;
        if (s.wait > 0) continue;
        // новый проход: другая сторона, глубина и высота немного иные
        s.t = 0;
        s.bitten = false;
        s.dir = s.close ? (Math.random() < 0.5 ? 1 : -1) : (-s.dir as 1 | -1);
        s.y = s.close ? (Math.random() - 0.5) * 1.2 : s.y + (Math.random() - 0.5);
        s.root.visible = true;
      }
      s.t += dt / s.dur;
      if (s.t >= 1) s.wait = s.close ? 45 + Math.random() * 25 : mode === 'hero' ? 6 + Math.random() * 8 : 1 + Math.random() * 3;
      const W = halfWidth(s.z);
      // охота — быстрый проход поперёк кадра; атака — из глубины прямо в камеру, к центру, с лёгким рысканьем
      const at = (t: number, out: InstanceType<typeof THREE.Vector3>) =>
        s.close
          ? out.set(s.dir * 2.5 * (1 - t) + Math.sin(t * 9) * 0.25, s.y * (1 - t) + 0.6, -40 + t * (camera.position.z + 6 + 40))
          : out.set(s.dir * (-W + 2 * W * t), s.y + Math.sin(t * Math.PI * 2 + s.z) * 0.6, s.z + Math.sin(t * Math.PI) * 1.2);
      at(s.t, s.root.position);
      at(Math.min(s.t + 0.01, 1.01), ahead);
      s.root.lookAt(ahead);
      if (s.close && s.root.position.z > camera.position.z - 1.5) s.root.visible = false; // проплыла «сквозь» зрителя
      if (s.bite && s.swim && !s.bitten && s.t > 0.74) {
        s.bitten = true;
        s.swim.crossFadeTo(s.bite.reset().play(), 0.15, false);
      }
      s.mixer.update(dt * (s.close ? 2.1 : mode === 'hero' ? 1.7 : 1)); // на охоте хвост бьёт чаще
    }
    const p = snowGeo.attributes['position'].array as Float32Array;
    for (let i = 0; i < N; i++) {
      p[i * 3 + 1] -= dt * 0.15;
      p[i * 3] += Math.sin(time * 0.3 + i) * dt * 0.05;
      if (p[i * 3 + 1] < -10) p[i * 3 + 1] = 10;
    }
    snowGeo.attributes['position'].needsUpdate = true;
    camera.position.x += (mouse.x * 1.2 - camera.position.x) * 0.03;
    camera.position.y += (-mouse.y * 0.6 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, -6);
    renderer.render(scene, camera);
  };

  // рисуем, только когда сцену видно и вкладка активна
  let inView = true;
  const sync = () => {
    renderer.setAnimationLoop(inView && !document.hidden ? tick : null);
    if (inView && !document.hidden) clock.getDelta(); // без рывка после паузы
  };
  const io = new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    sync();
  });
  io.observe(host);
  document.addEventListener('visibilitychange', sync);
  sync();

  return () => {
    renderer.setAnimationLoop(null);
    io.disconnect();
    ro.disconnect();
    themeWatch.disconnect();
    document.removeEventListener('visibilitychange', sync);
    removeEventListener('pointermove', onMove);
    snowGeo.dispose();
    snowMat.dispose();
    renderer.dispose();
  };
}
