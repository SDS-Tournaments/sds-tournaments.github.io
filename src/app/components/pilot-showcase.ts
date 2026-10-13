import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Legacy, mergeSkills, SkillRun, skills } from '../scoring/scoring';
import { CardData, PilotCard } from './pilot-card';
import { Radar } from './radar';

export { loadSkillRuns } from '../data/skills';

export type ShowcasePilot = Pick<CardData, 'nickname' | 'start_number' | 'avatar_url' | 'car'>;

// «Паутинка» навыков + FIFA-карточка — в публичном профиле и в личном кабинете
@Component({
  selector: 'app-pilot-showcase',
  imports: [TranslocoPipe, Radar, PilotCard],
  template: `
    <div class="card">
      <h2 class="h">{{ 'pilot.skills' | transloco }}</h2>
      @if (sk(); as s) {
        <app-radar [values]="[s.line, s.angle, s.style]" [labels]="radarLabels()" />
        <p class="subtle small center">{{ 'pilot.skillsNote' | transloco: { n: s.runs } }}</p>
      } @else {
        <p class="subtle">{{ 'pilot.noRuns' | transloco }}</p>
      }
    </div>
    <div class="card cardbox">
      <h2 class="h">{{ 'pilot.card' | transloco }}</h2>
      <app-pilot-card [d]="cardData()" />
    </div>
  `,
  styles: `
    :host { display: grid; gap: 24px; grid-template-columns: 1fr 1fr; align-items: stretch; }
    .card { display: grid; align-content: start; }
    /* паутинка — по центру своей (более высокой из-за соседней карточки) колонки */
    .card:first-child { grid-template-rows: auto 1fr auto; align-content: stretch; }
    app-radar { align-self: center; }
    @media (max-width: 860px) { :host { grid-template-columns: 1fr; } }
    .h { font-size: 18px; margin-bottom: 16px; }
    .small { font-size: 12px; }
    .center { text-align: center; margin: 8px 0 0; }
    .cardbox { display: grid; justify-items: center; }
  `,
})
export class PilotShowcase {
  readonly pilot = input.required<ShowcasePilot>();
  readonly runs = input<SkillRun[]>([]);
  readonly team = input<string | null>(null);
  readonly wins = input(0);
  /** статистика до сайта (Админка → Пилоты) */
  readonly legacy = input<Legacy | null | undefined>(null);

  private readonly t = inject(TranslocoService);
  private readonly lang = toSignal(this.t.langChanges$);

  protected readonly sk = computed(() => mergeSkills(skills(this.runs()), this.legacy()));
  protected readonly radarLabels = computed(() => {
    this.lang();
    return ['line', 'angle', 'style'].map((k) => this.t.translate('pilot.crit.' + k));
  });
  protected readonly cardData = computed<CardData>(() => {
    const s = this.sk();
    return {
      ...this.pilot(),
      team: this.team(),
      overall: s?.overall ?? null,
      angle: s?.angle ?? null,
      style: s?.style ?? null,
      line: s?.line ?? null,
      wins: this.wins() + (this.legacy()?.wins ?? 0),
    };
  });
}
