import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ConfigService } from './config-service';
import { OAuthService } from 'angular-oauth2-oidc';

const OFFLINE_SCOPE = 'offline_access';

/** Returns a space-separated scope string that always includes `extra`. */
function mergeScopes(scopes: string[], extra: string): string {
  const set = new Set([...scopes, extra]);
  return [...set].join(' ');
}

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

  async initialize() {
    try {
      await this.config.load();

      const auth = this.config.auth;

      // Ensure offline_access is always present so the auth server issues a refresh token
      const scopes = mergeScopes(auth.defaultScopes, OFFLINE_SCOPE);

      this.oauth.configure({
        issuer: auth.authority ?? auth.metadataUrl,
        clientId: auth.clientId!,
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
        responseType: auth.responseType ?? 'code',
        scope: scopes,
        customQueryParams: auth.additionalProviderParameters,
        strictDiscoveryDocumentValidation: false,
      });

      await this.oauth.loadDiscoveryDocumentAndTryLogin();

      // Proactively refresh access tokens before they expire (at 75% of lifetime)
      this.oauth.setupAutomaticSilentRefresh();

      // Only redirect after an OIDC callback (URL contains `code=`).
      // On a normal page load we stay on the current URL so deep links work.
      // After a callback, restore the `state` path set before the IdP redirect,
      // falling back to root if none was provided.
      if (this.isOidcCallback()) {
        const returnPath = this.getReturnPath();
        await this.router.navigateByUrl(returnPath, { replaceUrl: true });
      }

      this._status.set('ready');
    } catch (err) {
      this._error.set(err);
      this._status.set('error');
    }
  }

  /** True when the current URL is an OIDC authorization callback (contains `code=`). */
  private isOidcCallback(): boolean {
    return window.location.search.includes('code=');
  }

  /** Reads the OIDC `state` param after callback and returns it if it is a
   *  valid internal path (starts with `/` but is not the bare root). */
  private getReturnPath(): string {
    const state = this.oauth.state;
    if (state && state.startsWith('/') && state !== '/') {
      return decodeURIComponent(state);
    }
    return '/';
  }
}
