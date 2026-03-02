import { computed, Injectable } from '@angular/core';
import { AppSwitcherService } from './app-switcher-service';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
}

const APP_NAV: Record<string, NavItem[]> = {
  univisit: [
    { label: 'Dashboard', icon: 'pi pi-home',        route: '/visitors'          },
    { label: 'Visitors',  icon: 'pi pi-users',       route: '/visitors/list'     },
    { label: 'Reports',   icon: 'pi pi-chart-bar',   route: '/visitors/reports'  },
    { label: 'Settings',  icon: 'pi pi-cog',         route: '/visitors/settings' },
  ],
  contractors: [],
  facility: [
    { label: 'Dashboard',       icon: 'pi pi-home',        route: '/facility'                  },
    { label: 'Agents',          icon: 'pi pi-users',       route: '/facility/agents'           },
    { label: 'Access Policies', icon: 'pi pi-lock',        route: '/facility/access-policies'  },
    { label: 'Locations',       icon: 'pi pi-map-marker',  route: '/facility/locations'        },
  ],
  'reception-desk': [],
};

@Injectable({ providedIn: 'root' })
export class SidebarNavService {
  constructor(private appSwitcher: AppSwitcherService) {}

  readonly navItems = computed<NavItem[]>(() => {
    const app = this.appSwitcher.activeApp();
    if (!app) return [];
    return APP_NAV[app.id] ?? [];
  });

  readonly hasSidebar = computed<boolean>(() => this.navItems().length > 0);
}
