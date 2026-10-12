import { Component, computed, DestroyRef, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../auth';
import { BracketTree, TreeBattle, TreePilot } from '../components/bracket-tree';
import { CardData, PilotCard } from '../components/pilot-card';
import { Legacy, mergeSkills, qualStandings, Round, SkillRun, skills } from '../scoring/scoring';
import { compareRow } from './compare';
import { forceNoir } from '../theme';
import { mockStage } from './mock';
import { DEFAULT_STATE, LANG_SWAP_FULL_MS, LANG_SWAP_MS, OVERLAY_TEXT, OverlayState, Widget } from './state';

interface Pilot extends TreePilot {
  avatar_url: string | null;
  car: string | null;
  team: string | null;
}
interface Reg {
  profile_id: string;
  group_no: number | null;
  queue_order: number | null;
}
interface Run {
  profile_id: string;
  attempt: number;
  angle: number | null;
  style: number | null;
  line: number | null;
  spin: boolean;
  total: number;
  created_at: string;
}
interface Battle extends TreeBattle {
  decided_at: string | null;
}
interface Stage {
  id: number;
  ord: number;
  title_ru: string;
  title_en: string | null;
  status: string;
  season_id: number;
  weights: { angle: number; style: number; line: number };
}

const ORDER: Round[] = ['r32', 'r16', 'qf', 'sf', 'third', 'final'];
const FLASH_MS = 10_000;

// Плашки для OBS: прозрачный фон 1920×1080. ?only=widget — один виджет на отдельный источник
@Component({
  selector: 'app-overlay',
  imports: [BracketTree, PilotCard],
  template: `
    <div class="screen" [class.preview]="preview" [class.flip]="flip()" [attr.data-skin]="skin()">
      @if (preview && state().mock) { <div class="mock-badge">ТЕСТ · вымышленные данные (в OBS — без этой метки)</div> }
      <!-- Стадия этапа -->
      @if (show('stage') && stage(); as s) {
        <div class="w stage-chip" animate.enter="in-down" animate.leave="out-up">
          <span class="dot"></span>
          <span class="brand">SDS</span>
          <span>{{ t().stage }} {{ s.ord }}</span>
          <span class="sep">·</span>
          <span class="accent">{{ phase() }}</span>
        </div>
      }

      <!-- Протест -->
      @if (show('protest')) {
        <div class="w protest" animate.enter="in-down" animate.leave="out-up">
          <b>⚠ {{ t().protest }}</b>
          <span>{{ t().protestSub }}</span>
        </div>
      }

      <!-- На трассе -->
      @if (show('onTrack') && current(); as c) {
        <div class="w lower on-track" animate.enter="in-left" animate.leave="out-left">
          <span class="plate">{{ p(c.profile_id).start_number ?? '—' }}</span>
          @if (p(c.profile_id).avatar_url) { <img [src]="p(c.profile_id).avatar_url" alt="" /> }
          <div class="who">
            <span class="label">{{ attemptLabel() }} · {{ t().group }} {{ c.group_no ?? '—' }}</span>
            <b>{{ p(c.profile_id).nickname }}</b>
            <span class="sub">{{ sub(c.profile_id) }}</span>
          </div>
        </div>
      }

      <!-- Оценка заезда -->
      @if (scoreVisible() && lastRun(); as r) {
        <!-- всегда слева сверху, под стадией этапа: не пересекается ни с таблицей, ни с нижними плашками -->
        <div class="w score" animate.enter="in-left" animate.leave="out-left">
          @if (newLeader()) { <div class="ribbon">★ {{ t().newLeader }}</div> }
          <div class="score-head">
            <span class="plate small">{{ p(r.profile_id).start_number ?? '—' }}</span>
            <b>{{ p(r.profile_id).nickname }}</b>
            <span class="label">{{ t().run }} {{ r.attempt }}</span>
          </div>
          @if (r.spin) {
            <div class="spin">{{ t().spin }} · 0</div>
          } @else {
            @for (k of crits; track k) {
              <div class="bar">
                <span class="k">{{ t()[k] }}</span>
                <span class="track"><span class="fill" [style.--w]="pct(r, k) + '%'" [style.--heat]="pct(r, k) + '%'"></span></span>
                <span class="v" [class.max]="pct(r, k) >= 100">{{ r[k] }}</span>
              </div>
            }
            <div class="total" [style.--heat]="maxPct(r) + '%'"><span>{{ t().total }}</span><b [class.max]="maxPct(r) >= 100">{{ scoreShown() }}</b></div>
          }
        </div>
      }

      <!-- Таблица квалификации -->
      @if (show('qualTable')) {
        <div class="w table" animate.enter="in-right" animate.leave="out-right">
          <h3>{{ t().qual }}</h3>
          @for (q of top(); track q.id) {
            <div class="row" [class.fresh]="q.id === lastRun()?.profile_id">
              <span class="pl">{{ q.place }}</span>
              <span class="n">{{ p(q.id).start_number ?? '' }}</span>
              <span class="nick">{{ p(q.id).nickname }}</span>
              @if (moves().get(q.id); as mv) { <span class="mv" [class.up]="mv > 0">{{ mv > 0 ? '▲' : '▼' }}{{ mv > 0 ? mv : -mv }}</span> }
              <span class="best">{{ q.best }}</span>
            </div>
          }
        </div>
      }

      <!-- Дуэль -->
      @if (show('duel') && (duel() || flash()); as _) {
        <div class="w lower duel" animate.enter="in-up" animate.leave="out-down">
          @if (flash(); as f) {
            <div class="flash">
              <span class="label">{{ t().win }}</span>
              <span class="plate">{{ p(f.winner_id).start_number ?? '—' }}</span>
              <b>{{ p(f.winner_id).nickname }}</b>
            </div>
          } @else if (duel(); as d) {
            <span class="round">{{ t()[d.round] }}@if (d.omt_count) { · OMT {{ d.omt_count }} }</span>
            <div class="side">
              <span class="role">{{ t().leader }}</span>
              <span class="plate">{{ p(d.leader_id).start_number ?? '—' }}</span>
              <b>{{ p(d.leader_id).nickname }}</b>
            </div>
            <div class="votes">
              @for (v of votes(); track $index) {
                <span class="vote" [class]="v ?? 'wait'"></span>
              }
            </div>
            <div class="side right">
              <span class="role">{{ t().chaser }}</span>
              <span class="plate">{{ p(d.chaser_id).start_number ?? '—' }}</span>
              <b>{{ p(d.chaser_id).nickname }}</b>
            </div>
          }
        </div>
      }

      <!-- Карточки дуэли: сравнение сил -->
      @if (show('matchup') && matchup(); as m) {
        <div class="w full matchup" animate.enter="in-fade" animate.leave="out-fade">
          <p class="mu-round">{{ t()[m.round] }} · {{ t().pair }} {{ m.slot + 1 }}</p>
          <div class="mu">
            <div class="mu-card left">
              <span class="role">{{ t().leader }}</span>
              <app-pilot-card [d]="m.a" [downloadable]="false" />
            </div>
            <div class="mu-stats">
              <span class="vs">VS</span>
              @for (r of m.rows; track r.key; let i = $index) {
                <div class="cmp" [style.--i]="i">
                  <span class="k">{{ label(r.key) }}</span>
                  <span class="va" [class.win]="r.better === 'a'">{{ r.a ?? '—' }}</span>
                  <span class="bars">
                    <span class="half l"><span class="b" [class.win]="r.better === 'a'" [style.--w]="r.wa + '%'"></span></span>
                    <span class="half r"><span class="b" [class.win]="r.better === 'b'" [style.--w]="r.wb + '%'"></span></span>
                  </span>
                  <span class="vb" [class.win]="r.better === 'b'">{{ r.b ?? '—' }}</span>
                </div>
              }
            </div>
            <div class="mu-card right">
              <span class="role">{{ t().chaser }}</span>
              <app-pilot-card [d]="m.b" [downloadable]="false" />
            </div>
          </div>
        </div>
      }

      <!-- Сетка -->
      @if (show('bracket') && battles().length) {
        <div class="w full" animate.enter="in-fade" animate.leave="out-fade">
          <div class="full-in bracket" [style.zoom]="bracketZoom()">
            <app-bracket-tree [battles]="battles()" [pilots]="pilots()" [labels]="roundLabels()" [currentId]="duel()?.id ?? null" />
          </div>
        </div>
      }

      <!-- Подиум -->
      @if (show('podium') && podium().length) {
        <div class="w full" animate.enter="in-fade" animate.leave="out-fade">
          <div class="full-in podium">
            <h2>{{ t().podium }}</h2>
            <div class="steps">
              @for (pp of podiumOrder(); track pp.id) {
                <div class="step" [class]="'p' + pp.place">
                  @if (p(pp.id).avatar_url) { <img [src]="p(pp.id).avatar_url" alt="" /> } @else { <span class="noav">{{ p(pp.id).nickname[0] }}</span> }
                  <b>{{ p(pp.id).nickname }}</b>
                  <span class="block"><span class="num">{{ pp.place }}</span></span>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- Спонсоры -->
      @if (show('sponsors') && sponsors().length) {
        <div class="w sponsors" animate.enter="in-up" animate.leave="out-down">
          <span class="label">{{ t().partners }}</span>
          @for (s of [sponsors()[sponsorIdx() % sponsors().length]]; track s.id) {
            <span class="logo" animate.enter="in-fade">
              @if (s.logo_url) { <img [src]="s.logo_url" [alt]="s.name" /> } @else { {{ s.name }} }
            </span>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './overlay.scss',
})
export class Overlay implements OnInit {
  private readonly route = inject(ActivatedRoute);
  /** ?only=duel — показать только один виджет (если в OBS удобнее раскладывать по разным источникам) */
  private readonly only = this.route.snapshot.queryParamMap.get('only') as Widget | null;
  /** ?preview=1 — превью в пульте: тёмная подложка вместо прозрачности */
  protected readonly preview = this.route.snapshot.queryParamMap.has('preview');
  /** язык, которым плашки говорят сейчас (в режиме auto — чередуется) */
  private readonly autoLang = signal<'ru' | 'en'>('ru');
  /** мгновение смены языка — текст плашек плавно гаснет и проявляется */
  protected readonly flip = signal(false);

  protected readonly state = signal<OverlayState>(DEFAULT_STATE);
  protected readonly stage = signal<Stage | null>(null);
  private readonly regs = signal<Reg[]>([]);
  private readonly runs = signal<Run[]>([]);
  protected readonly battles = signal<Battle[]>([]);
  private readonly voteRows = signal<{ battle_id: number; try: number; judge: string; vote: string }[]>([]);
  protected readonly pilots = signal(new Map<string, Pilot>());
  private readonly results = signal<{ profile_id: string; stage_place: number }[]>([]);
  protected readonly sponsors = signal<{ id: number; name: string; logo_url: string | null }[]>([]);
  protected readonly sponsorIdx = signal(0);
  private readonly now = signal(Date.now());
  private channel?: RealtimeChannel;
  protected readonly crits = ['angle', 'style', 'line'] as const;

  private readonly lang = computed(() => (this.state().lang === 'auto' ? this.autoLang() : this.state().lang));
  /** ?skin=arena — посмотреть стиль без пульта */
  private readonly forceSkin = this.route.snapshot.queryParamMap.get('skin');
  protected readonly skin = computed(() => this.forceSkin ?? this.state().skin ?? 'hud');
  protected readonly t = computed(() => OVERLAY_TEXT[this.lang() as 'ru' | 'en'] ?? OVERLAY_TEXT.ru);
  protected readonly roundLabels = computed(() => Object.fromEntries(ORDER.map((r) => [r, this.t()[r]])) as Record<Round, string>);

  protected show(w: Widget) {
    return this.only ? this.only === w && (this.state().visible[w] ?? false) : (this.state().visible[w] ?? false);
  }

  protected readonly phase = computed(() => {
    const s = this.stage();
    if (!s) return '';
    if (s.status === 'battles') return this.duel() ? this.t()[this.duel()!.round] : this.t().battles;
    return (this.t() as Record<string, string>)[s.status] ?? '';
  });

  private readonly queue = computed(() => [...this.regs()].sort((a, b) => (a.queue_order ?? 1e9) - (b.queue_order ?? 1e9)));
  private readonly runsOf = (pid: string) => this.runs().filter((r) => r.profile_id === pid);
  /** На трассе — первый в очереди, у кого не все 3 заезда (как в пульте судьи) */
  protected readonly current = computed(() => this.queue().find((r) => this.runsOf(r.profile_id).length < 3) ?? null);
  protected readonly attemptLabel = computed(() => {
    const c = this.current();
    if (!c) return '';
    const done = new Set(this.runsOf(c.profile_id).map((r) => r.attempt));
    const next = [0, 1, 2].find((a) => !done.has(a)) ?? 2;
    return next === 0 ? this.t().warmup : `${this.t().run} ${next}`;
  });
  protected readonly lastRun = computed(() =>
    this.runs()
      .filter((r) => r.attempt > 0)
      .reduce<Run | null>((m, r) => (!m || r.created_at > m.created_at ? r : m), null),
  );
  protected readonly scoreVisible = computed(() => {
    if (this.show('score')) return true;
    const r = this.lastRun();
    // авто-показ: 10 секунд после каждой новой оценки
    return !this.only && this.state().autoScore && !!r && this.now() - Date.parse(r.created_at) < FLASH_MS;
  });
  private readonly qualAll = computed(() =>
    qualStandings(this.queue().map((r) => ({ id: r.profile_id, queueOrder: r.queue_order ?? 1e9, runs: this.runsOf(r.profile_id) }))),
  );
  protected readonly top = computed(() => this.qualAll().slice(0, 10));

  /** «Итог» набегает от 0 до значения при каждой новой оценке */
  protected readonly scoreShown = signal(0);
  /** заезд вывел пилота на 1-е место квалификации */
  protected readonly newLeader = computed(() => {
    const r = this.lastRun();
    const q = this.qualAll();
    return !!r && q.length > 1 && q[0].id === r.profile_id && q[0].best === r.total;
  });
  /** кто сколько мест отыграл/потерял после последней оценки (▲2 / ▼1), гаснет через 8 с */
  protected readonly moves = signal(new Map<string, number>());
  private prevPlaces = new Map<string, number>();

  /** карточки пары: навыки и победы за всё время + квалификация этого этапа */
  private readonly mu = signal<{ ids: string; cards: Record<string, CardData> } | null>(null);
  protected readonly matchup = computed(() => {
    const d = this.duel();
    const m = this.mu();
    if (!d || !m || m.ids !== `${d.leader_id}|${d.chaser_id}`) return null;
    const a = m.cards[d.leader_id!];
    const b = m.cards[d.chaser_id!];
    const qa = this.qualAll().find((q) => q.id === d.leader_id);
    const qb = this.qualAll().find((q) => q.id === d.chaser_id);
    return {
      round: d.round,
      slot: d.slot,
      a,
      b,
      rows: [
        compareRow('ovr', a.overall, b.overall),
        compareRow('angle', a.angle, b.angle),
        compareRow('style', a.style, b.style),
        compareRow('line', a.line, b.line),
        compareRow('wins', a.wins, b.wins),
        compareRow('qualPlace', qa?.place ?? null, qb?.place ?? null, true),
        compareRow('bestRun', qa?.best ?? null, qb?.best ?? null),
      ],
    };
  });

  protected label(key: string) {
    return (this.t() as Record<string, string>)[key] ?? key;
  }

  /** Масштаб сетки, чтобы Top 32/16/8 целиком влезала в 1920×1080 (размеры — из BracketTree: колонка 168 + 40, строка 34) */
  protected readonly bracketZoom = computed(() => {
    const b = this.battles();
    const first = Math.max(...ORDER.map((r) => b.filter((x) => x.round === r).length));
    const cols = new Set(b.filter((x) => x.round !== 'third').map((x) => x.round)).size;
    const w = cols * 208;
    const h = 28 + first * 2 * 34 + 120; // + блок «за 3-е место»
    return Math.min(1.6, 1760 / w, 1000 / h);
  });

  private readonly sorted = computed(() => [...this.battles()].sort((a, b) => ORDER.indexOf(a.round) - ORDER.indexOf(b.round) || a.slot - b.slot));
  // ?pair=ID — показать конкретную пару (превью карточек на завершённом этапе)
  private readonly forcePair = Number(this.route.snapshot.queryParamMap.get('pair')) || null;
  protected readonly duel = computed(() =>
    this.forcePair
      ? (this.battles().find((b) => b.id === this.forcePair) ?? null)
      : (this.sorted().find((b) => b.status !== 'done' && b.leader_id && b.chaser_id) ?? null),
  );
  /** «Победа: ник» — 10 секунд после решения судей */
  protected readonly flash = computed(() => {
    const last = this.battles()
      .filter((b) => b.decided_at && b.result !== 'bye' && b.winner_id)
      .reduce<Battle | null>((m, b) => (!m || b.decided_at! > m.decided_at! ? b : m), null);
    return last && this.now() - Date.parse(last.decided_at!) < FLASH_MS ? last : null;
  });
  protected readonly votes = computed(() => {
    const d = this.duel();
    if (!d) return [];
    const rows = this.voteRows().filter((v) => v.battle_id === d.id && v.try === d.omt_count);
    return ['angle', 'style', 'line'].map((j) => rows.find((v) => v.judge === j)?.vote ?? null);
  });

  protected readonly podium = computed(() => {
    const r = this.results().filter((x) => x.stage_place <= 3);
    if (r.length) return r.map((x) => ({ id: x.profile_id, place: x.stage_place }));
    // этап ещё не подытожен — берём из финала и дуэли за 3-е
    const fin = this.battles().find((b) => b.round === 'final' && b.winner_id);
    const third = this.battles().find((b) => b.round === 'third' && b.winner_id);
    if (!fin) return [];
    const second = fin.winner_id === fin.leader_id ? fin.chaser_id : fin.leader_id;
    return [
      { id: fin.winner_id!, place: 1 },
      ...(second ? [{ id: second, place: 2 }] : []),
      ...(third ? [{ id: third.winner_id!, place: 3 }] : []),
    ];
  });
  /** порядок на пьедестале: 2 — 1 — 3 */
  protected readonly podiumOrder = computed(() => [2, 1, 3].map((pl) => this.podium().find((x) => x.place === pl)).filter((x) => !!x));

  constructor() {
    effect((onCleanup) => {
      const target = this.lastRun()?.total ?? 0;
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / 900);
        this.scoreShown.set(Math.round(target * (1 - (1 - p) ** 3) * 10) / 10);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      let raf = requestAnimationFrame(tick);
      onCleanup(() => cancelAnimationFrame(raf));
    });
    effect((onCleanup) => {
      const places = new Map(this.qualAll().map((q) => [q.id, q.place] as const));
      const prev = untracked(() => this.prevPlaces);
      const mv = new Map<string, number>();
      if (prev.size) for (const [id, pl] of places) if (prev.has(id) && prev.get(id) !== pl) mv.set(id, prev.get(id)! - pl);
      this.prevPlaces = places;
      this.moves.set(mv);
      const id = setTimeout(() => this.moves.set(new Map()), 8000);
      onCleanup(() => clearTimeout(id));
    });
    // трансляция всегда NOIR — стиль сайта (в т.ч. в превью пульта) на плашки не влияет
    const restoreTheme = forceNoir();
    // прозрачная страница для OBS
    const root = document.documentElement;
    const prev = [root.style.background, document.body.style.background];
    if (!this.preview) root.style.background = document.body.style.background = 'transparent';
    const tick = setInterval(() => this.now.set(Date.now()), 1000);
    const rot = setInterval(() => this.sponsorIdx.update((i) => i + 1), 6000);
    // RU ⇄ EN: гасим текст, меняем язык посередине, проявляем
    let ticks = 0;
    const swap = setInterval(() => {
      if (this.state().lang !== 'auto') return;
      const full = this.show('matchup') || this.show('bracket') || this.show('podium');
      if (!full && ++ticks * LANG_SWAP_FULL_MS < LANG_SWAP_MS) return;
      ticks = 0;
      this.flip.set(true);
      setTimeout(() => this.autoLang.update((l) => (l === 'ru' ? 'en' : 'ru')), 250);
      setTimeout(() => this.flip.set(false), 600);
    }, LANG_SWAP_FULL_MS);
    inject(DestroyRef).onDestroy(() => {
      [root.style.background, document.body.style.background] = prev;
      clearInterval(tick);
      clearInterval(rot);
      clearInterval(swap);
      restoreTheme();
      if (this.channel) supabase.removeChannel(this.channel);
    });
  }

  /** вымышленный этап вместо настоящего («Тестовые данные» в пульте) */
  private showMock() {
    const m = mockStage();
    this.stage.set(m.stage);
    this.pilots.set(m.pilots);
    this.regs.set(m.regs);
    this.runs.set(m.runs);
    this.battles.set(m.battles);
    this.voteRows.set(m.votes);
    this.results.set(m.results);
    const d = this.duel()!;
    this.mu.set({ ids: `${d.leader_id}|${d.chaser_id}`, cards: m.cards });
  }

  async ngOnInit() {
    const [{ data: st }, { data: sp }] = await Promise.all([
      supabase.from('overlay_state').select('state').eq('id', 1).single(),
      supabase.from('sponsors').select('id, name, logo_url, on_overlay').eq('active', true).order('tier').order('sort'),
    ]);
    this.sponsors.set((sp ?? []).filter((s) => s.on_overlay));
    await this.applyState({ ...DEFAULT_STATE, ...(st?.state ?? {}) });
    this.channel = supabase
      .channel('overlay')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'overlay_state' }, (e) =>
        this.applyState({ ...DEFAULT_STATE, ...((e.new as { state: OverlayState }).state ?? {}) }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'qual_runs' }, () => this.loadStage())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battles' }, () => this.loadStage())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_votes' }, () => this.loadVotes())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => this.loadStage())
      .subscribe();
  }

  // ?stage=ID&show=duel,score — посмотреть плашки без пульта (только чтение, базу не меняет)
  private readonly forceStage = Number(this.route.snapshot.queryParamMap.get('stage')) || null;
  private readonly forceShow = this.route.snapshot.queryParamMap.get('show')?.split(',') as Widget[] | undefined;
  /** ?preview=1&mock=1 — вымышленный этап без пульта (база не меняется) */
  private readonly forceMock = this.preview && this.route.snapshot.queryParamMap.has('mock');

  private async applyState(s: OverlayState) {
    if (this.forceStage) s = { ...s, stageId: this.forceStage };
    if (this.forceShow) s = { ...s, visible: Object.fromEntries(this.forceShow.map((w) => [w, true])), autoScore: false };
    if (this.forceMock) s = { ...s, mock: true, lang: 'ru' };
    const changed = s.stageId !== this.state().stageId || !!s.mock !== !!this.state().mock;
    this.state.set(s);
    if (changed) await this.loadStage();
  }

  private async loadStage() {
    // тест: живые изменения настоящего этапа не перебивают вымышленные данные
    if (this.state().mock) return this.showMock();
    const id = this.state().stageId;
    if (!id) return this.stage.set(null);
    const { data: stage } = await supabase.from('stages').select('id, ord, title_ru, title_en, status, season_id, weights').eq('id', id).single();
    if (!stage) return;
    const [regs, runs, battles, results, teams] = await Promise.all([
      supabase.from('registrations').select('profile_id, group_no, queue_order, profile:profiles(nickname, start_number, avatar_url, car)').eq('stage_id', id).eq('status', 'registered'),
      supabase.from('qual_runs').select('profile_id, attempt, angle, style, line, spin, total, created_at').eq('stage_id', id),
      supabase.from('battles').select('id, round, slot, leader_id, chaser_id, winner_id, omt_count, status, result, decided_at').eq('stage_id', id),
      supabase.from('stage_results').select('profile_id, stage_place').eq('stage_id', id).lte('stage_place', 3),
      supabase.from('team_members').select('profile_id, team:teams(name)').eq('season_id', stage.season_id).eq('status', 'approved'),
    ]);
    const team = new Map(((teams.data ?? []) as unknown as { profile_id: string; team: { name: string } | null }[]).map((m) => [m.profile_id, m.team?.name ?? null]));
    const r = (regs.data ?? []) as unknown as (Reg & { profile: Omit<Pilot, 'team'> | null })[];
    this.pilots.set(new Map(r.map((x) => [x.profile_id, { ...(x.profile ?? { nickname: '?', start_number: null, avatar_url: null, car: null }), team: team.get(x.profile_id) ?? null }])));
    this.stage.set(stage);
    this.regs.set(r);
    this.runs.set(runs.data ?? []);
    this.battles.set((battles.data ?? []) as Battle[]);
    this.results.set(results.data ?? []);
    await Promise.all([this.loadVotes(), this.loadMatchup()]);
  }

  /** Данные для карточек текущей пары — перезагружаются только когда пара сменилась */
  private async loadMatchup() {
    const d = this.duel();
    if (!d) return;
    const ids = [d.leader_id!, d.chaser_id!];
    if (this.mu()?.ids === ids.join('|')) return;
    const [profiles, runs, wins] = await Promise.all([
      supabase.from('profiles').select('*').in('id', ids),
      supabase.from('qual_runs').select('profile_id, attempt, angle, style, line, spin, stage:stages(weights)').in('profile_id', ids),
      supabase.from('stage_results').select('profile_id').in('profile_id', ids).eq('stage_place', 1),
    ]);
    const cards: Record<string, CardData> = {};
    for (const p of profiles.data ?? []) {
      const legacy = (p as { legacy?: Legacy | null }).legacy;
      const sk = mergeSkills(skills(
        ((runs.data ?? []) as unknown as (Omit<SkillRun, 'weights'> & { profile_id: string; stage: { weights: SkillRun['weights'] } | null })[])
          .filter((r) => r.profile_id === p.id)
          .map((r) => ({ ...r, weights: r.stage?.weights ?? { angle: 40, style: 30, line: 30 } })),
      ), legacy);
      cards[p.id] = {
        nickname: p.nickname,
        start_number: p.start_number,
        avatar_url: p.avatar_url,
        team: this.p(p.id).team,
        car: p.car,
        overall: sk?.overall ?? null,
        angle: sk?.angle ?? null,
        style: sk?.style ?? null,
        line: sk?.line ?? null,
        wins: (wins.data ?? []).filter((w) => w.profile_id === p.id).length + (legacy?.wins ?? 0),
      };
    }
    this.mu.set({ ids: ids.join('|'), cards });
  }

  private async loadVotes() {
    if (this.state().mock) return;
    const d = this.duel();
    if (!d) return this.voteRows.set([]);
    const { data } = await supabase.from('battle_votes').select('battle_id, try, judge, vote').eq('battle_id', d.id);
    this.voteRows.set(data ?? []);
  }

  protected p(id: string | null): Pilot {
    return (id && this.pilots().get(id)) || { nickname: '—', start_number: null, avatar_url: null, car: null, team: null };
  }

  /** «команда · машина» под ником */
  protected sub(id: string) {
    const x = this.p(id);
    return [x.team, x.car].filter(Boolean).join(' · ');
  }

  /** итог в % от максимума этапа (сумма весов критериев, обычно 100) */
  protected maxPct(r: Run) {
    const w = this.stage()?.weights;
    const max = w ? w.angle + w.style + w.line : 100;
    return Math.min(100, (r.total / (max || 100)) * 100);
  }

  protected pct(r: Run, k: 'angle' | 'style' | 'line') {
    const w = this.stage()?.weights?.[k] || 1;
    return Math.min(100, ((r[k] ?? 0) / w) * 100);
  }
}
