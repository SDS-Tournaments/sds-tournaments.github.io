import { Component, computed, effect, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { supabase } from '../auth';
import { ACHIEVEMENTS } from '../scoring/scoring';

// Полка достижений пилота: все ачивки, полученные горят со счётчиком (по одной за этап), остальные приглушены
@Component({
  selector: 'app-achievement-shelf',
  imports: [TranslocoPipe],
  template: `
    <h2 class="h sec">{{ 'pilot.achievements' | transloco }} <span class="subtle mono">{{ earned() }}/{{ list().length }}</span></h2>
    <div class="ach">
      @for (a of list(); track a.code) {
        <div class="ach-i card" [class.off]="!a.n">
          <span class="e">{{ 'ach.' + a.code + '.icon' | transloco }}</span>
          <span class="nm">{{ 'ach.' + a.code + '.name' | transloco }}</span>
          <span class="ds">{{ 'ach.' + a.code + '.desc' | transloco }}</span>
          @if (a.n) { <b class="n mono">×{{ a.n }}</b> }
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .sec { margin: 40px 0 16px; }
    .ach { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
    .ach-i { position: relative; display: grid; grid-template-columns: auto 1fr; column-gap: 12px; align-items: center; padding: 14px 16px; border-color: rgba(var(--accent-rgb), 0.35); }
    .ach-i .e { grid-row: span 2; font-size: 28px; }
    .ach-i .nm { font-size: 14px; font-weight: 600; padding-right: 36px; }
    .ach-i .ds { font-size: 12px; opacity: 0.75; }
    .n {
      position: absolute; top: 10px; right: 10px; padding: 2px 8px; border-radius: var(--r-pill);
      background: var(--primary); color: var(--on-primary, #000); font-size: 12px; font-weight: 600;
    }
    .ach-i.off { border-color: var(--hairline); opacity: 0.45; }
    .ach-i.off .e { filter: grayscale(1); }
  `,
})
export class AchievementShelf {
  readonly profileId = input.required<string>();
  private readonly codes = signal<string[]>([]);
  protected readonly list = computed(() => {
    const counts = new Map<string, number>();
    for (const c of this.codes()) counts.set(c, (counts.get(c) ?? 0) + 1);
    return ACHIEVEMENTS.map((code) => ({ code, n: counts.get(code) ?? 0 })).sort((a, b) => +!a.n - +!b.n);
  });
  protected readonly earned = computed(() => this.list().filter((a) => a.n).length);

  constructor() {
    effect(async () => {
      const { data } = await supabase.from('achievements').select('code').eq('profile_id', this.profileId());
      this.codes.set((data ?? []).map((a) => a.code));
    });
  }
}
