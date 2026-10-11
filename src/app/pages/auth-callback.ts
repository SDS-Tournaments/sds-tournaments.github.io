import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Auth } from '../auth';

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
