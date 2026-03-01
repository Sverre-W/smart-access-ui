import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/auth-api-interceptor';
import { provideOAuthClient } from 'angular-oauth2-oidc';

import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
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
    })
  ]
};

