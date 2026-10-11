import { Component, signal } from '@angular/core';
import { NumberPicker } from '../components/number-picker';

// Витрина базовых стилей для проверки дизайна (/dev/ui), не в меню
@Component({
  selector: 'app-ui-showcase',
  imports: [NumberPicker],
  template: `
    <section class="section container stack">
      <h1 class="display-lg">UI kit</h1>

      <div class="card"><app-number-picker [(value)]="num" [taken]="taken" nickname="Sadlerk" /></div>

      <div class="row">
        <button class="btn btn-primary">Зарегистрироваться</button>
        <button class="btn btn-secondary">Профиль</button>
        <button class="btn btn-ghost">Отмена</button>
        <button class="btn btn-primary" disabled>Недоступно</button>
        <span class="badge">LIVE</span>
      </div>

      <div class="grid">
        <div class="card card-hover">
          <p class="eyebrow">Этап 3</p>
          <h3>Ebisu Minami</h3>
          <p class="muted">Квалификация · 24 пилота</p>
        </div>
        <div class="card card-featured">
          <p class="eyebrow">Лидер сезона</p>
          <h3>#77 Sadlerk</h3>
          <p class="mono">512 pts</p>
        </div>
        <div class="card">
          <input class="input" placeholder="Ник пилота" />
        </div>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>#</th><th>Пилот</th><th>Команда</th><th class="num">Очки</th></tr>
          </thead>
          <tbody>
            <tr><td class="mono">1</td><td>Sadlerk</td><td class="muted">Night Owls</td><td class="num">512</td></tr>
            <tr><td class="mono">2</td><td>Kaido</td><td class="muted">—</td><td class="num">467</td></tr>
            <tr><td class="mono">3</td><td>Touge_Ghost</td><td class="muted">Smoke Unit</td><td class="num">390</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: `
    .stack { display: grid; gap: 40px; }
    .row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
    .grid { display: grid; gap: 24px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    h3 { margin: 8px 0; font-size: 20px; }
  `,
})
export class UiShowcase {
  protected readonly num = signal<number | null>(77);
  protected readonly taken = new Map([7, 13, 21, 69, 88, 99, 101].map((n) => [n, `Pilot ${n}`] as [number, string]));
}
