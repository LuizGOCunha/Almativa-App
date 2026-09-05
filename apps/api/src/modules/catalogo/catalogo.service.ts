import { prisma } from '../../db/prisma.js';
import { naoEncontrado, conflito } from '../../utils/erros.js';
import { mapInstrutor, mapModalidade, mapPlano, mapTurma } from '../comum/mapeadores.js';

/* ----------------------------- Modalidades ----------------------------- */

export async function listarModalidades(apenasAtivas = false) {
  const registros = await prisma.modalidade.findMany({
    where: apenasAtivas ? { ativo: true } : {},
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
  });
  return registros.map(mapModalidade);
}

export async function criarModalidade(dados: Parameters<typeof prisma.modalidade.create>[0]['data']) {
  return mapModalidade(await prisma.modalidade.create({ data: dados }));
}

export async function atualizarModalidade(id: string, dados: Record<string, unknown>) {
  const existe = await prisma.modalidade.findUnique({ where: { id } });
  if (!existe) throw naoEncontrado('Modalidade', id);
  return mapModalidade(await prisma.modalidade.update({ where: { id }, data: dados }));
}

export async function removerModalidade(id: string) {
  const emUso = await prisma.turma.count({ where: { modalidadeId: id } });
  if (emUso > 0) {
    throw conflito('Existem turmas nesta modalidade. Desative-a em vez de excluir.');
  }
  await prisma.modalidade.delete({ where: { id } });
}

/* ------------------------------ Instrutores ---------------------------- */

export async function listarInstrutores(apenasAtivos = false) {
  const registros = await prisma.instrutor.findMany({
    where: apenasAtivos ? { ativo: true } : {},
    include: { modalidades: true },
    orderBy: { nome: 'asc' },
  });
  return registros.map(mapInstrutor);
}

export async function obterInstrutor(id: string) {
  const registro = await prisma.instrutor.findUnique({ where: { id }, include: { modalidades: true } });
  if (!registro) throw naoEncontrado('Instrutor', id);
  return mapInstrutor(registro);
}

export async function criarInstrutor(dados: Record<string, unknown> & { modalidadeIds?: string[] }) {
  const { modalidadeIds = [], ...resto } = dados;
  const registro = await prisma.instrutor.create({
    data: {
      ...(resto as { nome: string }),
      modalidades: { connect: modalidadeIds.map((id) => ({ id })) },
    },
    include: { modalidades: true },
  });
  return mapInstrutor(registro);
}

export async function atualizarInstrutor(
  id: string,
  dados: Record<string, unknown> & { modalidadeIds?: string[] },
) {
  const { modalidadeIds, ...resto } = dados;
  const existe = await prisma.instrutor.findUnique({ where: { id } });
  if (!existe) throw naoEncontrado('Instrutor', id);

  const registro = await prisma.instrutor.update({
    where: { id },
    data: {
      ...resto,
      ...(modalidadeIds ? { modalidades: { set: modalidadeIds.map((mid) => ({ id: mid })) } } : {}),
    },
    include: { modalidades: true },
  });
  return mapInstrutor(registro);
}

export async function removerInstrutor(id: string) {
  await prisma.instrutor.update({ where: { id }, data: { ativo: false } });
}

/* -------------------------------- Planos ------------------------------- */

export async function listarPlanos(apenasAtivos = false) {
  const registros = await prisma.plano.findMany({
    where: apenasAtivos ? { ativo: true } : {},
    include: { modalidade: true },
    orderBy: [{ ordem: 'asc' }, { valorCentavos: 'asc' }],
  });
  return registros.map(mapPlano);
}

export async function obterPlano(id: string) {
  const registro = await prisma.plano.findUnique({ where: { id }, include: { modalidade: true } });
  if (!registro) throw naoEncontrado('Plano', id);
  return mapPlano(registro);
}

export async function criarPlano(dados: Record<string, unknown>) {
  const registro = await prisma.plano.create({
    data: dados as { nome: string; valorCentavos: number },
    include: { modalidade: true },
  });
  return mapPlano(registro);
}

