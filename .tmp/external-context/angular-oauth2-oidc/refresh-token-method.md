---
source: Context7 API (/manfredsteyer/angular-oauth2-oidc)
library: angular-oauth2-oidc
package: angular-oauth2-oidc
topic: refreshToken() method — API signature, usage, internals
fetched: 2026-03-01T00:00:00Z
official_docs: https://github.com/manfredsteyer/angular-oauth2-oidc/blob/master/docs-src/token-refresh.md
---

# `refreshToken()` — Full Reference

## API Signature

```typescript
public refreshToken(): Promise<TokenResponse>
```

**Returns:** `Promise<TokenResponse>` — resolves with the raw token response from the server, or rejects on error.

**Requires:** `offline_access` scope in `AuthConfig.scope` **AND** a refresh token stored in `OAuthStorage`.

**Not applicable to:** Implicit Flow (which has no refresh token — use `silentRefresh()` instead).

## Basic Usage

```typescript
// Simple call (fire-and-forget with event subscription for result)
this.oauthService.refreshToken();

// With Promise handling
this.oauthService.refreshToken()
  .then((tokenResponse) => {
    console.debug('Token refreshed successfully', tokenResponse);
  })
  .catch((err) => {
    console.error('Token refresh failed', err);
    // Handle: force re-login, show error, etc.
    this.oauthService.initCodeFlow();
  });
```

## What It Does Internally

1. Builds a POST request to the token endpoint with `grant_type: 'refresh_token'`
2. Includes the stored refresh token from `OAuthStorage.getItem('refresh_token')`
3. Handles client authentication (HTTP Basic Auth or client_id in body)
4. On success:
   - Stores the new access token and refresh token via `storeAccessTokenResponse()`
   - If OIDC and an id_token is in the response: validates and stores the new ID token
   - Emits `token_received` then `token_refreshed` events
5. On error:
   - Emits `token_error` event
   - Rejects the Promise

```typescript
// Simplified internal implementation (from source):
public refreshToken(): Promise<TokenResponse> {
  this.assertUrlNotNullAndCorrectProtocol(this.tokenEndpoint, 'tokenEndpoint');
  return new Promise((resolve, reject) => {
    let params = new HttpParams({ encoder: new WebHttpUrlEncodingCodec() })
      .set('grant_type', 'refresh_token')
      .set('scope', this.scope)
      .set('refresh_token', this._storage.getItem('refresh_token'));

    let headers = new HttpHeaders()
      .set('Content-Type', 'application/x-www-form-urlencoded');

    if (this.useHttpBasicAuth) {
      const header = btoa(`${this.clientId}:${this.dummyClientSecret}`);
      headers = headers.set('Authorization', 'Basic ' + header);
    }

    if (!this.useHttpBasicAuth) {
      params = params.set('client_id', this.clientId);
    }

    if (!this.useHttpBasicAuth && this.dummyClientSecret) {
      params = params.set('client_secret', this.dummyClientSecret);
    }

    // customQueryParams are also applied here...

    this.http
      .post<TokenResponse>(this.tokenEndpoint, params, { headers })
      .subscribe(
        (tokenResponse) => {
          this.storeAccessTokenResponse(
            tokenResponse.access_token,
            tokenResponse.refresh_token,
            tokenResponse.expires_in || this.fallbackAccessTokenExpirationTimeInSec,
            tokenResponse.scope,
            this.extractRecognizedCustomParameters(tokenResponse)
          );

          if (this.oidc && tokenResponse.id_token) {
            this.processIdToken(tokenResponse.id_token, tokenResponse.access_token, options.disableNonceCheck)
              .then((result) => {
                this.storeIdToken(result);
                this.eventsSubject.next(new OAuthSuccessEvent('token_received'));
                this.eventsSubject.next(new OAuthSuccessEvent('token_refreshed'));
                resolve(tokenResponse);
              })
              .catch((reason) => {
                this.eventsSubject.next(new OAuthErrorEvent('token_validation_error', reason));
                reject(reason);
              });
          } else {
            this.eventsSubject.next(new OAuthSuccessEvent('token_received'));
            this.eventsSubject.next(new OAuthSuccessEvent('token_refreshed'));
            resolve(tokenResponse);
          }
        },
        (err) => {
          console.error('Error getting token', err);
          this.eventsSubject.next(new OAuthErrorEvent('token_error', err));
          reject(err);
        }
      );
  });
}
```

## Events Emitted

| Outcome  | Events emitted (in order)            |
|----------|--------------------------------------|
| Success  | `token_received`, `token_refreshed`  |
| Failure  | `token_error`                        |
| ID token validation failure | `token_validation_error` |

## `silentRefresh()` — Alternative for Implicit Flow

```typescript
// For Implicit Flow only (no refresh token available):
this.oauthService.silentRefresh()
  .then(info => console.debug('silent refresh ok', info))
  .catch(err => console.error('silent refresh error', err));
```

## Checking Token Storage Directly

```typescript
// Get current access token
const token = this.oauthService.getAccessToken();

// Check if access token is valid (not expired)
const isValid = this.oauthService.hasValidAccessToken();

// Check expiration time
const expiresAt = this.oauthService.getAccessTokenExpiration(); // Unix ms
```
