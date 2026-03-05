---
source: Context7 API (/manfredsteyer/angular-oauth2-oidc)
library: angular-oauth2-oidc
package: angular-oauth2-oidc
topic: offline_access scope and AuthConfig for refresh tokens
fetched: 2026-03-01T00:00:00Z
official_docs: https://github.com/manfredsteyer/angular-oauth2-oidc/blob/master/docs-src/code-flow.md
---

# `offline_access` Scope — Configuring Refresh Tokens

## Key Rule
> **Add `offline_access` to the `scope` property of `AuthConfig`** to instruct the authorization server to issue a refresh token. Without this scope, no refresh token is returned.

## AuthConfig Example (Code Flow + PKCE — recommended for SPAs)

```typescript
import { AuthConfig } from 'angular-oauth2-oidc';

export const authCodeFlowConfig: AuthConfig = {
  // URL of the Identity Provider
  issuer: 'https://demo.identityserver.io',

  // URL of the SPA to redirect the user to after login
  redirectUri: window.location.origin + '/index.html',

  // The SPA's client id (registered at the auth server)
  clientId: 'spa',

  // Code Flow (recommended over Implicit Flow)
  responseType: 'code',

  // set the scope for the permissions the client should request
  // The first four are defined by OIDC.
  // *** Important: Request offline_access to get a refresh token ***
  // 'api' is a usecase-specific scope for your resource server
  scope: 'openid profile email offline_access api',

  showDebugInformation: true,

  // Not recommended:
  // disablePKCE: true,
};
```

## Notes
- `offline_access` is defined by the OAuth2/OIDC spec as the standard scope for requesting refresh tokens.
- The authorization server must also be configured to allow `offline_access` for the client.
- Works with **Code Flow + PKCE** (`responseType: 'code'`). Does NOT apply to Implicit Flow (which has no refresh token).
- `dummyClientSecret` is only needed if your auth server (incorrectly for SPAs) demands a client secret.
