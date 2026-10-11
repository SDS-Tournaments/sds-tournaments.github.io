import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

// Оболочка админки (только RU)
@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="container admin">
      <nav class="side" aria-label="Админка">
        <p class="eyebrow">Админка</p>
        <a routerLink="/admin/seasons" routerLinkActive="active">Сезоны и этапы</a>
        <a routerLink="/admin/teams" routerLinkActive="active">Команды</a>
        <a routerLink="/admin/protests" routerLinkActive="active">Протесты</a>
        <a routerLink="/admin/settings" routerLinkActive="active">Настройки</a>
        <a routerLink="/broadcast" class="ext">Пульт трансляции ↗</a>
      </nav>
      <div class="body"><router-outlet /></div>
    </div>
  `,
  styles: `
    .admin {
      display: grid;
      grid-template-columns: 200px 1fr;
      gap: 40px;
      padding-block: 48px 96px;
    }
    .side {
      display: grid;
      align-content: start;
      gap: 4px;
      position: sticky;
      top: 88px;
      a {
        padding: 8px 12px;
        border-radius: var(--r-md);
        color: var(--ink-muted);
        background: none;
        font-size: 14px;
        &:hover { background: var(--surface-1); color: var(--ink); }
        &.active { background: var(--primary-soft); color: var(--primary); }
        &.ext { margin-top: 12px; color: var(--primary); border: 1px solid var(--hairline-strong); }
      }
    }
    .body { min-width: 0; }
    @media (max-width: 800px) {
      .admin { grid-template-columns: 1fr; gap: 16px; }
      .side { position: static; display: flex; flex-wrap: wrap; }
    }
  `,
})
export class AdminShell {}
