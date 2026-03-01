import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ConfigService } from './config-service';
import { OAuthService } from 'angular-oauth2-oidc';



@Injectable({ providedIn: 'root' })
export class StartupService {
  private _status = signal<'loading' | 'ready' | 'error'>('loading');
  private _error = signal<any>(null);

  status = this._status.asReadonly();
  error = this._error.asReadonly();

  constructor(
    private config: ConfigService,
    private oauth: OAuthService,
    private router: Router,
  ) { }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async initialize() {
    try {
      await this.config.load();

      const auth = this.config.auth;

      this.oauth.configure({
        issuer: auth.authority ?? auth.metadataUrl,
        clientId: auth.clientId!,
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
        responseType: auth.responseType ?? 'code',
        scope: auth.defaultScopes.join(' '),
        customQueryParams: auth.additionalProviderParameters,
        strictDiscoveryDocumentValidation: false
      });

      await this.oauth.loadDiscoveryDocumentAndTryLogin();

      await this.router.navigateByUrl('/', { replaceUrl: true });

      this._status.set('ready');
    } catch (err) {
      this._error.set(err);
      this._status.set('error');
    }
  }
}
