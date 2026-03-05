---
source: Context7 API (/manfredsteyer/angular-oauth2-oidc)
library: angular-oauth2-oidc
package: angular-oauth2-oidc
topic: HTTP interceptor — 401 handling, token refresh flow, Angular standalone/functional interceptor pattern
fetched: 2026-03-01T00:00:00Z
official_docs: https://github.com/manfredsteyer/angular-oauth2-oidc/blob/master/docs/additional-documentation/working-with-httpinterceptors.html
---

# HTTP Interceptor — 401 Handling & Token Refresh Flow

## Built-in `DefaultOAuthInterceptor` (what the library ships)

The library includes a `DefaultOAuthInterceptor` that:
1. Attaches `Authorization: Bearer <access_token>` to configured URLs
2. Delegates error handling to `OAuthResourceServerErrorHandler`

**Full source (current version):**
```typescript
import { Injectable, Optional } from '@angular/core';
import {
  HttpEvent, HttpHandler, HttpInterceptor, HttpRequest
} from '@angular/common/http';
import { Observable, of, merge } from 'rxjs';
import { catchError, filter, map, take, mergeMap, timeout } from 'rxjs/operators';
import { OAuthResourceServerErrorHandler } from './resource-server-error-handler';
import { OAuthModuleConfig } from '../oauth-module.config';
import { OAuthService } from '../oauth-service';

@Injectable()
export class DefaultOAuthInterceptor implements HttpInterceptor {
  constructor(
    private oAuthService: OAuthService,
    private errorHandler: OAuthResourceServerErrorHandler,
    @Optional() private moduleConfig: OAuthModuleConfig
  ) {}

  private checkUrl(url: string): boolean {
    if (this.moduleConfig.resourceServer.customUrlValidation) {
      return this.moduleConfig.resourceServer.customUrlValidation(url);
    }
    if (this.moduleConfig.resourceServer.allowedUrls) {
      return !!this.moduleConfig.resourceServer.allowedUrls.find((u) =>
        url.toLowerCase().startsWith(u.toLowerCase())
      );
    }
    return true;
  }

  public intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const url = req.url.toLowerCase();

    if (!this.moduleConfig || !this.moduleConfig.resourceServer || !this.checkUrl(url)) {
      return next.handle(req);
    }

    const sendAccessToken = this.moduleConfig.resourceServer.sendAccessToken;

    if (!sendAccessToken) {
      return next.handle(req).pipe(
        catchError((err) => this.errorHandler.handleError(err))
      );
    }

    // Waits for token if not yet available (handles async login race condition)
    return merge(
      of(this.oAuthService.getAccessToken()).pipe(filter((token) => !!token)),
      this.oAuthService.events.pipe(
        filter((e) => e.type === 'token_received'),
        timeout(this.oAuthService.waitForTokenInMsec || 0),
        catchError(() => of(null)), // timeout is not an error
        map(() => this.oAuthService.getAccessToken())
      )
    ).pipe(
      take(1),
      mergeMap((token) => {
        if (token) {
          const headers = req.headers.set('Authorization', 'Bearer ' + token);
          req = req.clone({ headers });
        }
        return next.handle(req).pipe(
          catchError((err) => this.errorHandler.handleError(err))
        );
      })
    );
  }
}
```

## Enabling the Built-in Interceptor

### Standalone APIs (Angular 15+ — recommended)
```typescript
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideOAuthClient } from 'angular-oauth2-oidc';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptorsFromDi()), // ← required to use DI-based interceptors
    provideOAuthClient({
      resourceServer: {
        allowedUrls: ['https://api.example.com'],
        sendAccessToken: true,
      }
    }),
  ]
});
```

### Module-based (NgModule)
```typescript
@NgModule({
  imports: [
    OAuthModule.forRoot({
      resourceServer: {
        allowedUrls: ['https://api.example.com'],
        sendAccessToken: true,
      }
    })
  ]
})
```

## `OAuthModuleConfig` / `OAuthResourceServerConfig` API

```typescript
export abstract class OAuthModuleConfig {
  resourceServer: OAuthResourceServerConfig;
}

export abstract class OAuthResourceServerConfig {
  /** URL prefixes that the interceptor should attach tokens to */
  allowedUrls?: Array<string>;

  /** Whether to send the access token on matched URLs */
  sendAccessToken: boolean;

  /** Custom function override for URL matching logic */
  customUrlValidation?: (url: string) => boolean;
}
```

---

## Custom 401 Handler — `OAuthResourceServerErrorHandler`

The built-in error handler just rethrows. Override it to add refresh-on-401 logic:

```typescript
// resource-server-error-handler.ts
export abstract class OAuthResourceServerErrorHandler {
  abstract handleError(err: any): Observable<any>;
}
```

