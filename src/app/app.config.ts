import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { APP_BASE_HREF } from '@angular/common';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/auth-api-interceptor';
import { provideOAuthClient } from 'angular-oauth2-oidc';

import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

import { provideTranslateService } from '@ngx-translate/core';
import { TRANSLATE_HTTP_LOADER_CONFIG, provideTranslateHttpLoader } from '@ngx-translate/http-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: APP_BASE_HREF, useFactory: () => document.querySelector('base')?.getAttribute('href') ?? '/' },
    provideOAuthClient(),
    provideHttpClient(withInterceptors([authInterceptor])),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          // Disable PrimeNG's dark mode entirely — the app uses a light theme only.
          // Without this, PrimeNG follows the OS prefers-color-scheme and renders dark
          // components on machines with system dark mode enabled.
          darkModeSelector: false,
        },
      },
    }),
    provideTranslateService({
      defaultLanguage: 'en',
    }),
    provideTranslateHttpLoader(),
    {
      provide: TRANSLATE_HTTP_LOADER_CONFIG,
      useFactory: (baseHref: string) => ({
        prefix: `${baseHref}assets/i18n/`,
        suffix: '.json',
      }),
      deps: [APP_BASE_HREF],
    },
  ],
};

