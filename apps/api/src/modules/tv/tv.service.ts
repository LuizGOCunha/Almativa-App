import {
  PublicoNotificacao,
  StatusCheckin,
  type PainelAulaDto,
  type PlaylistDto,
  type TimerPresetDto,
} from '@almativa/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../db/prisma.js';
import { naoEncontrado } from '../../utils/erros.js';
import { CheckinModel, FrequenciaModel, NotificacaoModel } from '../../db/models/index.js';
import { mapPlaylist, mapTimer } from '../comum/mapeadores.js';
import { mapCheckin, mapFrequencia, mapNotificacao } from '../comum/mapeadores-eventos.js';
import { aulaAtual, proximaAula } from '../aulas/aulas.service.js';

const incluirModalidade = { modalidade: true } satisfies Prisma.TimerPresetInclude;

/* -------------------------------- Timers ------------------------------- */

export async function listarTimers(modalidadeId?: string): Promise<TimerPresetDto[]> {
  const registros = await prisma.timerPreset.findMany({
    where: { ativo: true, ...(modalidadeId ? { OR: [{ modalidadeId }, { modalidadeId: null }] } : {}) },
    include: incluirModalidade,
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
  });
  return registros.map(mapTimer);
}

export async function listarTodosTimers(): Promise<TimerPresetDto[]> {
  const registros = await prisma.timerPreset.findMany({
    include: incluirModalidade,
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
  });
  return registros.map(mapTimer);
}

export async function criarTimer(dados: Record<string, unknown>): Promise<TimerPresetDto> {
  const registro = await prisma.timerPreset.create({
    data: dados as Prisma.TimerPresetCreateInput,
    include: incluirModalidade,
  });
  return mapTimer(registro);
}

export async function atualizarTimer(id: string, dados: Record<string, unknown>): Promise<TimerPresetDto> {
  const existe = await prisma.timerPreset.findUnique({ where: { id } });
  if (!existe) throw naoEncontrado('Timer', id);
  const registro = await prisma.timerPreset.update({
    where: { id },
    data: dados,
    include: incluirModalidade,
  });
  return mapTimer(registro);
}

export async function removerTimer(id: string): Promise<void> {
  await prisma.timerPreset.delete({ where: { id } });
}

/* ------------------------------- Playlists ----------------------------- */

export async function listarPlaylists(modalidadeId?: string): Promise<PlaylistDto[]> {
  const registros = await prisma.playlist.findMany({
    where: { ativo: true, ...(modalidadeId ? { OR: [{ modalidadeId }, { modalidadeId: null }] } : {}) },
    include: incluirModalidade,
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
  });
  return registros.map(mapPlaylist);
}

export async function listarTodasPlaylists(): Promise<PlaylistDto[]> {
  const registros = await prisma.playlist.findMany({
    include: incluirModalidade,
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
  });
  return registros.map(mapPlaylist);
}

export async function criarPlaylist(dados: Record<string, unknown>): Promise<PlaylistDto> {
  const registro = await prisma.playlist.create({
    data: dados as Prisma.PlaylistCreateInput,
    include: incluirModalidade,
  });
  return mapPlaylist(registro);
}

export async function atualizarPlaylist(id: string, dados: Record<string, unknown>): Promise<PlaylistDto> {
  const existe = await prisma.playlist.findUnique({ where: { id } });
  if (!existe) throw naoEncontrado('Playlist', id);
  const registro = await prisma.playlist.update({
    where: { id },
    data: dados,
    include: incluirModalidade,
  });
  return mapPlaylist(registro);
}

export async function removerPlaylist(id: string): Promise<void> {
  await prisma.playlist.delete({ where: { id } });
}

/* ---------------------------- Painel da sala --------------------------- */

/**
 * Tudo que a TV precisa em uma unica chamada: aula em andamento, proxima
 * aula, quem ja fez check-in, quem ja teve presenca confirmada, e os
 * timers/playlists sugeridos para a modalidade da aula corrente.
 */
export async function painelDaSala(): Promise<PainelAulaDto> {
  const agora = new Date();
  const atual = await aulaAtual();
  const proxima = await proximaAula(atual ? atual.registro.fimEm : agora);

  const aulaReferencia = atual ?? proxima;
  const modalidadeId = aulaReferencia?.registro.turma.modalidadeId;

  const [checkins, presentes, timers, playlists, avisos] = await Promise.all([
    atual
      ? CheckinModel.find({ aulaId: atual.registro.id, status: { $ne: StatusCheckin.CANCELADO } }).sort({
          status: 1,
          posicaoFila: 1,
          criadoEm: 1,
        })
      : Promise.resolve([]),
    atual ? FrequenciaModel.find({ aulaId: atual.registro.id }).sort({ alunoNome: 1 }) : Promise.resolve([]),
    listarTimers(modalidadeId),
    listarPlaylists(modalidadeId),
    NotificacaoModel.find({
      publico: PublicoNotificacao.ADMIN,
      lidaEm: null,
      arquivadaEm: null,
      criadoEm: { $gte: new Date(agora.getTime() - 24 * 3_600_000) },
    })
      .sort({ criadoEm: -1 })
      .limit(5),
  ]);

  return {
    agora: agora.toISOString(),
    aulaAtual: atual?.dto ?? null,
    proximaAula: proxima?.dto ?? null,
    checkins: checkins.map(mapCheckin),
    presentes: presentes.map(mapFrequencia),
    timersSugeridos: timers,
    playlistsSugeridas: playlists,
    avisos: avisos.map(mapNotificacao),
  };
}