## ⚡ Full 401-Refresh Interceptor — Angular Standalone + Functional Pattern

> **Note:** The library's `DefaultOAuthInterceptor` does NOT automatically retry on 401 with a refreshed token. You need a custom interceptor for that.

### Functional Interceptor (Angular 15+ `withInterceptors`)

```typescript
// auth.interceptor.ts
import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { OAuthService } from 'angular-oauth2-oidc';
import { Observable, throwError, BehaviorSubject, from } from 'rxjs';
import {
  catchError,
  filter,
  take,
  switchMap,
  finalize,
} from 'rxjs/operators';

// Shared refresh state (module-scope singleton for functional interceptor)
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

function addAuthHeader(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    headers: req.headers.set('Authorization', `Bearer ${token}`),
  });
}

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const oauthService = inject(OAuthService);

  // Attach current access token
  const token = oauthService.getAccessToken();
  if (token) {
    req = addAuthHeader(req, token);
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401) {
        return throwError(() => error);
      }

      // --- 401 received: attempt token refresh ---
      if (isRefreshing) {
        // Another refresh is in progress — wait for it, then retry
        return refreshTokenSubject.pipe(
          filter((t) => t !== null),
          take(1),
          switchMap((newToken) => next(addAuthHeader(req, newToken!)))
        );
      }

      isRefreshing = true;
      refreshTokenSubject.next(null); // Block queued requests

      return from(oauthService.refreshToken()).pipe(
        switchMap(() => {
          const newToken = oauthService.getAccessToken();
          refreshTokenSubject.next(newToken);
          // Retry original request with new token
          return next(addAuthHeader(req, newToken!));
        }),
        catchError((refreshError) => {
          // Refresh failed — force re-login
          refreshTokenSubject.next(null);
          oauthService.initCodeFlow();
          return throwError(() => refreshError);
        }),
        finalize(() => {
          isRefreshing = false;
        })
      );
    })
  );
};
```

### Register the Functional Interceptor in `app.config.ts`

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideOAuthClient } from 'angular-oauth2-oidc';
import { authInterceptor } from './auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withInterceptors([authInterceptor])  // ← functional interceptor
    ),
    provideOAuthClient(),  // no resourceServer config needed — the custom interceptor handles everything
  ],
};
```

```typescript
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app.config';

bootstrapApplication(AppComponent, appConfig);
```

### ⚠️ Important: Don't Mix Both Interceptors

If you register the custom functional interceptor **and** enable `provideOAuthClient({ resourceServer: { sendAccessToken: true } })`, the `Authorization` header will be attached twice (once by the built-in DI interceptor, once by yours). Choose one approach:

| Approach | When to use |
|---|---|
| `provideOAuthClient({ resourceServer: ... })` | You only need Bearer token injection, no 401 retry |
| Custom functional interceptor (above) | You need 401-triggered token refresh + retry |

---

## Class-based Injectable Interceptor (Alternative — works with DI)

```typescript
// auth.interceptor.ts (class-based)
import { Injectable } from '@angular/core';
import {
  HttpInterceptor, HttpRequest, HttpHandler,
  HttpEvent, HttpErrorResponse,
} from '@angular/common/http';
import { OAuthService } from 'angular-oauth2-oidc';
import { Observable, throwError, BehaviorSubject, from } from 'rxjs';
import { catchError, filter, take, switchMap, finalize } from 'rxjs/operators';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  constructor(private oauthService: OAuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.oauthService.getAccessToken();
    if (token) {
      req = this.addAuthHeader(req, token);
    }

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status !== 401) {
          return throwError(() => error);
        }
        return this.handle401(req, next);
      })
    );
  }

  private handle401(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.isRefreshing) {
      return this.refreshTokenSubject.pipe(
        filter((token) => token !== null),
        take(1),
        switchMap((token) => next.handle(this.addAuthHeader(req, token!)))
      );
    }

    this.isRefreshing = true;
    this.refreshTokenSubject.next(null);

    return from(this.oauthService.refreshToken()).pipe(
      switchMap(() => {
        const newToken = this.oauthService.getAccessToken();
        this.refreshTokenSubject.next(newToken);
        return next.handle(this.addAuthHeader(req, newToken!));
      }),
      catchError((err) => {
        this.refreshTokenSubject.next(null);
        this.oauthService.initCodeFlow();
        return throwError(() => err);
      }),
      finalize(() => {
        this.isRefreshing = false;
      })
    );
  }

  private addAuthHeader(req: HttpRequest<any>, token: string): HttpRequest<any> {
    return req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`),
    });
  }
}
```

### Register Class-based Interceptor in `app.config.ts`

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { provideOAuthClient } from 'angular-oauth2-oidc';
import { AuthInterceptor } from './auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    provideOAuthClient(),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
  ],
};
```
