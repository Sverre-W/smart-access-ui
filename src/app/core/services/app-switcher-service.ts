import { Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

export interface AppDefinition {
  id: string;
  label: string;
  initial: string;
  icon: string;
  rootRoute: string;
  disabled?: boolean;
}

export const APPS: AppDefinition[] = [
  { id: 'univisit',       label: 'Univisit',       initial: 'U', icon: 'pi pi-home',   rootRoute: '/visitors'    },
  { id: 'contractors',    label: 'Contractors',    initial: 'C', icon: 'pi pi-wrench', rootRoute: '/contractors', disabled: true },
  { id: 'facility',       label: 'Facility',       initial: 'F', icon: 'pi pi-shield', rootRoute: '/facility'    },
  { id: 'reception-desk', label: 'Reception Desk', initial: 'R', icon: 'pi pi-inbox',  rootRoute: '/reception'   },
];

@Injectable({ providedIn: 'root' })
export class AppSwitcherService {
  private _activeApp = signal<AppDefinition | null>(null);

  activeApp = this._activeApp.asReadonly();

  constructor(private router: Router) {
    // Sync active app with the current URL on every navigation (including initial full-page load).
    // This ensures sub-routes like /visitors/create correctly activate their parent app after a reload.
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        const url = e.urlAfterRedirects;
        if (url === '/') {
          this._activeApp.set(null);
        } else {
          const matched = APPS.find(a => url.startsWith(a.rootRoute));
          this._activeApp.set(matched ?? null);
        }
      });

    // Seed the active app from the current URL immediately. The service is
    // lazily instantiated, so the initial NavigationEnd may have already fired
    // before this constructor runs (e.g. on a full-page reload to a deep link).
    const initialUrl = this.router.url;
    if (initialUrl && initialUrl !== '/') {
      const matched = APPS.find(a => initialUrl.startsWith(a.rootRoute));
      this._activeApp.set(matched ?? null);
    }
  }

  switchApp(id: string): void {
    const app = APPS.find((a) => a.id === id);
    if (app) {
      this._activeApp.set(app);
      this.router.navigate([app.rootRoute]);
    }
  }

  clearApp(): void {
    this._activeApp.set(null);
  }
}
