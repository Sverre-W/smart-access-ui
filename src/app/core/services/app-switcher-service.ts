import { Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

export interface AppDefinition {
  id: string;
  label: string;
  initial: string;
  icon: string;
  rootRoute: string;
}

export const APPS: AppDefinition[] = [
  { id: 'univisit',       label: 'Univisit',       initial: 'U', icon: 'pi pi-home',   rootRoute: '/visitors'    },
  { id: 'contractors',    label: 'Contractors',    initial: 'C', icon: 'pi pi-wrench', rootRoute: '/contractors' },
  { id: 'security',       label: 'Security',       initial: 'S', icon: 'pi pi-shield', rootRoute: '/security'    },
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
