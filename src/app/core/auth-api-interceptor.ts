import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { OAuthService } from 'angular-oauth2-oidc';

@Injectable()
export class ApiAuthInterceptor implements HttpInterceptor {

  constructor(private oauthService: OAuthService) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    const accessToken = this.oauthService.getAccessToken();
    const isAuthenticated = this.oauthService.hasValidAccessToken();

    // Only attach if authenticated AND request targets our API
    if (
      isAuthenticated &&
      accessToken &&
      req.url.startsWith('https://dev.axxession.local')
    ) {
      const authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      return next.handle(authReq);
    }

    return next.handle(req);
  }
}