export async function atualizarPlano(id: string, dados: Record<string, unknown>) {
  const existe = await prisma.plano.findUnique({ where: { id } });
  if (!existe) throw naoEncontrado('Plano', id);
  const registro = await prisma.plano.update({
    where: { id },
    data: dados,
    include: { modalidade: true },
  });
  return mapPlano(registro);
}

export async function removerPlano(id: string) {
  const emUso = await prisma.matricula.count({ where: { planoId: id, status: 'ATIVA' } });
  if (emUso > 0) throw conflito('Existem matrículas ativas neste plano. Desative-o em vez de excluir.');
  await prisma.plano.update({ where: { id }, data: { ativo: false } });
}

/* -------------------------------- Turmas ------------------------------- */

const incluirTurma = {
  modalidade: true,
  instrutor: { include: { modalidades: true } },
} as const;

export async function listarTurmas(filtros: { ativo?: boolean; modalidadeId?: string } = {}) {
  const registros = await prisma.turma.findMany({
    where: {
      ...(filtros.ativo !== undefined ? { ativo: filtros.ativo } : {}),
      ...(filtros.modalidadeId ? { modalidadeId: filtros.modalidadeId } : {}),
    },
    include: incluirTurma,
    orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
  });
  return registros.map(mapTurma);
}

export async function obterTurma(id: string) {
  const registro = await prisma.turma.findUnique({ where: { id }, include: incluirTurma });
  if (!registro) throw naoEncontrado('Turma', id);
  return mapTurma(registro);
}

/** Impede sobreposicao de horario na mesma sala e no mesmo dia. */
async function conferirConflitoDeSala(dados: {
  id?: string;
  sala: string | null;
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
}) {
  if (!dados.sala) return;
  const concorrentes = await prisma.turma.findMany({
    where: {
      sala: dados.sala,
      diaSemana: dados.diaSemana,
      ativo: true,
      ...(dados.id ? { id: { not: dados.id } } : {}),
    },
    select: { id: true, nome: true, horaInicio: true, horaFim: true },
  });

  const colide = concorrentes.find(
    (t) => dados.horaInicio < t.horaFim && dados.horaFim > t.horaInicio,
  );
  if (colide) {
    throw conflito(
      `A sala ${dados.sala} já tem a turma "${colide.nome}" das ${colide.horaInicio} às ${colide.horaFim} neste dia.`,
    );
  }
}

export async function criarTurma(dados: Record<string, unknown>) {
  const entrada = dados as {
    sala: string | null;
    diaSemana: number;
    horaInicio: string;
    horaFim: string;
    nome: string;
    modalidadeId: string;
  };
  await conferirConflitoDeSala(entrada);
  const registro = await prisma.turma.create({ data: entrada, include: incluirTurma });
  return mapTurma(registro);
}

export async function atualizarTurma(id: string, dados: Record<string, unknown>) {
  const atual = await prisma.turma.findUnique({ where: { id } });
  if (!atual) throw naoEncontrado('Turma', id);

  const entrada = dados as Partial<{
    sala: string | null;
    diaSemana: number;
    horaInicio: string;
    horaFim: string;
  }>;

  await conferirConflitoDeSala({
    id,
    sala: entrada.sala !== undefined ? entrada.sala : atual.sala,
    diaSemana: entrada.diaSemana ?? atual.diaSemana,
    horaInicio: entrada.horaInicio ?? atual.horaInicio,
    horaFim: entrada.horaFim ?? atual.horaFim,
  });

  const registro = await prisma.turma.update({ where: { id }, data: dados, include: incluirTurma });
  return mapTurma(registro);
}

export async function removerTurma(id: string) {
  const futuras = await prisma.aula.count({
    where: { turmaId: id, inicioEm: { gte: new Date() }, status: 'AGENDADA' },
  });
  if (futuras > 0) {
    // Cancela as ocorrencias futuras e desativa a turma.
    await prisma.aula.updateMany({
      where: { turmaId: id, inicioEm: { gte: new Date() }, status: 'AGENDADA' },
      data: { status: 'CANCELADA' },
    });
  }
  await prisma.turma.update({ where: { id }, data: { ativo: false } });
}
