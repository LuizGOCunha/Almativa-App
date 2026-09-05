import { StatusCheckin, StatusFrequencia, type AulaDto } from '@almativa/shared';
import { addDays } from 'date-fns';
import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../db/prisma.js';
import { conflito, naoEncontrado } from '../../utils/erros.js';
import { comHora, fimDoDiaLocal, inicioDoDiaLocal } from '../../utils/datas.js';
import { CheckinModel, FrequenciaModel } from '../../db/models/index.js';
import { mapAula } from '../comum/mapeadores.js';
import { mapCheckin, mapFrequencia } from '../comum/mapeadores-eventos.js';
import { notificarAulaCancelada } from '../comunicacao/notificacoes.service.js';

const incluirAula = {
  turma: { include: { modalidade: true, instrutor: { include: { modalidades: true } } } },
  instrutor: { include: { modalidades: true } },
} satisfies Prisma.AulaInclude;

/** Conta check-ins ativos e presencas de um conjunto de aulas em uma so ida ao Mongo. */
async function agregadosDasAulas(aulaIds: string[]) {
  if (aulaIds.length === 0) return new Map<string, { checkins: number; presentes: number }>();

  const [checkins, presencas] = await Promise.all([
    CheckinModel.aggregate<{ _id: string; total: number }>([
      { $match: { aulaId: { $in: aulaIds }, status: { $ne: StatusCheckin.CANCELADO } } },
      { $group: { _id: '$aulaId', total: { $sum: 1 } } },
    ]),
    FrequenciaModel.aggregate<{ _id: string; total: number }>([
      { $match: { aulaId: { $in: aulaIds }, status: StatusFrequencia.PRESENTE } },
      { $group: { _id: '$aulaId', total: { $sum: 1 } } },
    ]),
  ]);

  const mapa = new Map<string, { checkins: number; presentes: number }>();
  for (const id of aulaIds) mapa.set(id, { checkins: 0, presentes: 0 });
  for (const c of checkins) mapa.set(c._id, { ...mapa.get(c._id)!, checkins: c.total });
  for (const p of presencas) mapa.set(p._id, { ...mapa.get(p._id)!, presentes: p.total });
  return mapa;
}

export interface FiltrosAula {
  de: string;
  ate: string;
  turmaId?: string;
  modalidadeId?: string;
  instrutorId?: string;
  status?: 'AGENDADA' | 'EM_ANDAMENTO' | 'REALIZADA' | 'CANCELADA';
}

export async function listarAulas(filtros: FiltrosAula): Promise<AulaDto[]> {
  const inicio = inicioDoDiaLocal(filtros.de);
  const fim = fimDoDiaLocal(filtros.ate);

  const registros = await prisma.aula.findMany({
    where: {
      inicioEm: { gte: inicio, lte: fim },
      ...(filtros.turmaId ? { turmaId: filtros.turmaId } : {}),
      ...(filtros.status ? { status: filtros.status } : {}),
      ...(filtros.instrutorId
        ? { OR: [{ instrutorId: filtros.instrutorId }, { turma: { instrutorId: filtros.instrutorId } }] }
        : {}),
      ...(filtros.modalidadeId ? { turma: { modalidadeId: filtros.modalidadeId } } : {}),
    },
    include: incluirAula,
    orderBy: { inicioEm: 'asc' },
  });

  const agregados = await agregadosDasAulas(registros.map((a) => a.id));
  return registros.map((a) => mapAula(a, agregados.get(a.id)));
}

export async function obterAula(id: string) {
  const registro = await prisma.aula.findUnique({ where: { id }, include: incluirAula });
  if (!registro) throw naoEncontrado('Aula', id);

  const [checkins, frequencias] = await Promise.all([
    CheckinModel.find({ aulaId: id, status: { $ne: StatusCheckin.CANCELADO } }).sort({ criadoEm: 1 }),
    FrequenciaModel.find({ aulaId: id }).sort({ alunoNome: 1 }),
  ]);

  const agregados = {
    checkins: checkins.length,
    presentes: frequencias.filter((f) => f.status === StatusFrequencia.PRESENTE).length,
  };

  return {
    ...mapAula(registro, agregados),
    listaCheckins: checkins.map(mapCheckin),
    listaFrequencia: frequencias.map(mapFrequencia),
  };
}

/**
 * Materializa as ocorrencias de aula das turmas ativas dentro do periodo.
 * Idempotente: a chave unica (turmaId, inicioEm) evita duplicar.
 */
