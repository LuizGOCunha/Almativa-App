import {
  MESES_POR_PERIODICIDADE,
  TipoEventoPagamento,
  type MensalidadeDto,
  type Paginado,
  type PagamentoDto,
} from '@almativa/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../db/prisma.js';
import { conflito, naoEncontrado, requisicaoInvalida } from '../../utils/erros.js';
import {
  deIsoData,
  inicioDaCompetencia,
  fimDoDiaLocal,
  hojeComoData,
  inicioDoDiaLocal,
  vencimentoDaCompetencia,
} from '../../utils/datas.js';
import { mapMensalidade, mapPagamento } from '../comum/mapeadores.js';
import { registrarEventoPagamento } from './eventos.js';
import { notificarPagamentoConfirmado } from '../comunicacao/notificacoes.service.js';

const incluirMensalidade = {
  aluno: true,
  matricula: { include: { plano: true } },
  pagamentos: { orderBy: { pagoEm: 'desc' as const } },
} satisfies Prisma.MensalidadeInclude;

export interface FiltrosMensalidade {
  alunoId?: string;
  competencia?: string;
  status?: 'ABERTA' | 'PAGA' | 'VENCIDA' | 'CANCELADA';
  vencimentoDe?: string;
  vencimentoAte?: string;
  busca?: string;
  pagina: number;
  porPagina: number;
}

export async function listarMensalidades(filtros: FiltrosMensalidade): Promise<Paginado<MensalidadeDto>> {
  const where: Prisma.MensalidadeWhereInput = {};
  if (filtros.alunoId) where.alunoId = filtros.alunoId;
  if (filtros.competencia) where.competencia = filtros.competencia;
  if (filtros.status) where.status = filtros.status;
  if (filtros.busca) {
    where.aluno = { nome: { contains: filtros.busca.trim(), mode: 'insensitive' } };
  }
  if (filtros.vencimentoDe || filtros.vencimentoAte) {
    where.vencimentoEm = {
      ...(filtros.vencimentoDe ? { gte: deIsoData(filtros.vencimentoDe) } : {}),
      ...(filtros.vencimentoAte ? { lte: deIsoData(filtros.vencimentoAte) } : {}),
    };
  }

  const pular = (filtros.pagina - 1) * filtros.porPagina;
  const [registros, total] = await Promise.all([
    prisma.mensalidade.findMany({
      where,
      include: incluirMensalidade,
      orderBy: [{ vencimentoEm: 'desc' }, { criadoEm: 'desc' }],
      skip: pular,
      take: filtros.porPagina,
    }),
    prisma.mensalidade.count({ where }),
  ]);

  return {
    itens: registros.map((m) => mapMensalidade(m)),
    total,
    pagina: filtros.pagina,
    porPagina: filtros.porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / filtros.porPagina)),
  };
}

export async function obterMensalidade(id: string): Promise<MensalidadeDto> {
  const registro = await prisma.mensalidade.findUnique({ where: { id }, include: incluirMensalidade });
  if (!registro) throw naoEncontrado('Mensalidade', id);
  return mapMensalidade(registro);
}

/**
 * Gera as mensalidades de uma competencia para as matriculas ativas.
 * Idempotente: a chave unica (matriculaId, competencia) impede duplicidade.
 * Planos nao mensais so cobram no mes de aniversario do ciclo.
 */
