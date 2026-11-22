import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { isAccessTokenExpired } from '../auth/jwt.util';
import { TokenStorageService } from '../auth/token-storage.service';

function isCredentialRequest(url: string): boolean {
  return (
    url.includes('/api/auth/login') ||
    url.includes('/api/auth/register') ||
    url.includes('/api/auth/google')
  );
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenStorage = inject(TokenStorageService);
  const injector = inject(Injector);
  let token = tokenStorage.getAccessToken();

  if (token && isAccessTokenExpired(token)) {
    injector.get(AuthService).endExpiredSession();
    token = null;
  }

  const authReq =
    !token || token.startsWith('dev-mock.')
      ? req
      : req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        });

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        authReq.headers.has('Authorization') &&
        !isCredentialRequest(req.url)
      ) {
        injector.get(AuthService).endExpiredSession();
      }
      return throwError(() => error);
    })
  );
};
