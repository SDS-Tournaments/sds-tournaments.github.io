import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

// Предупреждение у всех мест, где пилот публикует своё: ливрея, описание, название и логотип команды
@Component({
  selector: 'app-content-rules',
  imports: [TranslocoPipe],
  template: `<p class="warn" role="note"><span aria-hidden="true">⚠</span> {{ 'rules.content' | transloco }}</p>`,
  styles: `
    .warn {
      margin: 0; padding: 10px 12px; border-radius: var(--r-sm); font-size: 13px; line-height: 1.45;
      color: var(--warning); background: rgba(245, 185, 66, 0.08); border: 1px solid rgba(245, 185, 66, 0.25);
    }
  `,
})
export class ContentRules {}
