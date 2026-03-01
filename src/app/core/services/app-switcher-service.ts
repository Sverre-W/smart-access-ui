import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

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
  private _activeApp = signal<AppDefinition>(APPS[0]);

  activeApp = this._activeApp.asReadonly();

  constructor(private router: Router) {}

  switchApp(id: string): void {
    const app = APPS.find((a) => a.id === id);
    if (app) {
      this._activeApp.set(app);
      this.router.navigate([app.rootRoute]);
    }
  }
}
