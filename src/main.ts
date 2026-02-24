import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { StartupService } from './app/core/services/startup-service';

bootstrapApplication(App, appConfig)
  .then(appRef => {
    const startup = appRef.injector.get(StartupService);
    startup.initialize();
  })
  .catch((err) => console.error(err));



