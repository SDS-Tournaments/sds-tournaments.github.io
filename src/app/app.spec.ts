import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        App,
        TranslocoTestingModule.forRoot({
          langs: { ru: { nav: { standings: 'Зачёт' } }, en: { nav: { standings: 'Standings' } } },
          translocoConfig: { availableLangs: ['ru', 'en'], defaultLang: 'ru', reRenderOnLangChange: true },
          preloadLangs: true,
        }),
      ],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('показывает меню на русском и переключается на английский', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.nav a')?.textContent).toBe('Зачёт');

    fixture.componentInstance.setLang('en');
    await fixture.whenStable();
    expect(el.querySelector('.nav a')?.textContent).toBe('Standings');
    expect(document.documentElement.lang).toBe('en');
  });
});
