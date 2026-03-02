import { Component, inject, signal } from '@angular/core';
import { StartupService } from './core/services/startup-service';
import { LocaleService } from './core/services/locale-service';
import { ApplicationError } from './core/components/application-error/application-error';
import { SplashScreen } from './core/components/splash-screen/splash-screen';
import { Layout } from './core/components/layout/layout';

@Component({
  selector: 'app-root',
  imports: [Layout, SplashScreen, ApplicationError],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('smart-access-ui');
  startup = inject(StartupService);

  constructor(locale: LocaleService) {
    // Initialise i18n before any child renders: sets html[lang/dir],
    // registers all supported languages with @ngx-translate, and applies
    // any previously persisted locale from localStorage.
    locale.initialize();
  }
}
