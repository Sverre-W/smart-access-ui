import { Component } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-home',
  imports: [ButtonModule],
  templateUrl: './home.html',
})
export class Home {
  constructor(private oauthService: OAuthService) {}

  readonly features = [
    'Role-based access control',
    'Visitor management',
    'Contractor lifecycle',
    'Audit-ready reporting',
    'Multi-site support',
    'Single sign-on',
  ];

  readonly placeholderCards = [
    { label: 'Univisit', icon: 'pi pi-home' },
    { label: 'Contractors', icon: 'pi pi-wrench' },
    { label: 'Security', icon: 'pi pi-shield' },
    { label: 'Reception', icon: 'pi pi-inbox' },
  ];

  get isAuthenticated(): boolean {
    return this.oauthService.hasValidAccessToken();
  }

  get userName(): string {
    return this.oauthService.getIdentityClaims()?.['name'] || 'there';
  }

  login(): void {
    this.oauthService.initLoginFlow();
  }
}
