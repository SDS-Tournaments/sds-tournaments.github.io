import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Lang, saveLang } from './i18n';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private transloco = inject(TranslocoService);
  protected readonly lang = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });
  protected readonly menuOpen = signal(false);
  protected readonly nav = ['standings', 'stages', 'pilots', 'teams', 'rules'];
  protected readonly year = new Date().getFullYear();

  constructor() {
    this.transloco.langChanges$.subscribe((l) => (document.documentElement.lang = l));
  }

  setLang(lang: Lang) {
    this.transloco.setActiveLang(lang);
    saveLang(lang);
  }
}
