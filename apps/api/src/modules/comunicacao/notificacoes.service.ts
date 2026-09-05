import {
  CanalNotificacao,
  PublicoNotificacao,
  TipoNotificacao,
  competenciaLegivel,
  formatarMoeda,
  type NotificacaoDto,
  type Paginado,
} from '@almativa/shared';
import { NotificacaoModel } from '../../db/models/index.js';
import { logger } from '../../config/logger.js';
import { naoEncontrado } from '../../utils/erros.js';
import { mapNotificacao } from '../comum/mapeadores-eventos.js';

export interface EntradaNotificacao {
  publico: PublicoNotificacao;
  alunoId?: string | null;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  canais?: CanalNotificacao[];
  dados?: Record<string, unknown>;
  campanhaId?: string | null;
  /** Torna a criacao idempotente (ex.: um lembrete por mensalidade por dia). */
  chaveDeduplicacao?: string | null;
  agendadaPara?: Date | null;
}

/**
 * Cria a notificacao respeitando a chave de deduplicacao.
 * Retorna null quando a notificacao ja existia.
 */
export async function criarNotificacao(entrada: EntradaNotificacao): Promise<NotificacaoDto | null> {
  try {
    const doc = await NotificacaoModel.create({
      publico: entrada.publico,
      alunoId: entrada.alunoId ?? null,
      tipo: entrada.tipo,
      titulo: entrada.titulo,
      mensagem: entrada.mensagem,
      canais: entrada.canais ?? [CanalNotificacao.APP],
      dados: entrada.dados ?? {},
      campanhaId: entrada.campanhaId ?? null,
      chaveDeduplicacao: entrada.chaveDeduplicacao ?? null,
      agendadaPara: entrada.agendadaPara ?? null,
      enviadaEm: entrada.agendadaPara ? null : new Date(),
    });
    return mapNotificacao(doc);
  } catch (erro) {
    // 11000 = violacao do indice unico de deduplicacao: ja foi enviada.
    if ((erro as { code?: number }).code === 11000) return null;
    logger.error({ erro, entrada }, 'Falha ao criar notificação');
    throw erro;
  }
}

export async function criarNotificacoes(entradas: EntradaNotificacao[]): Promise<number> {
  let criadas = 0;
  for (const entrada of entradas) {
    const resultado = await criarNotificacao(entrada);
    if (resultado) criadas++;
  }
  return criadas;
}

export interface FiltrosNotificacao {
  publico: PublicoNotificacao;
  alunoId?: string;
  tipo?: TipoNotificacao;
  apenasNaoLidas?: boolean;
  pagina: number;
  porPagina: number;
}

export async function listarNotificacoes(filtros: FiltrosNotificacao): Promise<Paginado<NotificacaoDto>> {
  const query: Record<string, unknown> = {
    publico: filtros.publico,
    arquivadaEm: null,
    $or: [{ agendadaPara: null }, { agendadaPara: { $lte: new Date() } }],
  };
  if (filtros.alunoId) query['alunoId'] = filtros.alunoId;
  if (filtros.tipo) query['tipo'] = filtros.tipo;
  if (filtros.apenasNaoLidas) query['lidaEm'] = null;

  const pular = (filtros.pagina - 1) * filtros.porPagina;
  const [docs, total] = await Promise.all([
    NotificacaoModel.find(query).sort({ criadoEm: -1 }).skip(pular).limit(filtros.porPagina),
    NotificacaoModel.countDocuments(query),
  ]);

  return {
    itens: docs.map(mapNotificacao),
    total,
    pagina: filtros.pagina,
    porPagina: filtros.porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / filtros.porPagina)),
  };
}

export async function contarNaoLidas(publico: PublicoNotificacao, alunoId?: string): Promise<number> {
  return NotificacaoModel.countDocuments({
    publico,
    lidaEm: null,
    arquivadaEm: null,
    ...(alunoId ? { alunoId } : {}),
    $or: [{ agendadaPara: null }, { agendadaPara: { $lte: new Date() } }],
  });
}

export async function marcarComoLida(id: string, alunoId?: string): Promise<NotificacaoDto> {
  const doc = await NotificacaoModel.findOneAndUpdate(
    { _id: id, ...(alunoId ? { alunoId } : {}) },
    { $set: { lidaEm: new Date() } },
    { new: true },
  );
  if (!doc) throw naoEncontrado('Notificação', id);
  return mapNotificacao(doc);
}

export async function marcarTodasComoLidas(publico: PublicoNotificacao, alunoId?: string): Promise<number> {
  const resultado = await NotificacaoModel.updateMany(
    { publico, lidaEm: null, ...(alunoId ? { alunoId } : {}) },
    { $set: { lidaEm: new Date() } },
  );
  return resultado.modifiedCount;
}

export async function arquivarNotificacao(id: string): Promise<void> {
  const doc = await NotificacaoModel.findByIdAndUpdate(id, { $set: { arquivadaEm: new Date() } });
  if (!doc) throw naoEncontrado('Notificação', id);
}

/* ------------------- Notificacoes de dominio (atalhos) ------------------ */

