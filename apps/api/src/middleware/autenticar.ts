import type { NextFunction, Request, Response } from 'express';
import { Role } from '@almativa/shared';
import { naoAutorizado, proibido } from '../utils/erros.js';
import { verificarAcesso } from '../modules/auth/tokens.js';

function extrairToken(req: Request): string | null {
  const cabecalho = req.headers.authorization;
  if (cabecalho?.startsWith('Bearer ')) return cabecalho.slice(7).trim();
  const doCookie = req.cookies?.['almativa_token'];
  return typeof doCookie === 'string' && doCookie.length > 0 ? doCookie : null;
}

/** Exige um access token valido. */
export function autenticar(req: Request, _res: Response, next: NextFunction): void {
  const token = extrairToken(req);
  if (!token) throw naoAutorizado('Envie o token de acesso.');

  const payload = verificarAcesso(token);
  req.usuario = {
    id: payload.sub,
    email: payload.email,
    nome: payload.nome,
    role: payload.role,
    alunoId: payload.alunoId ?? null,
    ...(payload.dispositivoId ? { dispositivoId: payload.dispositivoId } : {}),
  };
  next();
}

/** Anexa o usuario quando houver token, mas nao bloqueia visitantes. */
export function autenticarOpcional(req: Request, _res: Response, next: NextFunction): void {
  const token = extrairToken(req);
  if (!token) return next();
  try {
    const payload = verificarAcesso(token);
    req.usuario = {
      id: payload.sub,
      email: payload.email,
      nome: payload.nome,
      role: payload.role,
      alunoId: payload.alunoId ?? null,
    };
  } catch {
    // visitante segue sem sessao
  }
  next();
}

/** Restringe a rota aos perfis informados. */
export function exigirPerfil(...perfis: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.usuario) throw naoAutorizado();
    if (!perfis.includes(req.usuario.role)) {
      throw proibido(`Esta área é restrita ao perfil ${perfis.join(' ou ')}.`);
    }
    next();
  };
}

export const somenteAdmin = exigirPerfil(Role.ADMIN);
export const somenteAluno = exigirPerfil(Role.ALUNO);
/** A tela da sala tambem pode ser aberta por um admin para conferencia. */
export const somenteAula = exigirPerfil(Role.AULA, Role.ADMIN);
