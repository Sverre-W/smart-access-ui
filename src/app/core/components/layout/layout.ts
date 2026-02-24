import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { PermissionsService } from '../../services/permissions-service';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {

  constructor(private oauthService: OAuthService, private permmisionsService: PermissionsService) {
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
    this.oauthService.initLoginFlow();
  }


}
