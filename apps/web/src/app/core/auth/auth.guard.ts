import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { Role } from '@almativa/shared';
import { AuthService } from './auth.service';

/** Exige sessao ativa; guarda a rota pretendida para voltar depois do login. */
export const guardaAutenticado: CanActivateFn = (_rota, estado) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.autenticado()) return true;
  return router.createUrlTree(['/entrar'], { queryParams: { retorno: estado.url } });
};

/** Restringe a rota a determinados perfis. */
export function guardaPerfil(...perfis: Role[]): CanActivateFn {
  return (_rota, estado) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const usuario = auth.usuario();
    if (!usuario) {
      return router.createUrlTree(['/entrar'], { queryParams: { retorno: estado.url } });
    }
    if (perfis.includes(usuario.role)) return true;

    // Perfil errado: manda para a area que ele pode acessar.
    return router.createUrlTree([auth.rotaInicial()]);
  };
}

/** Usuario logado nao deve ver a tela de login. */
export const guardaVisitante: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.autenticado() ? router.createUrlTree([auth.rotaInicial()]) : true;
};