export async function gerarMensalidades(
  competencia: string,
  opcoes: { matriculaIds?: string[]; sobrescrever?: boolean } = {},
  registradoPor?: string,
): Promise<{ geradas: number; ignoradas: number; competencia: string }> {
  const matriculas = await prisma.matricula.findMany({
    where: {
      status: 'ATIVA',
      ...(opcoes.matriculaIds?.length ? { id: { in: opcoes.matriculaIds } } : {}),
    },
    include: { plano: true, aluno: true },
  });

  const inicioCompetencia = inicioDaCompetencia(competencia);
  let geradas = 0;
  let ignoradas = 0;

  for (const matricula of matriculas) {
    // Matricula que ainda nao comecou ou ja terminou nao gera cobranca.
    if (matricula.dataInicio > inicioCompetencia) {
      ignoradas++;
      continue;
    }
    if (matricula.dataFim && matricula.dataFim < inicioCompetencia) {
      ignoradas++;
      continue;
    }

    // Plano trimestral/semestral/anual so cobra no mes do ciclo.
    const passo = MESES_POR_PERIODICIDADE[matricula.plano.periodicidade];
    if (passo > 1) {
      const inicio = matricula.dataInicio;
      const mesesDesdeInicio =
        (inicioCompetencia.getUTCFullYear() - inicio.getUTCFullYear()) * 12 +
        (inicioCompetencia.getUTCMonth() - inicio.getUTCMonth());
      if (mesesDesdeInicio % passo !== 0) {
        ignoradas++;
        continue;
      }
    }

    const existente = await prisma.mensalidade.findUnique({
      where: { matriculaId_competencia: { matriculaId: matricula.id, competencia } },
    });

    if (existente && !opcoes.sobrescrever) {
      ignoradas++;
      continue;
    }
    if (existente && existente.status !== 'ABERTA') {
      ignoradas++;
      continue;
    }

    const dados = {
      matriculaId: matricula.id,
      alunoId: matricula.alunoId,
      competencia,
      valorCentavos: matricula.plano.valorCentavos,
      vencimentoEm: vencimentoDaCompetencia(competencia, matricula.diaVencimento),
    };

    const mensalidade = existente
      ? await prisma.mensalidade.update({ where: { id: existente.id }, data: dados })
      : await prisma.mensalidade.create({ data: dados });

    geradas++;

    await registrarEventoPagamento({
      tipo: TipoEventoPagamento.MENSALIDADE_GERADA,
      alunoId: matricula.alunoId,
      alunoNome: matricula.aluno.nome,
      mensalidadeId: mensalidade.id,
      matriculaId: matricula.id,
      valorCentavos: mensalidade.valorCentavos,
      competencia,
      registradoPor: registradoPor ?? null,
      payload: { periodicidade: matricula.plano.periodicidade, plano: matricula.plano.nome },
    });
  }

  return { geradas, ignoradas, competencia };
}

export async function criarMensalidadeAvulsa(
  dados: { matriculaId: string; competencia: string; valorCentavos?: number; vencimentoEm?: string; observacao: string | null },
  registradoPor?: string,
): Promise<MensalidadeDto> {
  const matricula = await prisma.matricula.findUnique({
    where: { id: dados.matriculaId },
    include: { plano: true, aluno: true },
  });
  if (!matricula) throw naoEncontrado('Matrícula', dados.matriculaId);

  const duplicada = await prisma.mensalidade.findUnique({
    where: { matriculaId_competencia: { matriculaId: dados.matriculaId, competencia: dados.competencia } },
  });
  if (duplicada) throw conflito(`Já existe mensalidade de ${dados.competencia} para esta matrícula.`);

  const mensalidade = await prisma.mensalidade.create({
    data: {
      matriculaId: matricula.id,
      alunoId: matricula.alunoId,
      competencia: dados.competencia,
      valorCentavos: dados.valorCentavos ?? matricula.plano.valorCentavos,
      vencimentoEm: dados.vencimentoEm
        ? deIsoData(dados.vencimentoEm)
        : vencimentoDaCompetencia(dados.competencia, matricula.diaVencimento),
      observacao: dados.observacao,
    },
    include: incluirMensalidade,
  });

  await registrarEventoPagamento({
    tipo: TipoEventoPagamento.MENSALIDADE_GERADA,
    alunoId: matricula.alunoId,
    alunoNome: matricula.aluno.nome,
    mensalidadeId: mensalidade.id,
    matriculaId: matricula.id,
    valorCentavos: mensalidade.valorCentavos,
    competencia: dados.competencia,
    registradoPor: registradoPor ?? null,
    payload: { origem: 'avulsa' },
  });

  return mapMensalidade(mensalidade);
}

