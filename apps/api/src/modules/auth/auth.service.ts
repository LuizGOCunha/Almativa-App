import { Role, type SessaoDto, type UsuarioDto } from '@almativa/shared';
import { addDays } from 'date-fns';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { conflito, naoAutorizado, requisicaoInvalida } from '../../utils/erros.js';
import { conferirSenha, gerarHashSenha, hashToken, tokenAleatorio } from '../../utils/seguranca.js';
import { assinarAcesso, assinarRefresh, expiracaoDoToken, verificarRefresh } from './tokens.js';

interface MetaSessao {
  userAgent?: string | undefined;
  ip?: string | undefined;
}

function paraUsuarioDto(usuario: {
  id: string;
  email: string;
  nome: string;
  role: Role;
  alunoId: string | null;
  precisaTrocarSenha: boolean;
}): UsuarioDto {
  return {
    id: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    role: usuario.role,
    alunoId: usuario.alunoId,
    precisaTrocarSenha: usuario.precisaTrocarSenha,
  };
}

/** Emite o par access/refresh e persiste o refresh (hash) para permitir revogacao. */
async function emitirSessao(
  usuario: { id: string; email: string; nome: string; role: Role; alunoId: string | null; precisaTrocarSenha: boolean },
  meta: MetaSessao,
): Promise<SessaoDto> {
  const accessToken = assinarAcesso({
    sub: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    role: usuario.role,
    alunoId: usuario.alunoId,
  });

  const jti = tokenAleatorio(24);
  const refreshToken = assinarRefresh({ sub: usuario.id, jti });

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      usuarioId: usuario.id,
      expiraEm: addDays(new Date(), 30),
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
    },
  });

  return {
    accessToken,
    refreshToken,
    expiraEm: expiracaoDoToken(accessToken),
    usuario: paraUsuarioDto(usuario),
  };
}

export async function login(email: string, senha: string, meta: MetaSessao): Promise<SessaoDto> {
  const usuario = await prisma.usuario.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!usuario || !usuario.ativo) throw naoAutorizado('E-mail ou senha inválidos.');

  const senhaConfere = await conferirSenha(senha, usuario.senhaHash);
  if (!senhaConfere) throw naoAutorizado('E-mail ou senha inválidos.');

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoLoginEm: new Date() },
  });

  return emitirSessao(usuario, meta);
}

export async function registrar(
  email: string,
  nome: string,
  senha: string,
  role: Role,
  meta: MetaSessao,
): Promise<SessaoDto> {
  const emailNormalizado = email.toLowerCase().trim();

  const usuarioExistente = await prisma.usuario.findUnique({
    where: { email: emailNormalizado },
  });
  if (usuarioExistente) throw conflito('Um usuário com este e-mail já existe.');

  const usuario = await prisma.usuario.create({
    data: {
      email: emailNormalizado,
      nome,
      senhaHash: await gerarHashSenha(senha),
      role,
      ativo: true,
      precisaTrocarSenha: false,
    },
  });

  return emitirSessao(usuario, meta);
}

export async function renovar(refreshToken: string, meta: MetaSessao): Promise<SessaoDto> {
  const payload = verificarRefresh(refreshToken);
  const hash = hashToken(refreshToken);

  const registro = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
  if (!registro || registro.revogadoEm || registro.expiraEm < new Date()) {
    throw naoAutorizado('Sessão expirada. Faça login novamente.');
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: payload.sub } });
  if (!usuario || !usuario.ativo) throw naoAutorizado();

  // Rotaciona: o refresh usado e revogado e um novo par e emitido.
  await prisma.refreshToken.update({
    where: { id: registro.id },
    data: { revogadoEm: new Date() },
  });

  return emitirSessao(usuario, meta);
}

export async function sair(refreshToken: string | undefined, usuarioId: string): Promise<void> {
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revogadoEm: null },
      data: { revogadoEm: new Date() },
    });
    return;
  }
  await prisma.refreshToken.updateMany({
    where: { usuarioId, revogadoEm: null },
    data: { revogadoEm: new Date() },
  });
}

export async function perfil(usuarioId: string): Promise<UsuarioDto> {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario || !usuario.ativo) throw naoAutorizado();
  return paraUsuarioDto(usuario);
}

export async function trocarSenha(
  usuarioId: string,
  senhaAtual: string,
  novaSenha: string,
): Promise<void> {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) throw naoAutorizado();

  const confere = await conferirSenha(senhaAtual, usuario.senhaHash);
  if (!confere) throw requisicaoInvalida('Senha atual incorreta.');
  if (senhaAtual === novaSenha) throw requisicaoInvalida('A nova senha deve ser diferente da atual.');

  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: usuarioId },
      data: { senhaHash: await gerarHashSenha(novaSenha), precisaTrocarSenha: false },
    }),
    // Invalida outras sessoes apos a troca de senha.
    prisma.refreshToken.updateMany({
      where: { usuarioId, revogadoEm: null },
      data: { revogadoEm: new Date() },
    }),
  ]);
}

/* ------------------- Dispositivo da sala (perfil AULA) ------------------- */

/**
 * O admin cadastra a TV/tablet da sala e recebe um token de vida longa.
 * A tela guarda esse token e troca por um access token quando abre.
 */
export async function criarDispositivo(
  nome: string,
  sala: string | null,
  diasValidade: number,
): Promise<{ token: string; nomeDispositivo: string; expiraEm: string; id: string }> {
  const token = tokenAleatorio(32);
  const expiraEm = addDays(new Date(), diasValidade);

  const dispositivo = await prisma.dispositivo.create({
    data: { nome, sala, tokenHash: hashToken(token), expiraEm },
  });

  return { token, nomeDispositivo: dispositivo.nome, expiraEm: expiraEm.toISOString(), id: dispositivo.id };
}

export async function autenticarDispositivo(token: string): Promise<SessaoDto> {
  const dispositivo = await prisma.dispositivo.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!dispositivo || !dispositivo.ativo) throw naoAutorizado('Dispositivo não autorizado.');
  if (dispositivo.expiraEm < new Date()) throw naoAutorizado('Token do dispositivo expirado.');

  await prisma.dispositivo.update({
    where: { id: dispositivo.id },
    data: { ultimoAcessoEm: new Date() },
  });

  const accessToken = assinarAcesso(
    {
      sub: dispositivo.id,
      email: `dispositivo+${dispositivo.id}@almativa.local`,
      nome: dispositivo.nome,
      role: Role.AULA,
      alunoId: null,
      dispositivoId: dispositivo.id,
    },
    env.JWT_DEVICE_TTL,
  );

  return {
    accessToken,
    // Dispositivo nao usa refresh: o token de pareamento ja e de vida longa.
    refreshToken: '',
    expiraEm: expiracaoDoToken(accessToken),
    usuario: {
      id: dispositivo.id,
      email: `dispositivo+${dispositivo.id}@almativa.local`,
      nome: dispositivo.nome,
      role: Role.AULA,
      alunoId: null,
      precisaTrocarSenha: false,
    },
  };
}

export async function listarDispositivos() {
  return prisma.dispositivo.findMany({
    orderBy: { criadoEm: 'desc' },
    select: { id: true, nome: true, sala: true, ativo: true, ultimoAcessoEm: true, expiraEm: true, criadoEm: true },
  });
}

export async function revogarDispositivo(id: string): Promise<void> {
  const dispositivo = await prisma.dispositivo.findUnique({ where: { id } });
  if (!dispositivo) throw conflito('Dispositivo não encontrado.');
  await prisma.dispositivo.update({ where: { id }, data: { ativo: false } });
}
