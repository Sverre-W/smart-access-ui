import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { ButtonModule } from 'primeng/button';
import { APPS, AppSwitcherService } from '../../core/services/app-switcher-service';

@Component({
  selector: 'app-home',
  imports: [ButtonModule],
  templateUrl: './home.html',
})
export class Home {
  private oauthService = inject(OAuthService);
  private appSwitcher = inject(AppSwitcherService);
  private router = inject(Router);

  readonly features = [
    'Role-based access control',
    'Visitor management',
    'Contractor lifecycle',
    'Audit-ready reporting',
    'Multi-site support',
    'Single sign-on',
  ];

  readonly apps = APPS;

  get isAuthenticated(): boolean {
    return this.oauthService.hasValidAccessToken();
  }

  get userName(): string {
    return this.oauthService.getIdentityClaims()?.['name'] || 'there';
  }

  login(): void {
    this.oauthService.initLoginFlow(undefined, { state: this.router.url });
  }

  selectApp(id: string): void {
    this.appSwitcher.switchApp(id);
  }
}
