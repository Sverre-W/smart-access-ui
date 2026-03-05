---
source: Context7 API (/manfredsteyer/angular-oauth2-oidc)
library: angular-oauth2-oidc
package: angular-oauth2-oidc
topic: setupAutomaticSilentRefresh — API, options, when to call
fetched: 2026-03-01T00:00:00Z
official_docs: https://github.com/manfredsteyer/angular-oauth2-oidc/blob/master/docs-src/silent-refresh.md
---

# `setupAutomaticSilentRefresh()` — Full Reference

## API Signature

```typescript
public setupAutomaticSilentRefresh(
  params: object = {},
  listenTo?: 'access_token' | 'id_token' | 'any',
  noPrompt: boolean = true
): void
```

| Parameter  | Type                                         | Default | Description                                                                                |
|------------|----------------------------------------------|---------|--------------------------------------------------------------------------------------------|
| `params`   | `object`                                     | `{}`    | Additional parameters to pass to the token endpoint or silent refresh iframe request       |
| `listenTo` | `'access_token' \| 'id_token' \| 'any'`      | (any)   | Which token's expiry timer to react to. Useful if only access token or only ID token matters |
| `noPrompt` | `boolean`                                    | `true`  | Whether to suppress interactive prompts during the silent refresh (passed to auth server)  |

**Returns:** `void`

## What It Does

- Listens for the `token_expires` event emitted by the internal expiration timers.
- When the timer fires (controlled by `timeoutFactor`), automatically triggers:
  - **Code Flow** → calls `refreshToken()` (uses the stored refresh token via grant type `refresh_token`)
  - **Implicit Flow** → calls `silentRefresh()` (opens a hidden iframe)
- Pauses if the user logs out; **resumes upon re-login**.
- Provides robust hands-off session management — no manual polling needed.

## When to Call It

Call it **after** a successful login / after `tryLogin()` resolves successfully. The typical pattern is inside `AppComponent` or an auth guard/initializer:

```typescript
import { Component, OnInit } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { authCodeFlowConfig } from './auth.config';

@Component({ selector: 'app-root', templateUrl: './app.component.html' })
export class AppComponent implements OnInit {

  constructor(private oauthService: OAuthService) {}

  async ngOnInit(): Promise<void> {
    this.oauthService.configure(authCodeFlowConfig);
    await this.oauthService.loadDiscoveryDocumentAndTryLogin();

    // ✅ Call AFTER configure + tryLogin
    this.oauthService.setupAutomaticSilentRefresh();
  }
}
```

## Controlling When Refresh Fires — `timeoutFactor`

The refresh fires when `timeoutFactor * tokenLifetime` milliseconds have elapsed since the token was issued. Default is **0.75** (75% of lifetime).

```typescript
// Refresh at 80% of token lifetime instead of 75%
this.oauthService.timeoutFactor = 0.8;
this.oauthService.setupAutomaticSilentRefresh();
```

## Internal Timer Calculation

```typescript
protected calcTimeout(storedAt: number, expiration: number): number {
  const now = this.dateTimeService.now();
  const delta =
    (expiration - storedAt) * this.timeoutFactor - (now - storedAt);
  const duration = Math.max(0, delta);
  const maxTimeoutValue = 2_147_483_647; // max 32-bit int — avoids RxJS delay overflow
  return duration > maxTimeoutValue ? maxTimeoutValue : duration;
}
```

## Silent Refresh Timeout Config

When using Implicit Flow (iframe-based), configure the timeout for iframe communication:

```typescript
// Default is 20000ms (20 seconds). Increase if auth server is slow:
this.oauthService.silentRefreshTimeout = 5000;
```

## Session Change Handling

The library also calls `refreshToken()` automatically on session changes (when the OP's session cookie changes), wiring together session checks and token refresh:

```typescript
protected handleSessionChange(): void {
  this.eventsSubject.next(new OAuthInfoEvent('session_changed'));
  this.stopSessionCheckTimer();

  if (!this.useSilentRefresh && this.responseType === 'code') {
    // Code Flow → use refresh token
    this.refreshToken()
      .then(() => this.debug('token refresh after session change worked'))
      .catch(() => {
        this.eventsSubject.next(new OAuthInfoEvent('session_terminated'));
        this.logOut(true);
      });
  } else if (this.silentRefreshRedirectUri) {
    // Implicit Flow → use silent refresh iframe
    this.silentRefresh().catch(() =>
      this.debug('silent refresh failed after session changed')
    );
    this.waitForSilentRefreshAfterSessionChange();
  } else {
    this.eventsSubject.next(new OAuthInfoEvent('session_terminated'));
    this.logOut(true);
  }
}
```
