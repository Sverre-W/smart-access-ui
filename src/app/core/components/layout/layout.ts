import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { startWith } from 'rxjs/operators';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { APPS, AppSwitcherService } from '../../services/app-switcher-service';
import { LocaleService, LOCALE_OPTIONS } from '../../services/locale-service';
import { PermissionsService } from '../../services/permissions-service';
import { SidebarNavService } from '../../services/sidebar-nav-service';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonModule, MenuModule, TranslateModule],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
  mobileMenuOpen = false;

  private appSwitcher = inject(AppSwitcherService);
  private sidebarNav = inject(SidebarNavService);
  private translate = inject(TranslateService);
  readonly locale = inject(LocaleService);
  private permissionsService = inject(PermissionsService);

  activeApp = this.appSwitcher.activeApp;
  navItems = this.sidebarNav.navItems;
  hasSidebar = this.sidebarNav.hasSidebar;

  /** Emits whenever the active language changes — used to invalidate computed menu labels. */
  private _lang = toSignal(this.translate.onLangChange.pipe(startWith(null)));

  appSwitcherItems = computed<MenuItem[]>(() => {
    this._lang(); // track language changes
    this.permissionsService.permissions(); // track permission changes
    return APPS.map((app) => ({
      id: app.id,
      label: this.translate.instant(`layout.apps.${app.id}`),
      icon: app.icon,
      disabled: app.disabled || (!app.disabled && !this.permissionsService.hasAppAccess(app.id)),
      command: () => this.appSwitcher.switchApp(app.id),
    }));
  });

  langMenuItems = computed<MenuItem[]>(() => {
    this._lang(); // track language changes
    return LOCALE_OPTIONS.map((opt) => ({
      label: opt.label,
      icon: this.locale.locale() === opt.code ? 'pi pi-check' : '',
      command: () => this.locale.setLocale(opt.code),
    }));
  });

  readonly currentLocaleLabel = computed(
    () => LOCALE_OPTIONS.find(o => o.code === this.locale.locale())?.label ?? '',
  );

  userMenuItems = computed<MenuItem[]>(() => {
    this._lang(); // track language changes
    return [
      {
        label: this.translate.instant('layout.language'),
        disabled: true,
        styleClass: 'text-xs font-semibold text-zinc-400 uppercase tracking-wide pointer-events-none',
      },
      ...LOCALE_OPTIONS.map((opt) => ({
        label: opt.label,
        icon: this.locale.locale() === opt.code ? 'pi pi-check' : '',
        command: () => this.locale.setLocale(opt.code),
      })),
      { separator: true },
      {
        label: this.translate.instant('layout.logout'),
        icon: 'pi pi-sign-out',
        command: () => this.logout(),
      },
    ];
  });

  constructor(
    private oauthService: OAuthService,
    private router: Router,
  ) {
    if (this.oauthService.hasValidAccessToken()) {
      this.permissionsService.loadPermissions();
    }
  }

  get isAuthenticated(): boolean {
    return this.oauthService.hasValidAccessToken();
  }

  get userName(): string {
    return this.oauthService.getIdentityClaims()?.['name'] || '';
  }

  login(): void {
    this.oauthService.initLoginFlow(this.router.url);
  }

  logout(): void {
    this.permissionsService.resetPermissions();
    this.oauthService.revokeTokenAndLogout();
  }
}
