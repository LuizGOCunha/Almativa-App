import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  type HttpInterceptorFn,
  type HttpRequest,
  type HttpHandlerFn,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, from, throwError } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { Role } from '@almativa/shared';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

/** Evita disparar varios refresh em paralelo quando o token expira. */
let renovando = false;
const tokenRenovado = new BehaviorSubject<string | null>(null);

const ROTAS_PUBLICAS = ['/auth/login', '/auth/refresh', '/publico/', '/auth/dispositivos/parear'];

function comToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const daApi = req.url.startsWith(environment.apiUrl);
  const publica = ROTAS_PUBLICAS.some((rota) => req.url.includes(rota));

  const token = auth.accessToken;
  const requisicao = daApi && !publica && token ? comToken(req, token) : req;

  return next(requisicao).pipe(
    catchError((erro: unknown) => {
      const naoAutorizado = erro instanceof HttpErrorResponse && erro.status === 401;
      if (!naoAutorizado || !daApi || publica) return throwError(() => erro);

      return renovarEReenviar(req, next, auth, router);
    }),
  );
};

function renovarEReenviar(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  router: Router,
) {
  // A TV nao usa refresh token: ela reparea com o token do dispositivo.
  const ehTv = auth.usuario()?.role === Role.AULA;

  if (renovando) {
    return tokenRenovado.pipe(
      filter((valor): valor is string => valor !== null),
      take(1),
      switchMap((novo) => next(comToken(req, novo))),
    );
  }

  renovando = true;
  tokenRenovado.next(null);

  const promessa = ehTv
    ? auth.reconectarTv().then((ok) => (ok ? auth.accessToken : null))
    : auth.renovar();

  return from(promessa).pipe(
    switchMap((novo) => {
      renovando = false;
      if (!novo) {
        auth.limparSessao();
        void router.navigate(['/entrar']);
        return throwError(() => new Error('Sessao expirada.'));
      }
      tokenRenovado.next(novo);
      return next(comToken(req, novo));
    }),
    catchError((erro: unknown) => {
      renovando = false;
      auth.limparSessao();
      void router.navigate(['/entrar']);
      return throwError(() => erro);
    }),
  );
}
