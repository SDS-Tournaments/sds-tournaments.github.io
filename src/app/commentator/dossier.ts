import { Component, computed, input } from '@angular/core';
import { CAR_PROTOTYPES } from '../catalog';
import { Legacy, mergeSkills, SkillRun, skills } from '../scoring/scoring';
import ruText from '../../../public/i18n/ru.json';

export const ACH = ruText.ach as Record<string, { icon: string; name: string; desc: string }>;

export interface DossierPilot {
  id: string;
  steam_id: string;
  nickname: string;
  start_number: number | null;
  avatar_url: string | null;
  livery_url: string | null;
  car: string | null;
  engine: string | null;
  gearbox: string | null;
  power_hp: number | null;
  bio_ru: string | null;
  bio_en: string | null;
  legacy: Legacy | null;
}
export interface DossierResult {
  stage_id: number;
  stage_place: number;
  qual_place: number;
  total: number;
  title: string;
}

// Досье пилота для комментатора: кто он (описание от самого пилота), машина, карьера, навыки, ачивки
@Component({
  selector: 'app-dossier',
  template: `
    @let p = pilot();
    <div class="who" [class.compact]="compact()">
      @if (p.livery_url && !compact()) { <div class="cover" [style.background-image]="'url(' + p.livery_url + ')'"></div> }
      @if (p.avatar_url) { <img class="ava" [src]="p.avatar_url" alt="" width="72" height="72" /> } @else { <span class="ava ph">{{ p.nickname[0] }}</span> }
      <div class="id">
        <p class="eyebrow">{{ team() ?? 'Без команды' }}</p>
        <h2><span class="num mono">#{{ p.start_number ?? '—' }}</span> {{ p.nickname }}</h2>
        <p class="car">
          @if (p.car) { <b>{{ p.car }}</b>@if (proto[p.car]) { <span class="subtle"> ({{ proto[p.car] }})</span> } } @else { <span class="subtle">Машина не указана</span> }
          @if (p.engine) { · {{ p.engine }} } @if (p.gearbox) { · {{ p.gearbox }} } @if (p.power_hp) { · <span class="mono">{{ p.power_hp }} л.с.</span> }
        </p>
      </div>
    </div>

    <div class="bio">
      <p class="lbl">О себе</p>
      @if (p.bio_ru || p.bio_en) {
        @if (p.bio_ru) { <p class="txt">{{ p.bio_ru }}</p> }
        @if (p.bio_en && p.bio_en !== p.bio_ru) { <p class="txt en">{{ p.bio_en }}</p> }
      } @else { <p class="subtle">Пилот не заполнил «О себе»</p> }
    </div>

    <div class="stats">
      @for (s of stats(); track s.k) {
        <div class="stat"><span class="v mono">{{ s.v }}</span><span class="k">{{ s.k }}</span></div>
      }
    </div>

    @if (sk(); as s) {
      <div class="skills">
        @for (x of skillRows(s); track x.k) {
          <div class="sk"><span class="k">{{ x.k }}</span><span class="bar"><i [style.width.%]="x.v"></i></span><span class="mono">{{ x.v }}%</span></div>
        }
      </div>
    }

    @if (!compact() && history().length) {
      <div class="hist">
        <p class="lbl">Прошлые этапы</p>
        @for (r of history().slice(0, 6); track r.stage_id) {
          <p class="hrow"><span class="t">{{ r.title }}</span><span class="mono subtle">квала {{ r.qual_place }}</span><b class="mono" [class.top]="r.stage_place <= 3">{{ r.stage_place }} место</b><span class="mono subtle">{{ r.total }} очк.</span></p>
        }
      </div>
    }

    <div class="achs">
      <p class="lbl">Ачивки</p>
      @for (a of achList(); track a.code) {
        <span class="ach" [title]="a.desc">{{ a.icon }} {{ a.name }}@if (a.n > 1) { <b class="mono">×{{ a.n }}</b> }</span>
      } @empty { <span class="subtle">Пока нет</span> }
    </div>
  `,
  styles: `
    :host { display: grid; gap: 16px; align-content: start; min-width: 0; }
    .who { position: relative; display: flex; gap: 16px; align-items: center; padding: 16px; border-radius: var(--r-md); overflow: hidden; background: var(--surface-2); isolation: isolate; }
    .cover { position: absolute; inset: 0; z-index: -1; background: center / cover no-repeat; opacity: 0.35; mask-image: linear-gradient(90deg, transparent 20%, #000); }
    .ava { width: 72px; height: 72px; border-radius: 50%; flex-shrink: 0; border: 2px solid var(--primary); object-fit: cover; }
    .ph { display: grid; place-items: center; background: var(--surface-3); color: var(--primary); font-size: 28px; font-weight: 600; }
    .compact .ava { width: 56px; height: 56px; }
    .id { min-width: 0; }
    .eyebrow { margin: 0; }
    h2 { margin: 2px 0 4px; font-size: 30px; line-height: 1.1; word-break: break-word; }
    .compact h2 { font-size: 24px; }
    .num { color: var(--primary); font-style: italic; }
    .car { margin: 0; font-size: 14px; color: var(--ink-muted); }
    .lbl { margin: 0 0 6px; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink-subtle); }
    .bio { padding: 14px 16px; border-left: 3px solid var(--primary); border-radius: var(--r-sm); background: rgba(var(--accent-rgb), 0.06); }
    .txt { margin: 0; font-size: 16px; line-height: 1.5; white-space: pre-wrap; }
    .txt.en { margin-top: 8px; font-size: 13px; color: var(--ink-muted); }
    .bio .subtle { margin: 0; }
    .stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
    .stat { display: grid; gap: 2px; padding: 10px 12px; border-radius: var(--r-sm); background: var(--surface-2); }
    .stat .v { font-size: 20px; color: var(--primary); }
    .stat .k { font-size: 11px; color: var(--ink-subtle); }
    .skills { display: grid; gap: 6px; }
    .sk { display: grid; grid-template-columns: 96px 1fr 44px; gap: 10px; align-items: center; font-size: 13px; }
    .sk .k { color: var(--ink-muted); }
    .bar { height: 6px; border-radius: 3px; background: var(--surface-3); overflow: hidden; }
    .bar i { display: block; height: 100%; background: var(--primary); }
    .sk .mono { text-align: right; }
    .hrow { display: grid; grid-template-columns: 1fr auto auto auto; gap: 12px; margin: 0; padding: 4px 0; font-size: 13px; border-bottom: 1px solid var(--hairline); }
    .hrow .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .top { color: var(--primary); }
    .achs { display: flex; flex-wrap: wrap; gap: 6px; }
    .achs .lbl { flex-basis: 100%; }
    .ach { padding: 4px 10px; border-radius: var(--r-pill); background: var(--surface-2); font-size: 12px; cursor: help; b { margin-left: 4px; color: var(--primary); } }
  `,
})
export class Dossier {
  readonly pilot = input.required<DossierPilot>();
  readonly team = input<string | null>(null);
  /** место и очки в сезоне */
  readonly season = input<{ place: number; points: number } | null>(null);
  readonly history = input<DossierResult[]>([]);
  readonly achCounts = input<Map<string, number>>(new Map());
  /** все оценки пилота на сайте (для навыков, рекордов) */
  readonly runs = input<SkillRun[]>([]);
  /** парные: две карточки рядом — без обложки и истории */
  readonly compact = input(false);
  protected readonly proto = CAR_PROTOTYPES;

