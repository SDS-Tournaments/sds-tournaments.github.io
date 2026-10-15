import { afterNextRender, Component, DestroyRef, ElementRef, inject, input, isDevMode } from '@angular/core';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';

// 3D-акулы на фоне (страница /attack-shark, коллаборация с Attack Shark).
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

  interface Shark {
    root: InstanceType<typeof THREE.Group>;
    mixer: InstanceType<typeof THREE.AnimationMixer>;
    t: number; // 0…1 — путь через кадр
    dur: number; // секунд на проход
    dir: 1 | -1;
    z: number;
    y: number;
    wait: number; // пауза до следующего прохода
    pace: Pace; // темп этого прохода
  }
  /** неровное плавание: базовый (медленный) темп + рывок в точке c силой a и шириной w */
  interface Pace {
    base: number;
    c: number;
    a: number;
    w: number;
  }
  const newPace = (): Pace => ({ base: 0.35 + Math.random() * 0.35, c: 0.2 + Math.random() * 0.55, a: 1.4 + Math.random() * 1.4, w: 0.06 + Math.random() * 0.07 });
  /** множитель скорости в точке t: подкрадывается → резкий рывок → снова скользит */
  const paceAt = (p: Pace, t: number) => p.base + p.a * Math.exp(-(((t - p.c) / p.w) ** 2));
  const make = (z: number, y: number, dur: number): Shark => {
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
    if (clip) mixer.clipAction(clip).play();
    return { root, mixer, t: Math.random(), dur, dir: Math.random() < 0.5 ? 1 : -1, z, y, wait: 0, pace: newPace() };
  };
  const sharks: Shark[] =
    mode === 'hero'
      ? [make(-6, 1.2, 12), make(-16, -1.6, 15)] // две «на охоте»
      : [make(-3, 0, 30)];
  if (mode === 'hero') {
    // охотницы появляются по одной и редко
    Object.assign(sharks[0], { t: 1, wait: 1.5 });
    Object.assign(sharks[1], { t: 1, wait: 8 });
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
  const prev = new THREE.Vector3();
  let prevReset: Shark | null = null;
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
        s.dir = -s.dir as 1 | -1;
        s.y += (Math.random() - 0.5) * 0.8;
        s.y = Math.max(-2.5, Math.min(2.5, s.y));
        s.pace = newPace(); // каждый проход — своя манера: где рывок, насколько резкий
        prevReset = s;
        s.root.visible = true;
      }
      s.t += (dt / s.dur) * paceAt(s.pace, s.t);
      if (s.t >= 1) s.wait = mode === 'hero' ? 6 + Math.random() * 8 : 1 + Math.random() * 3;
      const W = halfWidth(s.z);
      // проход поперёк кадра по волне; на рывке акула чуть ныряет и уходит глубже
      const at = (t: number, out: InstanceType<typeof THREE.Vector3>) => {
        const burst = Math.exp(-(((t - s.pace.c) / (s.pace.w * 2)) ** 2));
        return out.set(s.dir * (-W + 2 * W * t), s.y + Math.sin(t * Math.PI * 2 + s.z) * 0.6 - burst * 0.5, s.z + Math.sin(t * Math.PI) * 1.2 - burst * 1.5);
      };
      prev.copy(s.root.position);
      at(s.t, s.root.position);
      if (prevReset === s) {
        prev.copy(s.root.position); // первый кадр нового прохода — без ложного «скачка» скорости
        prevReset = null;
      }
      // скорость в «длинах тела» (модель ~5 ед.) в секунду — по ней частота взмахов хвоста
      const speed = s.root.position.distanceTo(prev) / Math.max(dt, 1e-3) / 5;
      at(Math.min(s.t + 0.01, 1.01), ahead);
      s.root.lookAt(ahead);
      // крен в повороты волнистой траектории — не «на рельсах»
      s.root.rotateZ(Math.cos(s.t * Math.PI * 2 + s.z) * 0.18);
      // цикл плавания модели — 2 с; за взмах акула проходит ~0.6 длины тела, поэтому частота следует за скоростью:
      // подкрадывается — хвост почти замирает, рывок — бьёт часто (предел 4.5×, чтобы не «дрожала»)
      const beat = Math.min(4.5, Math.max(0.6, speed * 3.5));
      s.mixer.update(dt * beat);
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
