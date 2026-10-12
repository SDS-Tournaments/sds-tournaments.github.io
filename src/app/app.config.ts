import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, TitleStrategy, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { routes } from './app.routes';
import { I18nLoader, LANGS, savedLang } from './i18n';
import { SdsTitle } from './title';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' }), withComponentInputBinding()),
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