export async function cancelarMensalidade(id: string, registradoPor?: string): Promise<MensalidadeDto> {
  const mensalidade = await prisma.mensalidade.findUnique({ where: { id }, include: incluirMensalidade });
  if (!mensalidade) throw naoEncontrado('Mensalidade', id);
  if (mensalidade.status === 'PAGA') throw conflito('Não é possível cancelar uma mensalidade já paga.');

  const atualizada = await prisma.mensalidade.update({
    where: { id },
    data: { status: 'CANCELADA' },
    include: incluirMensalidade,
  });

  await registrarEventoPagamento({
    tipo: TipoEventoPagamento.MENSALIDADE_CANCELADA,
    alunoId: mensalidade.alunoId,
    alunoNome: mensalidade.aluno?.nome ?? null,
    mensalidadeId: id,
    valorCentavos: mensalidade.valorCentavos,
    competencia: mensalidade.competencia,
    registradoPor: registradoPor ?? null,
  });

  return mapMensalidade(atualizada);
}

/* ------------------------------ Pagamentos ----------------------------- */

/**
 * Registra um pagamento. Quando a soma dos pagamentos alcanca o valor da
 * mensalidade, ela e quitada e o aluno recebe a notificacao de confirmacao.
 */
export async function registrarPagamento(
  mensalidadeId: string,
  dados: {
    valorCentavos: number;
    metodo: 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'DINHEIRO' | 'BOLETO' | 'TRANSFERENCIA';
    pagoEm?: string;
    referenciaExterna: string | null;
    observacao: string | null;
  },
  registradoPorId?: string,
): Promise<MensalidadeDto> {
  const mensalidade = await prisma.mensalidade.findUnique({
    where: { id: mensalidadeId },
    include: incluirMensalidade,
  });
  if (!mensalidade) throw naoEncontrado('Mensalidade', mensalidadeId);
  if (mensalidade.status === 'CANCELADA') throw conflito('Esta mensalidade está cancelada.');

  const jaPago = mensalidade.pagamentos
    .filter((p) => !p.estornadoEm)
    .reduce((total, p) => total + p.valorCentavos, 0);
  const restante = mensalidade.valorCentavos - jaPago;

  if (restante <= 0) throw conflito('Esta mensalidade já está quitada.');
  if (dados.valorCentavos > restante) {
    throw requisicaoInvalida(
      `O valor excede o saldo em aberto (${(restante / 100).toFixed(2)}). Ajuste o valor ou o da mensalidade.`,
    );
  }

  const pagoEm = dados.pagoEm ? new Date(dados.pagoEm) : new Date();

  const atualizada = await prisma.$transaction(async (tx) => {
    const pagamento = await tx.pagamento.create({
      data: {
        mensalidadeId,
        alunoId: mensalidade.alunoId,
        valorCentavos: dados.valorCentavos,
        metodo: dados.metodo,
        pagoEm,
        referenciaExterna: dados.referenciaExterna,
        observacao: dados.observacao,
        registradoPorId: registradoPorId ?? null,
      },
    });

    const quitada = jaPago + dados.valorCentavos >= mensalidade.valorCentavos;
    const registro = await tx.mensalidade.update({
      where: { id: mensalidadeId },
      data: quitada ? { status: 'PAGA', pagoEm } : {},
      include: incluirMensalidade,
    });

    return { registro, pagamento, quitada };
  });

  await registrarEventoPagamento({
    tipo: TipoEventoPagamento.PAGAMENTO_REGISTRADO,
    alunoId: mensalidade.alunoId,
    alunoNome: mensalidade.aluno?.nome ?? null,
    mensalidadeId,
    pagamentoId: atualizada.pagamento.id,
    matriculaId: mensalidade.matriculaId,
    valorCentavos: dados.valorCentavos,
    competencia: mensalidade.competencia,
    registradoPor: registradoPorId ?? null,
    ocorridoEm: pagoEm,
    payload: { metodo: dados.metodo, quitada: atualizada.quitada, restanteAntes: restante },
  });

  if (atualizada.quitada) {
    await notificarPagamentoConfirmado({
      alunoId: mensalidade.alunoId,
      alunoNome: mensalidade.aluno?.nome ?? 'Aluno',
      competencia: mensalidade.competencia,
      valorCentavos: mensalidade.valorCentavos,
      mensalidadeId,
    });
  }

  return mapMensalidade(atualizada.registro);
}

