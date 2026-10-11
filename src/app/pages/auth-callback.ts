import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Auth } from '../auth';
import { SUPABASE_URL } from '../supabase.config';

// Сюда Steam-функция возвращает пилота с одноразовым токеном
@Component({
  selector: 'app-auth-callback',
  imports: [RouterLink, TranslocoPipe],
  template: `
    <section class="section container">
      @if (error()) {
        <h1 class="display-md">{{ 'auth.failed' | transloco }}</h1>
        <p class="muted">{{ 'auth.failedHint' | transloco }} <span class="mono subtle">({{ error() }})</span></p>
        <button class="btn btn-primary" (click)="auth.login()">{{ 'auth.retry' | transloco }}</button>
        <a routerLink="/" class="btn btn-ghost">{{ 'auth.home' | transloco }}</a>
      } @else {
        <p class="muted">{{ 'auth.signingIn' | transloco }}</p>
      }
    </section>
  `,
  styles: `section { display: grid; gap: 16px; justify-items: start; }`,
})
export class AuthCallback implements OnInit {
  protected auth = inject(Auth);
  private router = inject(Router);
  protected error = signal<string | null>(null);

  async ngOnInit() {
    const err = await this.auth.finishLogin(location.hash);
    history.replaceState(null, '', location.pathname); // убрать токен из адресной строки
    if (err) this.error.set(err);
    else this.router.navigateByUrl('/me');
  }
}

/**
 * Steam возвращает пилота на адрес сайта (тогда на странице входа Steam виден наш домен, а не supabase.co) —
 * отсюда ответ Steam как есть уходит на проверку в функцию steam-auth.
 */
@Component({
  selector: 'app-steam-return',
  imports: [TranslocoPipe],
  template: `<section class="section container"><p class="muted">{{ 'auth.signingIn' | transloco }}</p></section>`,
})
export class SteamReturn {
  constructor() {
    location.replace(`${SUPABASE_URL}/functions/v1/steam-auth${location.search}`);
  }
}