export async function notificarPagamentoConfirmado(dados: {
  alunoId: string;
  alunoNome: string;
  competencia: string;
  valorCentavos: number;
  mensalidadeId: string;
}): Promise<void> {
  await criarNotificacao({
    publico: PublicoNotificacao.ALUNO,
    alunoId: dados.alunoId,
    tipo: TipoNotificacao.PAGAMENTO_CONFIRMADO,
    titulo: 'Pagamento confirmado',
    mensagem: `Recebemos o pagamento de ${formatarMoeda(dados.valorCentavos)} referente a ${competenciaLegivel(
      dados.competencia,
    )}. Obrigado!`,
    dados: { mensalidadeId: dados.mensalidadeId, competencia: dados.competencia },
    chaveDeduplicacao: `pagamento:${dados.mensalidadeId}`,
  });
}

/**
 * Lembrete de vencimento: cria uma notificacao para o aluno e outra para o
 * painel admin. A chave de deduplicacao garante um lembrete por mensalidade
 * por marco de dias (ex.: 7, 3 e 1 dia antes).
 */
export async function notificarVencimento(dados: {
  alunoId: string;
  alunoNome: string;
  mensalidadeId: string;
  competencia: string;
  valorCentavos: number;
  vencimentoEm: Date;
  diasParaVencer: number;
}): Promise<{ aluno: boolean; admin: boolean }> {
  const atrasado = dados.diasParaVencer < 0;
  const marco = atrasado ? `atraso-${Math.abs(dados.diasParaVencer)}` : `d-${dados.diasParaVencer}`;
  const tipo = atrasado ? TipoNotificacao.VENCIMENTO_ATRASADO : TipoNotificacao.VENCIMENTO_PROXIMO;
  const valor = formatarMoeda(dados.valorCentavos);
  const dataBr = dados.vencimentoEm.toLocaleDateString('pt-BR', { timeZone: 'UTC' });

  const prazo = atrasado
    ? `venceu há ${Math.abs(dados.diasParaVencer)} dia(s)`
    : dados.diasParaVencer === 0
      ? 'vence hoje'
      : `vence em ${dados.diasParaVencer} dia(s)`;

  const paraAluno = await criarNotificacao({
    publico: PublicoNotificacao.ALUNO,
    alunoId: dados.alunoId,
    tipo,
    titulo: atrasado ? 'Mensalidade em atraso' : 'Mensalidade a vencer',
    mensagem: `Sua mensalidade de ${competenciaLegivel(dados.competencia)} (${valor}) ${prazo} — ${dataBr}.`,
    canais: [CanalNotificacao.APP],
    dados: {
      mensalidadeId: dados.mensalidadeId,
      competencia: dados.competencia,
      vencimentoEm: dados.vencimentoEm.toISOString(),
      diasParaVencer: dados.diasParaVencer,
    },
    chaveDeduplicacao: `venc:aluno:${dados.mensalidadeId}:${marco}`,
  });

  const paraAdmin = await criarNotificacao({
    publico: PublicoNotificacao.ADMIN,
    alunoId: dados.alunoId,
    tipo,
    titulo: atrasado ? `${dados.alunoNome} — mensalidade em atraso` : `${dados.alunoNome} — renovação próxima`,
    mensagem: `${competenciaLegivel(dados.competencia)} · ${valor} · ${prazo} (${dataBr}).`,
    dados: {
      mensalidadeId: dados.mensalidadeId,
      alunoNome: dados.alunoNome,
      competencia: dados.competencia,
      vencimentoEm: dados.vencimentoEm.toISOString(),
      diasParaVencer: dados.diasParaVencer,
    },
    chaveDeduplicacao: `venc:admin:${dados.mensalidadeId}:${marco}`,
  });

  return { aluno: Boolean(paraAluno), admin: Boolean(paraAdmin) };
}

export async function notificarAulaCancelada(dados: {
  alunoIds: string[];
  turmaNome: string;
  inicioEm: Date;
  aulaId: string;
  motivo: string | null;
}): Promise<number> {
  const dataBr = dados.inicioEm.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return criarNotificacoes(
    dados.alunoIds.map((alunoId) => ({
      publico: PublicoNotificacao.ALUNO,
      alunoId,
      tipo: TipoNotificacao.AULA_CANCELADA,
      titulo: 'Aula cancelada',
      mensagem: `A aula de ${dados.turmaNome} em ${dataBr} foi cancelada.${
        dados.motivo ? ` Motivo: ${dados.motivo}` : ''
      }`,
      dados: { aulaId: dados.aulaId },
      chaveDeduplicacao: `aula-cancelada:${dados.aulaId}:${alunoId}`,
    })),
  );
}

export async function notificarVagaLiberada(dados: {
  alunoId: string;
  turmaNome: string;
  inicioEm: Date;
  aulaId: string;
}): Promise<void> {
  const dataBr = dados.inicioEm.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  await criarNotificacao({
    publico: PublicoNotificacao.ALUNO,
    alunoId: dados.alunoId,
    tipo: TipoNotificacao.VAGA_LIBERADA,
    titulo: 'Sua vaga foi confirmada',
    mensagem: `Abriu vaga em ${dados.turmaNome} (${dataBr}) e você saiu da lista de espera.`,
    dados: { aulaId: dados.aulaId },
    chaveDeduplicacao: `vaga:${dados.aulaId}:${dados.alunoId}`,
  });
}
