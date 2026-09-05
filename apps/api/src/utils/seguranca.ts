import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';

const RODADAS = 12;

export function gerarHashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, RODADAS);
}

export function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

/** Hash deterministico para guardar refresh tokens e tokens de dispositivo. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tokenAleatorio(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}

/** Senha inicial legivel entregue ao aluno no primeiro acesso. */
export function senhaProvisoria(): string {
  return randomBytes(6).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) + '1';
}
