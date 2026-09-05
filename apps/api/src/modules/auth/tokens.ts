import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@almativa/shared';
import { env } from '../../config/env.js';
import { naoAutorizado } from '../../utils/erros.js';

export interface PayloadAcesso {
  sub: string;
  email: string;
  nome: string;
  role: Role;
  alunoId: string | null;
  dispositivoId?: string;
}

export interface PayloadRefresh {
  sub: string;
  jti: string;
}

export function assinarAcesso(payload: PayloadAcesso, ttl?: string): string {
  const opcoes: SignOptions = {
    expiresIn: (ttl ?? env.JWT_ACCESS_TTL) as SignOptions['expiresIn'],
    issuer: 'almativa',
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, opcoes);
}

export function assinarRefresh(payload: PayloadRefresh): string {
  const opcoes: SignOptions = {
    expiresIn: env.JWT_REFRESH_TTL as SignOptions['expiresIn'],
    issuer: 'almativa',
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, opcoes);
}

export function verificarAcesso(token: string): PayloadAcesso & { exp: number } {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as PayloadAcesso & { exp: number };
  } catch {
    throw naoAutorizado('Token de acesso inválido ou expirado.');
  }
}

export function verificarRefresh(token: string): PayloadRefresh & { exp: number } {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as PayloadRefresh & { exp: number };
  } catch {
    throw naoAutorizado('Sessão expirada. Faça login novamente.');
  }
}

/** Segundos ate a expiracao do access token, para o front agendar o refresh. */
export function expiracaoDoToken(token: string): number {
  const decodificado = jwt.decode(token) as { exp?: number } | null;
  if (!decodificado?.exp) return 0;
  return decodificado.exp * 1000;
}
