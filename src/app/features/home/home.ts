import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { APPS, AppSwitcherService } from '../../core/services/app-switcher-service';

@Component({
  selector: 'app-home',
  imports: [ButtonModule, TranslateModule],
  templateUrl: './home.html',
})
export class Home {
  private oauthService = inject(OAuthService);
  private appSwitcher = inject(AppSwitcherService);
  private router = inject(Router);

  readonly featureKeys = [
    'home.features.rbac',
    'home.features.visitorManagement',
    'home.features.contractorLifecycle',
    'home.features.auditReporting',
    'home.features.multiSite',
    'home.features.sso',
  ];

  readonly apps = APPS;

  get isAuthenticated(): boolean {
    return this.oauthService.hasValidAccessToken();
  }

  get userName(): string {
    return this.oauthService.getIdentityClaims()?.['name'] || 'there';
  }

  login(): void {
    this.oauthService.initLoginFlow(this.router.url);
  }

  selectApp(id: string): void {
    this.appSwitcher.switchApp(id);
  }
}