export async function gerarAulas(
  de: string,
  ate: string,
  turmaIds?: string[],
): Promise<{ criadas: number; existentes: number; periodo: { de: string; ate: string } }> {
  const inicio = inicioDoDiaLocal(de);
  const fim = inicioDoDiaLocal(ate);

  if (fim < inicio) throw conflito('A data final precisa ser maior ou igual à inicial.');

  const turmas = await prisma.turma.findMany({
    where: { ativo: true, ...(turmaIds?.length ? { id: { in: turmaIds } } : {}) },
  });

  const paraCriar: Prisma.AulaCreateManyInput[] = [];

  for (let dia = new Date(inicio); dia <= fim; dia = addDays(dia, 1)) {
    const diaSemana = dia.getDay();
    for (const turma of turmas.filter((t) => t.diaSemana === diaSemana)) {
      paraCriar.push({
        turmaId: turma.id,
        instrutorId: turma.instrutorId,
        inicioEm: comHora(dia, turma.horaInicio),
        fimEm: comHora(dia, turma.horaFim),
        capacidade: turma.capacidade,
      });
    }
  }

  if (paraCriar.length === 0) {
    return { criadas: 0, existentes: 0, periodo: { de, ate } };
  }

  const resultado = await prisma.aula.createMany({ data: paraCriar, skipDuplicates: true });
  return {
    criadas: resultado.count,
    existentes: paraCriar.length - resultado.count,
    periodo: { de, ate },
  };
}

export async function atualizarAula(id: string, dados: Record<string, unknown>) {
  const existe = await prisma.aula.findUnique({ where: { id } });
  if (!existe) throw naoEncontrado('Aula', id);

  const registro = await prisma.aula.update({ where: { id }, data: dados, include: incluirAula });
  const agregados = await agregadosDasAulas([id]);
  return mapAula(registro, agregados.get(id));
}

/** Cancela a aula, libera os check-ins e avisa quem tinha vaga reservada. */
export async function cancelarAula(id: string, motivo: string | null, canceladoPor: string) {
  const aula = await prisma.aula.findUnique({ where: { id }, include: incluirAula });
  if (!aula) throw naoEncontrado('Aula', id);
  if (aula.status === 'CANCELADA') throw conflito('Esta aula já está cancelada.');

  const checkins = await CheckinModel.find({ aulaId: id, status: { $ne: StatusCheckin.CANCELADO } });

  await prisma.aula.update({
    where: { id },
    data: { status: 'CANCELADA', observacoes: motivo ?? aula.observacoes },
  });

  await CheckinModel.updateMany(
    { aulaId: id, status: { $ne: StatusCheckin.CANCELADO } },
    { $set: { status: StatusCheckin.CANCELADO, canceladoEm: new Date(), canceladoPor } },
  );

  if (checkins.length > 0) {
    await notificarAulaCancelada({
      alunoIds: checkins.map((c) => c.alunoId),
      turmaNome: aula.turma.nome,
      inicioEm: aula.inicioEm,
      aulaId: id,
      motivo,
    });
  }

  return { cancelada: true, checkinsLiberados: checkins.length };
}

/** Aula em andamento agora (usada pela tela da sala). */
export async function aulaAtual(margemMinutos = 15) {
  const agora = new Date();
  const inicioJanela = new Date(agora.getTime() - 120 * 60_000);
  const fimJanela = new Date(agora.getTime() + margemMinutos * 60_000);

  const registro = await prisma.aula.findFirst({
    where: {
      status: { in: ['AGENDADA', 'EM_ANDAMENTO'] },
      inicioEm: { lte: fimJanela, gte: inicioJanela },
      fimEm: { gte: agora },
    },
    include: incluirAula,
    orderBy: { inicioEm: 'asc' },
  });

  if (!registro) return null;
  const agregados = await agregadosDasAulas([registro.id]);
  return { registro, dto: mapAula(registro, agregados.get(registro.id)) };
}

export async function proximaAula(depoisDe = new Date()) {
  const registro = await prisma.aula.findFirst({
    where: { status: 'AGENDADA', inicioEm: { gt: depoisDe } },
    include: incluirAula,
    orderBy: { inicioEm: 'asc' },
  });
  if (!registro) return null;
  const agregados = await agregadosDasAulas([registro.id]);
  return { registro, dto: mapAula(registro, agregados.get(registro.id)) };
}
