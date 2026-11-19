import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_URL } from '../api/api-url';
import { AuthService } from './auth.service';

// Agrega el JWT a cada petición a la API. Si expira (401), lo renueva una vez y reintenta;
// si la renovación también falla, cierra la sesión.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const esApi = req.url.startsWith(API_URL);
  const conToken = (token: string | null) =>
    esApi
      ? req.clone({ withCredentials: true, ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}) })
      : req;

  return next(conToken(auth.token)).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || !esApi || /\/auth\/(login|registro|refresh|logout|mfa\/verificar)/.test(req.url)) return throwError(() => err);
      return auth.refrescar().pipe(
        switchMap((s) => next(conToken(s.token))),
        catchError((e: HttpErrorResponse) => {
          if (e.status === 401) auth.cerrarSesion();
          return throwError(() => e);
        })
      );
    })
  );
};
