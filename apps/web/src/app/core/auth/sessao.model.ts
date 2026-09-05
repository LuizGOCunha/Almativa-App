import type { Role, SessaoDto, UsuarioDto } from '@almativa/shared';

export type { Role, SessaoDto, UsuarioDto };

export const CHAVE_ACCESS = 'almativa.access';
export const CHAVE_REFRESH = 'almativa.refresh';
export const CHAVE_USUARIO = 'almativa.usuario';
/** Token de pareamento da TV: fica no dispositivo, nao expira na sessao. */
export const CHAVE_TOKEN_TV = 'almativa.tv.token';

/** Rota inicial de cada perfil apos o login. */
export const ROTA_INICIAL: Record<Role, string> = {
  ADMIN: '/admin',
  ALUNO: '/aluno',
  AULA: '/tv',
};