export async function estornarPagamento(pagamentoId: string, registradoPorId?: string): Promise<void> {
  const pagamento = await prisma.pagamento.findUnique({
    where: { id: pagamentoId },
    include: { mensalidade: true, aluno: true },
  });
  if (!pagamento) throw naoEncontrado('Pagamento', pagamentoId);
  if (pagamento.estornadoEm) throw conflito('Este pagamento já foi estornado.');

  await prisma.$transaction([
    prisma.pagamento.update({ where: { id: pagamentoId }, data: { estornadoEm: new Date() } }),
    prisma.mensalidade.update({
      where: { id: pagamento.mensalidadeId },
      data: {
        status: pagamento.mensalidade.vencimentoEm < hojeComoData() ? 'VENCIDA' : 'ABERTA',
        pagoEm: null,
      },
    }),
  ]);

  await registrarEventoPagamento({
    tipo: TipoEventoPagamento.PAGAMENTO_ESTORNADO,
    alunoId: pagamento.alunoId,
    alunoNome: pagamento.aluno.nome,
    mensalidadeId: pagamento.mensalidadeId,
    pagamentoId,
    valorCentavos: pagamento.valorCentavos,
    competencia: pagamento.mensalidade.competencia,
    registradoPor: registradoPorId ?? null,
  });
}

export async function listarPagamentos(filtros: {
  alunoId?: string;
  de?: string;
  ate?: string;
  metodo?: string;
  pagina: number;
  porPagina: number;
}): Promise<Paginado<PagamentoDto>> {
  const where: Prisma.PagamentoWhereInput = { estornadoEm: null };
  if (filtros.alunoId) where.alunoId = filtros.alunoId;
  if (filtros.metodo) where.metodo = filtros.metodo as Prisma.PagamentoWhereInput['metodo'];
  if (filtros.de || filtros.ate) {
    where.pagoEm = {
      ...(filtros.de ? { gte: inicioDoDiaLocal(filtros.de) } : {}),
      ...(filtros.ate ? { lte: fimDoDiaLocal(filtros.ate) } : {}),
    };
  }

  const pular = (filtros.pagina - 1) * filtros.porPagina;
  const [registros, total] = await Promise.all([
    prisma.pagamento.findMany({ where, orderBy: { pagoEm: 'desc' }, skip: pular, take: filtros.porPagina }),
    prisma.pagamento.count({ where }),
  ]);

  return {
    itens: registros.map(mapPagamento),
    total,
    pagina: filtros.pagina,
    porPagina: filtros.porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / filtros.porPagina)),
  };
}

/** Marca como VENCIDA toda mensalidade aberta cujo vencimento ja passou. */
export async function marcarVencidas(): Promise<number> {
  const hoje = hojeComoData();

  const vencidas = await prisma.mensalidade.findMany({
    where: { status: 'ABERTA', vencimentoEm: { lt: hoje } },
    include: { aluno: true },
  });

  if (vencidas.length === 0) return 0;

  await prisma.mensalidade.updateMany({
    where: { id: { in: vencidas.map((m) => m.id) } },
    data: { status: 'VENCIDA' },
  });

  for (const m of vencidas) {
    await registrarEventoPagamento({
      tipo: TipoEventoPagamento.MENSALIDADE_VENCIDA,
      alunoId: m.alunoId,
      alunoNome: m.aluno.nome,
      mensalidadeId: m.id,
      valorCentavos: m.valorCentavos,
      competencia: m.competencia,
      origem: 'AUTOMATICO',
    });
  }

  return vencidas.length;
}
