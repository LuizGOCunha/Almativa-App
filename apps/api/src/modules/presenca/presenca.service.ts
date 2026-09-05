import {
  OrigemRegistro,
  StatusCheckin,
  StatusFrequencia,
  type CheckinDto,
  type FrequenciaDto,
} from '@almativa/shared';
import { prisma } from '../../db/prisma.js';
import { fimDoDiaLocal, inicioDoDiaLocal } from '../../utils/datas.js';
import { conflito, naoEncontrado, proibido, requisicaoInvalida } from '../../utils/erros.js';
import { CheckinModel, FrequenciaModel } from '../../db/models/index.js';
import { mapCheckin, mapFrequencia } from '../comum/mapeadores-eventos.js';
import { notificarVagaLiberada } from '../comunicacao/notificacoes.service.js';

const incluirAula = { turma: { include: { modalidade: true } } } as const;

/** Janela em que o check-in fica liberado antes do inicio da aula. */
const HORAS_ANTECEDENCIA_MAXIMA = 24 * 7;
/** Ate quantos minutos depois do inicio ainda aceitamos check-in. */
const MINUTOS_TOLERANCIA = 15;

async function carregarAulaOuFalhar(aulaId: string) {
  const aula = await prisma.aula.findUnique({ where: { id: aulaId }, include: incluirAula });
  if (!aula) throw naoEncontrado('Aula', aulaId);
  return aula;
}

async function carregarAlunoOuFalhar(alunoId: string) {
  const aluno = await prisma.aluno.findUnique({ where: { id: alunoId } });
  if (!aluno) throw naoEncontrado('Aluno', alunoId);
  return aluno;
}

/**
 * Check-in garante a vaga. Quando a turma lota, o aluno entra na lista de
 * espera e sobe automaticamente se alguem cancelar.
 */
export async function fazerCheckin(dados: {
  aulaId: string;
  alunoId: string;
  origem: OrigemRegistro;
  exigirMatriculaAtiva?: boolean;
}): Promise<CheckinDto> {
  const [aula, aluno] = await Promise.all([
    carregarAulaOuFalhar(dados.aulaId),
    carregarAlunoOuFalhar(dados.alunoId),
  ]);

  if (aula.status === 'CANCELADA') throw conflito('Esta aula foi cancelada.');
  if (aula.status === 'REALIZADA') throw conflito('Esta aula já foi realizada.');
  if (aluno.status !== 'ATIVO') throw proibido('Cadastro do aluno não está ativo.');

  const agora = new Date();
  const limiteAntecedencia = new Date(agora.getTime() + HORAS_ANTECEDENCIA_MAXIMA * 3_600_000);
  const limiteAtraso = new Date(aula.inicioEm.getTime() + MINUTOS_TOLERANCIA * 60_000);

  if (aula.inicioEm > limiteAntecedencia) {
    throw requisicaoInvalida('O check-in abre com no máximo 7 dias de antecedência.');
  }
  if (agora > limiteAtraso) {
    throw requisicaoInvalida('O prazo de check-in desta aula já encerrou.');
  }

  if (dados.exigirMatriculaAtiva !== false) {
    const matricula = await prisma.matricula.findFirst({
      where: {
        alunoId: dados.alunoId,
        status: 'ATIVA',
        OR: [{ plano: { modalidadeId: aula.turma.modalidadeId } }, { plano: { modalidadeId: null } }],
      },
    });
    if (!matricula) {
      throw proibido(`Você não tem matrícula ativa em ${aula.turma.modalidade.nome}.`);
    }
  }

  const existente = await CheckinModel.findOne({
    aulaId: dados.aulaId,
    alunoId: dados.alunoId,
    status: { $ne: StatusCheckin.CANCELADO },
  });
  if (existente) throw conflito('Você já fez check-in nesta aula.');

  const confirmados = await CheckinModel.countDocuments({
    aulaId: dados.aulaId,
    status: StatusCheckin.CONFIRMADO,
  });
  const naFila = await CheckinModel.countDocuments({
    aulaId: dados.aulaId,
    status: StatusCheckin.LISTA_ESPERA,
  });

  const temVaga = confirmados < aula.capacidade;

  const doc = await CheckinModel.create({
    alunoId: aluno.id,
    alunoNome: aluno.nome,
    aulaId: aula.id,
    turmaId: aula.turmaId,
    modalidadeSlug: aula.turma.modalidade.slug,
    inicioEm: aula.inicioEm,
    status: temVaga ? StatusCheckin.CONFIRMADO : StatusCheckin.LISTA_ESPERA,
    posicaoFila: temVaga ? null : naFila + 1,
    origem: dados.origem,
  });

  return mapCheckin(doc);
}

