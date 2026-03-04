import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { startWith } from 'rxjs/operators';
import { AppSwitcherService } from './app-switcher-service';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
}

interface NavItemDef {
  navKey: string;
  icon: string;
  route: string;
}

const APP_NAV: Record<string, NavItemDef[]> = {
  univisit: [
    { navKey: 'dashboard', icon: 'pi pi-home',      route: '/visitors'          },
    { navKey: 'visitors',  icon: 'pi pi-users',     route: '/visitors/list'     },
    { navKey: 'reports',   icon: 'pi pi-chart-bar', route: '/visitors/reports'  },
    { navKey: 'settings',  icon: 'pi pi-cog',       route: '/visitors/settings' },
  ],
  contractors: [],
  facility: [
    { navKey: 'dashboard',      icon: 'pi pi-home',       route: '/facility'                 },
    { navKey: 'agents',         icon: 'pi pi-users',      route: '/facility/agents'          },
    { navKey: 'tenants',        icon: 'pi pi-building',   route: '/facility/tenants'         },
    { navKey: 'roles',          icon: 'pi pi-shield',     route: '/facility/roles'           },
    { navKey: 'accessPolicies', icon: 'pi pi-lock',       route: '/facility/access-policies' },
    { navKey: 'locations',      icon: 'pi pi-map-marker', route: '/facility/locations'       },
  ],
  'reception-desk': [
    { navKey: 'arrivals', icon: 'pi pi-calendar-clock', route: '/reception/arrivals' },
  ],
};

@Injectable({ providedIn: 'root' })
export class SidebarNavService {
  private appSwitcher = inject(AppSwitcherService);
  private translate = inject(TranslateService);

  /** Emits on every language change — drives re-translation of nav labels. */
  private _lang = toSignal(this.translate.onLangChange.pipe(startWith(null)));

  readonly navItems = computed<NavItem[]>(() => {
    this._lang(); // track language changes
    const app = this.appSwitcher.activeApp();
    if (!app) return [];
    return (APP_NAV[app.id] ?? []).map((def) => ({
      label: this.translate.instant(`layout.nav.${def.navKey}`),
      icon: def.icon,
      route: def.route,
    }));
  });

  readonly hasSidebar = computed<boolean>(() => this.navItems().length > 0);
}
