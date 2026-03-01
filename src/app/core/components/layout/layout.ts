import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { APPS, AppSwitcherService } from '../../services/app-switcher-service';
import { PermissionsService } from '../../services/permissions-service';
import { SidebarNavService } from '../../services/sidebar-nav-service';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonModule, MenuModule],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
  mobileMenuOpen = false;

  private appSwitcher = inject(AppSwitcherService);
  private sidebarNav = inject(SidebarNavService);

  activeApp = this.appSwitcher.activeApp;
  navItems = this.sidebarNav.navItems;
  hasSidebar = this.sidebarNav.hasSidebar;

  appSwitcherItems: MenuItem[] = APPS.map((app) => ({
    label: app.label,
    icon: app.icon,
    command: () => this.appSwitcher.switchApp(app.id),
  }));

  userMenuItems: MenuItem[] = [
    {
      label: 'Logout',
      icon: 'pi pi-sign-out',
      command: () => this.logout(),
    },
  ];

  constructor(
    private oauthService: OAuthService,
    private permmisionsService: PermissionsService,
    private router: Router,
  ) {
    if (this.oauthService.hasValidAccessToken()) {
      permmisionsService.loadPermissions();
    }
  }

  get isAuthenticated(): boolean {
    return this.oauthService.hasValidAccessToken();
  }

  get userName(): string {
    return this.oauthService.getIdentityClaims()?.['name'] || '';
  }

  login(): void {
    this.oauthService.initLoginFlow(undefined, { state: this.router.url });
  }

  logout(): void {
    this.permmisionsService.resetPermissions();
    this.oauthService.revokeTokenAndLogout();
  }
}
