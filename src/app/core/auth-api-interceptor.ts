import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { OAuthService } from 'angular-oauth2-oidc';
import { BehaviorSubject, Observable, throwError, from } from 'rxjs';
import { catchError, filter, finalize, switchMap, take } from 'rxjs/operators';
import { ConfigService } from './services/config-service';

// Module-level refresh state — shared across all concurrent requests
let isRefreshing = false;
const refreshToken$ = new BehaviorSubject<string | null>(null);

function withBearer(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/** Returns the scheme+host portion of a URL (e.g. "https://uat.axxession.com"). */
function originOf(url: string): string {
  try {
    const { origin } = new URL(url);
    return origin;
  } catch {
    return '';
  }
}

/**
 * Functional HTTP interceptor that:
 *  1. Attaches a Bearer token to all requests targeting the API
 *  2. On 401: attempts a token refresh via the stored refresh token
 *  3. Retries the original request with the new token on success
 *  4. Queues concurrent 401s so only one refresh is in flight at a time
 *  5. Forces re-login if the refresh itself fails
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  const oauth = inject(OAuthService);
  const config = inject(ConfigService);

  // Derive the allowed origins from the runtime config so the interceptor works
  // in every environment (dev, UAT, prod) without hardcoded URLs.
  const appSettings = config.app;
  const allowedOrigins = appSettings
    ? [...new Set([
        originOf(appSettings.settingsServer),
        originOf(appSettings.baseEndpoint),
      ].filter(Boolean))]
    : [];

  const isApiRequest = allowedOrigins.some(origin => req.url.startsWith(origin));

  // Skip non-API requests (e.g. /api/settings proxied locally, OIDC discovery)
  if (!isApiRequest) {
    return next(req);
  }

  const token = oauth.getAccessToken();
  const authorisedReq = token ? withBearer(req, token) : req;

  return next(authorisedReq).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      // Another refresh is already in flight — queue behind it
      if (isRefreshing) {
        return refreshToken$.pipe(
          filter((t): t is string => t !== null),
          take(1),
          switchMap(newToken => next(withBearer(req, newToken))),
        );
      }

      isRefreshing = true;
      refreshToken$.next(null);

      return from(oauth.refreshToken()).pipe(
        switchMap(() => {
          const newToken = oauth.getAccessToken();
          refreshToken$.next(newToken);
          return next(newToken ? withBearer(req, newToken) : req);
        }),
        catchError(refreshError => {
          refreshToken$.next(null);
          // Refresh token is invalid/expired — send the user back to login
          oauth.initCodeFlow();
          return throwError(() => refreshError);
        }),
        finalize(() => {
          isRefreshing = false;
        }),
      );
    }),
  );
};
