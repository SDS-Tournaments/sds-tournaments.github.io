import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

// Заглушка раздела до его шага в плане
@Component({
  selector: 'app-placeholder',
  imports: [TranslocoPipe],
  template: `
    <section class="section container">
      <p class="eyebrow rise">SDS</p>
      <h1 class="display-lg rise" style="--i: 1">{{ key | transloco }}</h1>
      <p class="muted rise" style="--i: 2">{{ 'common.soon' | transloco }}</p>
    </section>
  `,
})
export class Placeholder {
  protected key = inject(ActivatedRoute).snapshot.data['key'] as string;
}