  protected readonly sk = computed(() => mergeSkills(skills(this.runs()), this.pilot().legacy));
  protected readonly stats = computed(() => {
    const h = this.history();
    const scored = this.runs().filter((r) => r.attempt > 0);
    const totals = scored.filter((r) => !r.spin).map((r) => (r.angle ?? 0) + (r.style ?? 0) + (r.line ?? 0));
    const s = this.season();
    const out = [
      { k: 'В сезоне', v: s ? `#${s.place} · ${s.points}` : '—' },
      { k: 'Этапов', v: h.length },
      { k: 'Побед', v: h.filter((r) => r.stage_place === 1).length + (this.pilot().legacy?.wins ?? 0) },
      { k: 'Подиумов', v: h.filter((r) => r.stage_place <= 3).length },
      { k: 'Лучшее место', v: h.length ? Math.min(...h.map((r) => r.stage_place)) : '—' },
      { k: 'Рекорд заезда', v: totals.length ? Math.max(...totals) : '—' },
      { k: 'Сотен', v: totals.filter((t) => t >= 100).length },
      { k: 'Нулей', v: scored.length ? `${Math.round((scored.filter((r) => r.spin).length / scored.length) * 100)}%` : '—' },
    ];
    return this.compact() ? out.filter((x) => x.k !== 'Сотен' && x.k !== 'Лучшее место') : out;
  });
  protected skillRows(s: NonNullable<ReturnType<typeof skills>>) {
    return [
      { k: 'Траектория', v: s.line },
      { k: 'Угол', v: s.angle },
      { k: 'Стиль', v: s.style },
    ];
  }
  protected readonly achList = computed(() =>
    [...this.achCounts()]
      .filter(([code]) => ACH[code])
      .sort((a, b) => b[1] - a[1])
      .map(([code, n]) => ({ code, n, ...ACH[code] })),
  );
}