/** Cancela o check-in e promove o primeiro da lista de espera. */
export async function cancelarCheckin(dados: {
  aulaId: string;
  alunoId: string;
  canceladoPor: string;
}): Promise<{ cancelado: boolean; promovido: string | null }> {
  const checkin = await CheckinModel.findOne({
    aulaId: dados.aulaId,
    alunoId: dados.alunoId,
    status: { $ne: StatusCheckin.CANCELADO },
  });
  if (!checkin) throw naoEncontrado('Check-in');

  const eraConfirmado = checkin.status === StatusCheckin.CONFIRMADO;
  const posicaoAnterior = checkin.posicaoFila ?? 0;

  checkin.status = StatusCheckin.CANCELADO;
  checkin.canceladoEm = new Date();
  checkin.canceladoPor = dados.canceladoPor;
  await checkin.save();

  if (!eraConfirmado) {
    // Saiu da fila: reordena quem estava atras.
    await CheckinModel.updateMany(
      { aulaId: dados.aulaId, status: StatusCheckin.LISTA_ESPERA, posicaoFila: { $gt: posicaoAnterior } },
      { $inc: { posicaoFila: -1 } },
    );
    return { cancelado: true, promovido: null };
  }

  const proximo = await CheckinModel.findOne({
    aulaId: dados.aulaId,
    status: StatusCheckin.LISTA_ESPERA,
  }).sort({ posicaoFila: 1 });

  if (!proximo) return { cancelado: true, promovido: null };

  proximo.status = StatusCheckin.CONFIRMADO;
  proximo.posicaoFila = null;
  await proximo.save();

  await CheckinModel.updateMany(
    { aulaId: dados.aulaId, status: StatusCheckin.LISTA_ESPERA },
    { $inc: { posicaoFila: -1 } },
  );

  const aula = await prisma.aula.findUnique({ where: { id: dados.aulaId }, include: incluirAula });
  if (aula) {
    await notificarVagaLiberada({
      alunoId: proximo.alunoId,
      turmaNome: aula.turma.nome,
      inicioEm: aula.inicioEm,
      aulaId: aula.id,
    });
  }

  return { cancelado: true, promovido: proximo.alunoId };
}

export async function listarCheckinsDaAula(aulaId: string): Promise<CheckinDto[]> {
  const docs = await CheckinModel.find({ aulaId, status: { $ne: StatusCheckin.CANCELADO } }).sort({
    status: 1,
    posicaoFila: 1,
    criadoEm: 1,
  });
  return docs.map(mapCheckin);
}

export async function listarCheckinsDoAluno(alunoId: string, futuros = true): Promise<CheckinDto[]> {
  const docs = await CheckinModel.find({
    alunoId,
    status: { $ne: StatusCheckin.CANCELADO },
    ...(futuros ? { inicioEm: { $gte: new Date() } } : {}),
  })
    .sort({ inicioEm: futuros ? 1 : -1 })
    .limit(futuros ? 50 : 100);
  return docs.map(mapCheckin);
}

/* ------------------------------ Frequencia ----------------------------- */

/**
 * Frequencia confirma que o aluno fez a aula. Um upsert por (aula, aluno)
 * permite corrigir a chamada sem duplicar registros.
 */
