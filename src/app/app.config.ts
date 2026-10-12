import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, TitleStrategy, withComponentInputBinding, withInMemoryScrolling, withPreloading } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { routes } from './app.routes';
import { I18nLoader, LANGS, savedLang } from './i18n';
import { SdsTitle } from './title';
import { PublicPreload } from './preload';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' }), withComponentInputBinding(), withPreloading(PublicPreload)),
    provideHttpClient(),
    { provide: TitleStrategy, useClass: SdsTitle },
    provideTransloco({
      config: {
        availableLangs: [...LANGS],
        defaultLang: savedLang(),
        fallbackLang: 'ru',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: I18nLoader,
    }),
  ],
};
