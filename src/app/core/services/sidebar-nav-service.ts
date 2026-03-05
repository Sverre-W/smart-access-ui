import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { startWith } from 'rxjs/operators';
import { AppSwitcherService } from './app-switcher-service';
import { PermissionsService } from './permissions-service';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
}

interface NavItemDef {
  navKey: string;
  icon: string;
  route: string;
  requiredApp?: string;
  requiredPermissions?: string[];
}

const APP_NAV: Record<string, NavItemDef[]> = {
  univisit: [
    { navKey: 'dashboard', icon: 'pi pi-home',      route: '/visitors'                                                                              },
    { navKey: 'visitors',  icon: 'pi pi-users',     route: '/visitors/list',     requiredApp: 'Visitors Service', requiredPermissions: ['Visitor:Read']      },
    { navKey: 'reports',   icon: 'pi pi-chart-bar', route: '/visitors/reports',  requiredApp: 'Visitors Service', requiredPermissions: ['Visits:ReadAll']     },
    { navKey: 'settings',  icon: 'pi pi-cog',       route: '/visitors/settings', requiredApp: 'Visitors Service', requiredPermissions: ['Settings:Update']    },
  ],
  contractors: [],
  facility: [
    { navKey: 'dashboard',      icon: 'pi pi-home',       route: '/facility'                                                                                                    },
    { navKey: 'agents',         icon: 'pi pi-users',      route: '/facility/agents',          requiredApp: 'Agent Server',      requiredPermissions: ['View Agents']             },
    { navKey: 'tenants',        icon: 'pi pi-building',   route: '/facility/tenants',         requiredApp: 'Settings Server',   requiredPermissions: ['tenants.read']            },
    { navKey: 'roles',          icon: 'pi pi-shield',     route: '/facility/roles',           requiredApp: 'Settings Server',   requiredPermissions: ['roles.read']              },
    { navKey: 'accessPolicies', icon: 'pi pi-lock',       route: '/facility/access-policies', requiredApp: 'Access Policies',   requiredPermissions: ['Read rule sets', 'Read systems'] },
    { navKey: 'locations',      icon: 'pi pi-map-marker', route: '/facility/locations',       requiredApp: 'Locations Service', requiredPermissions: ['Locations:Read']          },
  ],
  'reception-desk': [
    { navKey: 'arrivals', icon: 'pi pi-calendar-clock', route: '/reception/arrivals', requiredApp: 'Visitors Service', requiredPermissions: ['Visits:Read'] },
    { navKey: 'guidedOnboarding', icon: 'pi pi-qrcode', route: '/reception/onboarding/home' },
  ],
  settings: [
    { navKey: 'dashboard',       icon: 'pi pi-home',  route: '/settings'       },
    { navKey: 'userManagement',  icon: 'pi pi-users', route: '/settings/users' },
  ],
};

@Injectable({ providedIn: 'root' })
export class SidebarNavService {
  private appSwitcher = inject(AppSwitcherService);
  private translate = inject(TranslateService);
  private permissionsService = inject(PermissionsService);

  /** Emits on every language change — drives re-translation of nav labels. */
  private _lang = toSignal(this.translate.onLangChange.pipe(startWith(null)));

  readonly navItems = computed<NavItem[]>(() => {
    this._lang(); // track language changes
    this.permissionsService.permissions(); // track permission changes
    const app = this.appSwitcher.activeApp();
    if (!app) return [];
    return (APP_NAV[app.id] ?? [])
      .filter(def => this.hasNavAccess(def))
      .map(def => ({
        label: this.translate.instant(`layout.nav.${def.navKey}`),
        icon: def.icon,
        route: def.route,
      }));
  });

  readonly hasSidebar = computed<boolean>(() => this.navItems().length > 0);

  private hasNavAccess(def: NavItemDef): boolean {
    if (!def.requiredApp || !def.requiredPermissions?.length) return true;
    return this.permissionsService.hasAnyPermission(def.requiredApp, ...def.requiredPermissions);
  }
}
