---
source: Context7 API (/manfredsteyer/angular-oauth2-oidc)
library: angular-oauth2-oidc
package: angular-oauth2-oidc
topic: OAuthEvent types — token_expires, token_refresh_error, token_error, session_terminated, and all event types
fetched: 2026-03-01T00:00:00Z
official_docs: https://github.com/manfredsteyer/angular-oauth2-oidc/blob/master/docs/classes/OAuthSuccessEvent.html
---

# `OAuthEvent` Types — Full Reference

## Complete `EventType` Union

```typescript
export type EventType =
  | 'discovery_document_loaded'
  | 'jwks_load_error'
  | 'invalid_nonce_in_state'
  | 'discovery_document_load_error'
  | 'discovery_document_validation_error'
  | 'user_profile_loaded'
  | 'user_profile_load_error'
  | 'token_received'          // ✅ tokens successfully received and stored
  | 'token_error'             // ❌ error getting token (network, server error)
  | 'code_error'
  | 'token_refreshed'         // ✅ token successfully refreshed
  | 'token_refresh_error'     // ❌ refresh token grant failed
  | 'silent_refresh_error'    // ❌ iframe-based silent refresh failed
  | 'silently_refreshed'      // ✅ silent refresh (iframe) succeeded
  | 'silent_refresh_timeout'  // ⚠️ iframe silent refresh timed out
  | 'token_validation_error'  // ❌ token received but failed validation
  | 'token_expires'           // ⚠️ token is about to expire (fires at timeoutFactor % of lifetime)
  | 'session_changed'         // ℹ️ OP session state changed
  | 'session_error'           // ❌ session check encountered an error
  | 'session_terminated'      // 🔴 session ended — user should be logged out
  | 'session_unchanged'
  | 'logout'
  | 'popup_closed'
  | 'popup_blocked'
  | 'token_revoke_error';
```

## Event Class Hierarchy

```typescript
export abstract class OAuthEvent {
  constructor(readonly type: EventType) {}
}

// Emitted on success (token_received, token_refreshed, silently_refreshed, etc.)
export class OAuthSuccessEvent extends OAuthEvent {
  constructor(type: EventType, readonly info: any = null) {
    super(type);
  }
}

// Emitted for informational events (token_expires, session_changed, session_terminated, etc.)
export class OAuthInfoEvent extends OAuthEvent {
  constructor(type: EventType, readonly info: any = null) {
    super(type);
  }
}

// Emitted on errors (token_error, token_refresh_error, silent_refresh_error, etc.)
export class OAuthErrorEvent extends OAuthEvent {
  constructor(
    type: EventType,
    readonly reason: object,      // The underlying error object
    readonly params: object = null
  ) {
    super(type);
  }
}
```

## Key Events Explained

| Event Type            | Class               | When                                                                                    | `info` / `reason`             |
|-----------------------|---------------------|-----------------------------------------------------------------------------------------|-------------------------------|
| `token_expires`       | `OAuthInfoEvent`    | Fires at `timeoutFactor` (default 75%) of the token's lifetime — **before** expiry     | `'access_token'` or `'id_token'` |
| `token_refresh_error` | `OAuthErrorEvent`   | The `refresh_token` grant to the token endpoint failed                                  | HTTP error / server response  |
| `token_error`         | `OAuthErrorEvent`   | General token endpoint error (network failure, bad response, etc.)                      | HTTP error / server response  |
| `session_terminated`  | `OAuthInfoEvent`    | Session ended — OP signalled logout, or refresh failed after session change             | `null`                        |
| `token_refreshed`     | `OAuthSuccessEvent` | Token successfully refreshed (after `refreshToken()` call)                              | `null`                        |

## Subscribing to Events — Usage Examples

### Subscribe to all events (for logging/debugging)
```typescript
import { OAuthService, OAuthEvent } from 'angular-oauth2-oidc';

constructor(private oauthService: OAuthService) {
  this.oauthService.events.subscribe((e: OAuthEvent) => {
    console.log('OAuth event:', e.type, e);
  });
}
```

### React to `token_expires`
```typescript
import { filter } from 'rxjs/operators';
import { OAuthInfoEvent } from 'angular-oauth2-oidc';

this.oauthService.events
  .pipe(filter(e => e.type === 'token_expires'))
  .subscribe((e: OAuthInfoEvent) => {
    // e.info === 'access_token' | 'id_token'
    console.warn(`Token expiring: ${e.info}`);
    // setupAutomaticSilentRefresh handles this automatically,
    // but you can also react here manually if needed
  });
```

### React to `token_refresh_error`
```typescript
import { filter } from 'rxjs/operators';
import { OAuthErrorEvent } from 'angular-oauth2-oidc';

this.oauthService.events
  .pipe(filter(e => e.type === 'token_refresh_error'))
  .subscribe((e: OAuthErrorEvent) => {
    console.error('Refresh token failed:', e.reason);
    // Force re-login
    this.oauthService.initCodeFlow();
  });
```

### React to `session_terminated`
```typescript
this.oauthService.events
  .pipe(filter(e => e.type === 'session_terminated'))
  .subscribe(() => {
    console.debug('Your session has been terminated!');
    // Navigate to login page or show session-expired modal
    this.router.navigate(['/login']);
  });
```

### Internal: How `token_expires` is emitted (access token timer)
```typescript
// The library sets up a timer that fires at timeoutFactor * tokenLifetime
protected setupAccessTokenTimer(): void { /* ... */ }
protected setupIdTokenTimer(): void {
  const expiration = this.getIdTokenExpiration();
  const storedAt   = this.getIdTokenStoredAt();
  const timeout    = this.calcTimeout(storedAt, expiration);

  this.ngZone.runOutsideAngular(() => {
    this.idTokenTimeoutSubscription = of(
      new OAuthInfoEvent('token_expires', 'id_token')
    )
      .pipe(delay(timeout))
      .subscribe((e) => {
        this.ngZone.run(() => {
          this.eventsSubject.next(e);
        });
      });
  });
}
```

### Wait for silent refresh result after session change
```typescript
// Internal pattern — also useful to understand in your own guards:
this.oauthService.events
  .pipe(
    filter(
      (e: OAuthEvent) =>
        e.type === 'silently_refreshed' ||
        e.type === 'silent_refresh_timeout' ||
        e.type === 'silent_refresh_error'
    ),
    first()
  )
  .subscribe((e) => {
    if (e.type !== 'silently_refreshed') {
      this.eventsSubject.next(new OAuthInfoEvent('session_terminated'));
      this.oauthService.logOut(true);
    }
  });
```
