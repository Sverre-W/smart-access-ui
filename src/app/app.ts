import { Component, inject, signal } from '@angular/core';
import { StartupService } from './core/services/startup-service';
import { ApplicationError } from './core/components/application-error/application-error';
import { SplashScreen } from './core/components/splash-screen/splash-screen';
import { Layout } from './core/components/layout/layout';

@Component({
  selector: 'app-root',
  imports: [Layout, SplashScreen, ApplicationError],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('smart-access-ui');
  startup = inject(StartupService);
}