export async function registrarFrequencia(dados: {
  aulaId: string;
  alunoId: string;
  status: StatusFrequencia;
  observacao: string | null;
  origem: OrigemRegistro;
  registradoPor: string;
}): Promise<FrequenciaDto> {
  const [aula, aluno] = await Promise.all([
    carregarAulaOuFalhar(dados.aulaId),
    carregarAlunoOuFalhar(dados.alunoId),
  ]);

  if (aula.status === 'CANCELADA') throw conflito('Não há chamada em uma aula cancelada.');

  const doc = await FrequenciaModel.findOneAndUpdate(
    { aulaId: dados.aulaId, alunoId: dados.alunoId },
    {
      $set: {
        alunoNome: aluno.nome,
        turmaId: aula.turmaId,
        modalidadeSlug: aula.turma.modalidade.slug,
        inicioEm: aula.inicioEm,
        status: dados.status,
        observacao: dados.observacao,
        origem: dados.origem,
        registradoPor: dados.registradoPor,
        registradoEm: new Date(),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return mapFrequencia(doc!);
}

/** Fecha a chamada da aula inteira de uma vez. */
export async function registrarFrequenciaEmLote(dados: {
  aulaId: string;
  registros: { alunoId: string; status: StatusFrequencia; observacao: string | null }[];
  origem: OrigemRegistro;
  registradoPor: string;
  finalizarAula: boolean;
}): Promise<{ registrados: number; presentes: number }> {
  const aula = await carregarAulaOuFalhar(dados.aulaId);
  if (aula.status === 'CANCELADA') throw conflito('Não há chamada em uma aula cancelada.');

  const alunos = await prisma.aluno.findMany({
    where: { id: { in: dados.registros.map((r) => r.alunoId) } },
    select: { id: true, nome: true },
  });
  const nomePorId = new Map(alunos.map((a) => [a.id, a.nome]));

  const operacoes = dados.registros
    .filter((r) => nomePorId.has(r.alunoId))
    .map((r) => ({
      updateOne: {
        filter: { aulaId: dados.aulaId, alunoId: r.alunoId },
        update: {
          $set: {
            alunoNome: nomePorId.get(r.alunoId)!,
            turmaId: aula.turmaId,
            modalidadeSlug: aula.turma.modalidade.slug,
            inicioEm: aula.inicioEm,
            status: r.status,
            observacao: r.observacao,
            origem: dados.origem,
            registradoPor: dados.registradoPor,
            registradoEm: new Date(),
          },
        },
        upsert: true,
      },
    }));

  if (operacoes.length === 0) throw requisicaoInvalida('Nenhum aluno válido na chamada.');

  await FrequenciaModel.bulkWrite(operacoes);

  if (dados.finalizarAula) {
    await prisma.aula.update({ where: { id: dados.aulaId }, data: { status: 'REALIZADA' } });
  }

  return {
    registrados: operacoes.length,
    presentes: dados.registros.filter((r) => r.status === StatusFrequencia.PRESENTE).length,
  };
}

export async function listarFrequenciaDaAula(aulaId: string): Promise<FrequenciaDto[]> {
  const docs = await FrequenciaModel.find({ aulaId }).sort({ alunoNome: 1 });
  return docs.map(mapFrequencia);
}

export interface FiltrosRelatorio {
  de: string;
  ate: string;
  alunoId?: string;
  turmaId?: string;
  modalidadeSlug?: string;
}

/** Relatorio de frequencia por aluno no periodo. */
export async function relatorioFrequencia(filtros: FiltrosRelatorio) {
  const inicio = inicioDoDiaLocal(filtros.de);
  const fim = fimDoDiaLocal(filtros.ate);

  const correspondencia: Record<string, unknown> = { inicioEm: { $gte: inicio, $lte: fim } };
  if (filtros.alunoId) correspondencia['alunoId'] = filtros.alunoId;
  if (filtros.turmaId) correspondencia['turmaId'] = filtros.turmaId;
  if (filtros.modalidadeSlug) correspondencia['modalidadeSlug'] = filtros.modalidadeSlug;

  const linhas = await FrequenciaModel.aggregate<{
    _id: string;
    alunoNome: string;
    presencas: number;
    ausencias: number;
    justificadas: number;
    ultimaAula: Date;
  }>([
    { $match: correspondencia },
    {
      $group: {
        _id: '$alunoId',
        alunoNome: { $last: '$alunoNome' },
        presencas: { $sum: { $cond: [{ $eq: ['$status', StatusFrequencia.PRESENTE] }, 1, 0] } },
        ausencias: { $sum: { $cond: [{ $eq: ['$status', StatusFrequencia.AUSENTE] }, 1, 0] } },
        justificadas: { $sum: { $cond: [{ $eq: ['$status', StatusFrequencia.JUSTIFICADA] }, 1, 0] } },
        ultimaAula: { $max: '$inicioEm' },
      },
    },
    { $sort: { presencas: -1 } },
  ]);

  return linhas.map((l) => {
    const total = l.presencas + l.ausencias + l.justificadas;
    return {
      alunoId: l._id,
      alunoNome: l.alunoNome,
      presencas: l.presencas,
      ausencias: l.ausencias,
      justificadas: l.justificadas,
      totalAulas: total,
      aproveitamento: total > 0 ? Math.round((l.presencas / total) * 100) : 0,
      ultimaAula: l.ultimaAula ? new Date(l.ultimaAula).toISOString() : null,
    };
  });
}

export async function listarFrequenciaDoAluno(alunoId: string, limite = 60): Promise<FrequenciaDto[]> {
  const docs = await FrequenciaModel.find({ alunoId }).sort({ inicioEm: -1 }).limit(limite);
  return docs.map(mapFrequencia);
}
