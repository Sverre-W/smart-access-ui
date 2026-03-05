---
source: Context7 API (/manfredsteyer/angular-oauth2-oidc)
library: angular-oauth2-oidc
package: angular-oauth2-oidc
topic: Angular standalone setup — provideOAuthClient, bootstrapApplication, app.config.ts
fetched: 2026-03-01T00:00:00Z
official_docs: https://github.com/manfredsteyer/angular-oauth2-oidc/blob/master/README.md
---

# Angular Standalone Setup — `provideOAuthClient`

## `provideOAuthClient` API Signature

```typescript
provideOAuthClient(
  config: OAuthModuleConfig = null,
  validationHandlerClass: any = NullValidationHandler
): EnvironmentProviders
```

| Parameter               | Type               | Default                 | Description                                                 |
|-------------------------|--------------------|-------------------------|-------------------------------------------------------------|
| `config`                | `OAuthModuleConfig`| `null`                  | Resource server config (`allowedUrls`, `sendAccessToken`)   |
| `validationHandlerClass`| `any`              | `NullValidationHandler` | Custom token validation handler (rarely needed)             |

## Angular 15+ Standalone Setup (Recommended)

```typescript
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideOAuthClient } from 'angular-oauth2-oidc';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    provideOAuthClient()
  ]
});
```

## `app.config.ts` Pattern (Angular 17+ recommended structure)

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideOAuthClient } from 'angular-oauth2-oidc';
import { routes } from './app.routes';
import { authInterceptor } from './auth/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
    provideOAuthClient(),
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

## With Built-in Token Injection (no custom interceptor)

```typescript
// app.config.ts — use provideOAuthClient config when you only need Bearer header injection
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideOAuthClient } from 'angular-oauth2-oidc';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptorsFromDi()), // needed for DI-based DefaultOAuthInterceptor
    provideOAuthClient({
      resourceServer: {
        allowedUrls: ['https://api.example.com/v1'],
        sendAccessToken: true,
      }
    }),
  ],
};
```

## Angular 14 Standalone (Legacy — `importProvidersFrom`)

```typescript
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { provideOAuthClient } from 'angular-oauth2-oidc';
import { importProvidersFrom } from '@angular/core';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(HttpClientModule), // Angular 14 only
    provideOAuthClient()
  ]
});
```

## NgModule (Traditional — still supported)

```typescript
@NgModule({
  imports: [
    HttpClientModule,
    OAuthModule.forRoot({
      resourceServer: {
        allowedUrls: ['https://api.example.com/v1'],
        sendAccessToken: true,
      }
    })
  ]
})
export class AppModule {}
```

## Typical Auth Initialization in AppComponent or AuthGuard

```typescript
import { Component, OnInit } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { authCodeFlowConfig } from './auth.config'; // your AuthConfig object

@Component({ selector: 'app-root', standalone: true, templateUrl: './app.component.html' })
export class AppComponent implements OnInit {
  constructor(private oauthService: OAuthService) {}

  async ngOnInit(): Promise<void> {
    this.oauthService.configure(authCodeFlowConfig);
    await this.oauthService.loadDiscoveryDocumentAndTryLogin();

    // Set up automatic refresh (uses refresh token for Code Flow)
    this.oauthService.setupAutomaticSilentRefresh();
  }
}
```

## Key Compatibility Notes

| Angular Version | `provideHttpClient` | Interceptor style         |
|-----------------|---------------------|---------------------------|
| 17+             | `provideHttpClient(withInterceptors([...]))` | Functional (`HttpInterceptorFn`) |
| 15–16           | `provideHttpClient(withInterceptors([...]))` | Functional or class-based  |
| 14              | `importProvidersFrom(HttpClientModule)` | Class-based (`HTTP_INTERCEPTORS`) |
| <14             | `HttpClientModule` in NgModule imports | Class-based only           |
