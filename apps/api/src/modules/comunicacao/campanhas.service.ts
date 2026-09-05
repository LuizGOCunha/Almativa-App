import {
  CanalNotificacao,
  PublicoNotificacao,
  StatusCampanha,
  TipoNotificacao,
  type CampanhaDto,
  type SegmentoCampanha,
} from '@almativa/shared';
import { subDays } from 'date-fns';
import { prisma } from '../../db/prisma.js';
import { conflito, naoEncontrado } from '../../utils/erros.js';
import { CampanhaModel, FrequenciaModel, NotificacaoModel } from '../../db/models/index.js';
import { mapCampanha } from '../comum/mapeadores-eventos.js';
import { criarNotificacao } from './notificacoes.service.js';

/**
 * Resolve o segmento em uma lista de alunos.
 * Os filtros de cadastro/financeiro vem do Postgres; o de inatividade
 * (sem frequencia ha N dias) vem do Mongo.
 */
export async function resolverSegmento(
  segmento: SegmentoCampanha,
): Promise<{ id: string; nome: string; email: string | null }[]> {
  const where: Record<string, unknown> = {};

  if (segmento.alunoIds?.length) {
    where['id'] = { in: segmento.alunoIds };
  }
  if (segmento.statusAluno?.length) {
    where['status'] = { in: segmento.statusAluno };
  }
  if (segmento.modalidadeSlugs?.length) {
    where['matriculas'] = {
      some: { status: 'ATIVA', plano: { modalidade: { slug: { in: segmento.modalidadeSlugs } } } },
    };
  }
  if (segmento.comMensalidadeVencida) {
    where['mensalidades'] = { some: { status: 'VENCIDA' } };
  }

  let alunos = await prisma.aluno.findMany({
    where,
    select: { id: true, nome: true, email: true },
    orderBy: { nome: 'asc' },
  });

  if (segmento.semFrequenciaDesdeDias && segmento.semFrequenciaDesdeDias > 0) {
    const corte = subDays(new Date(), segmento.semFrequenciaDesdeDias);
    const ativos = await FrequenciaModel.distinct('alunoId', {
      status: 'PRESENTE',
      inicioEm: { $gte: corte },
      alunoId: { $in: alunos.map((a) => a.id) },
    });
    const comFrequencia = new Set(ativos as string[]);
    alunos = alunos.filter((a) => !comFrequencia.has(a.id));
  }

  return alunos;
}

export async function listarCampanhas(status?: StatusCampanha): Promise<CampanhaDto[]> {
  const docs = await CampanhaModel.find(status ? { status } : {}).sort({ criadoEm: -1 }).limit(200);
  return docs.map(mapCampanha);
}

export async function obterCampanha(id: string): Promise<CampanhaDto> {
  const doc = await CampanhaModel.findById(id);
  if (!doc) throw naoEncontrado('Campanha', id);
  return mapCampanha(doc);
}

export async function criarCampanha(
  dados: {
    nome: string;
    descricao: string | null;
    mensagemTitulo: string;
    mensagemCorpo: string;
    canais: CanalNotificacao[];
    segmento: SegmentoCampanha;
    agendadaPara: string | null;
  },
  criadoPor: string,
): Promise<CampanhaDto> {
  const alcancados = await resolverSegmento(dados.segmento);

  const doc = await CampanhaModel.create({
    ...dados,
    agendadaPara: dados.agendadaPara ? new Date(dados.agendadaPara) : null,
    status: dados.agendadaPara ? StatusCampanha.AGENDADA : StatusCampanha.RASCUNHO,
    metricas: { alcancados: alcancados.length, enviados: 0, lidos: 0 },
    criadoPor,
  });

  return mapCampanha(doc);
}

export async function atualizarCampanha(id: string, dados: Record<string, unknown>): Promise<CampanhaDto> {
  const doc = await CampanhaModel.findById(id);
  if (!doc) throw naoEncontrado('Campanha', id);
  if (doc.status === StatusCampanha.ENVIADA) throw conflito('Campanha já enviada não pode ser alterada.');

  const atualizada = await CampanhaModel.findByIdAndUpdate(id, { $set: dados }, { new: true });
  return mapCampanha(atualizada!);
}

/** Materializa a campanha como notificacoes na area do aluno. */
export async function enviarCampanha(id: string): Promise<{ enviados: number; alcancados: number }> {
  const campanha = await CampanhaModel.findById(id);
  if (!campanha) throw naoEncontrado('Campanha', id);
  if (campanha.status === StatusCampanha.ENVIADA) throw conflito('Esta campanha já foi enviada.');

  campanha.status = StatusCampanha.ENVIANDO;
  await campanha.save();

  const alunos = await resolverSegmento((campanha.segmento ?? {}) as SegmentoCampanha);
  let enviados = 0;

  for (const aluno of alunos) {
    const criada = await criarNotificacao({
      publico: PublicoNotificacao.ALUNO,
      alunoId: aluno.id,
      tipo: TipoNotificacao.CAMPANHA,
      titulo: campanha.mensagemTitulo,
      mensagem: campanha.mensagemCorpo.replaceAll('{{nome}}', aluno.nome.split(' ')[0]),
      canais: campanha.canais as CanalNotificacao[],
      campanhaId: String(campanha._id),
      dados: { campanha: campanha.nome },
      chaveDeduplicacao: `campanha:${campanha._id}:${aluno.id}`,
    });
    if (criada) enviados++;
  }

  campanha.status = StatusCampanha.ENVIADA;
  campanha.enviadaEm = new Date();
  campanha.metricas = { alcancados: alunos.length, enviados, lidos: 0 };
  await campanha.save();

  return { enviados, alcancados: alunos.length };
}

export async function cancelarCampanha(id: string): Promise<CampanhaDto> {
  const doc = await CampanhaModel.findById(id);
  if (!doc) throw naoEncontrado('Campanha', id);
  if (doc.status === StatusCampanha.ENVIADA) throw conflito('Campanha já enviada não pode ser cancelada.');

  doc.status = StatusCampanha.CANCELADA;
  await doc.save();
  return mapCampanha(doc);
}

/** Atualiza a metrica de leitura consultando as notificacoes geradas. */
export async function atualizarMetricas(id: string): Promise<CampanhaDto> {
  const campanha = await CampanhaModel.findById(id);
  if (!campanha) throw naoEncontrado('Campanha', id);

  const lidos = await NotificacaoModel.countDocuments({ campanhaId: id, lidaEm: { $ne: null } });
  campanha.metricas = { ...campanha.metricas, lidos };
  await campanha.save();

  return mapCampanha(campanha);
}
