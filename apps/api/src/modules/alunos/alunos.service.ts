import { Role, type Paginado, type AlunoDto } from '@almativa/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../db/prisma.js';
import { conflito, naoEncontrado, requisicaoInvalida } from '../../utils/erros.js';
import { gerarHashSenha, senhaProvisoria } from '../../utils/seguranca.js';
import { deIsoData, vencimentoDaCompetencia } from '../../utils/datas.js';
import { mapAluno, mapMatricula } from '../comum/mapeadores.js';
import { registrarEventoPagamento } from '../financeiro/eventos.js';
import { TipoEventoPagamento } from '@almativa/shared';

const incluirAluno = {
  matriculas: {
    include: { plano: { include: { modalidade: true } } },
    orderBy: { criadoEm: 'desc' as const },
  },
} satisfies Prisma.AlunoInclude;

export interface FiltrosAluno {
  busca?: string;
  status?: 'ATIVO' | 'INATIVO' | 'TRANCADO';
  modalidadeId?: string;
  planoId?: string;
  inadimplentes?: boolean;
  pagina: number;
  porPagina: number;
  ordenarPor: 'nome' | 'criadoEm' | 'dataMatricula';
  ordem: 'asc' | 'desc';
}

export async function listar(filtros: FiltrosAluno): Promise<Paginado<AlunoDto>> {
  const where: Prisma.AlunoWhereInput = {};

  if (filtros.busca) {
    const termo = filtros.busca.trim();
    where.OR = [
      { nome: { contains: termo, mode: 'insensitive' } },
      { email: { contains: termo, mode: 'insensitive' } },
      { telefone: { contains: termo } },
      { cpf: { contains: termo.replace(/\D/g, '') } },
    ];
  }
  if (filtros.status) where.status = filtros.status;

  if (filtros.modalidadeId || filtros.planoId) {
    where.matriculas = {
      some: {
        status: 'ATIVA',
        ...(filtros.planoId ? { planoId: filtros.planoId } : {}),
        ...(filtros.modalidadeId ? { plano: { modalidadeId: filtros.modalidadeId } } : {}),
      },
    };
  }
  if (filtros.inadimplentes) {
    where.mensalidades = { some: { status: { in: ['VENCIDA'] } } };
  }

  const pular = (filtros.pagina - 1) * filtros.porPagina;

  const [registros, total] = await Promise.all([
    prisma.aluno.findMany({
      where,
      include: incluirAluno,
      orderBy: { [filtros.ordenarPor]: filtros.ordem },
      skip: pular,
      take: filtros.porPagina,
    }),
    prisma.aluno.count({ where }),
  ]);

  return {
    itens: registros.map(mapAluno),
    total,
    pagina: filtros.pagina,
    porPagina: filtros.porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / filtros.porPagina)),
  };
}

export async function obter(id: string): Promise<AlunoDto> {
  const registro = await prisma.aluno.findUnique({ where: { id }, include: incluirAluno });
  if (!registro) throw naoEncontrado('Aluno', id);
  return mapAluno(registro);
}

interface EntradaAluno extends Record<string, unknown> {
  nome: string;
  email: string | null;
  dataNascimento?: string | null;
  dataMatricula?: string;
  criarAcesso?: boolean;
}

/** Converte as datas em texto do payload para Date antes de gravar. */
function normalizarDatas(dados: Record<string, unknown>): Record<string, unknown> {
  const saida = { ...dados };
  if (typeof saida['dataNascimento'] === 'string') {
    saida['dataNascimento'] = deIsoData(saida['dataNascimento'] as string);
  }
  if (typeof saida['dataMatricula'] === 'string') {
    saida['dataMatricula'] = deIsoData(saida['dataMatricula'] as string);
  }
  return saida;
}

export async function criar(dados: EntradaAluno): Promise<{ aluno: AlunoDto; senhaProvisoria?: string }> {
  const { criarAcesso, ...resto } = dados;

  if (criarAcesso && !resto.email) {
    throw requisicaoInvalida('Para criar o acesso do aluno é preciso informar um e-mail.');
  }

  const aluno = await prisma.aluno.create({
    data: normalizarDatas(resto) as Prisma.AlunoCreateInput,
    include: incluirAluno,
  });

  if (!criarAcesso) return { aluno: mapAluno(aluno) };

  const senha = senhaProvisoria();
  await prisma.usuario.create({
    data: {
      email: resto.email!.toLowerCase(),
      senhaHash: await gerarHashSenha(senha),
      nome: aluno.nome,
      role: Role.ALUNO,
      alunoId: aluno.id,
      precisaTrocarSenha: true,
    },
  });

  return { aluno: mapAluno(aluno), senhaProvisoria: senha };
}

export async function atualizar(id: string, dados: Record<string, unknown>): Promise<AlunoDto> {
  const existe = await prisma.aluno.findUnique({ where: { id } });
  if (!existe) throw naoEncontrado('Aluno', id);

  const aluno = await prisma.aluno.update({
    where: { id },
    data: normalizarDatas(dados) as Prisma.AlunoUpdateInput,
    include: incluirAluno,
  });

  // Mantem o nome do login em sincronia com o cadastro.
  await prisma.usuario.updateMany({ where: { alunoId: id }, data: { nome: aluno.nome } });

  return mapAluno(aluno);
}

export async function remover(id: string): Promise<void> {
  const pagamentos = await prisma.pagamento.count({ where: { alunoId: id } });
  if (pagamentos > 0) {
    // Historico financeiro precisa ser preservado: inativa em vez de excluir.
    await prisma.aluno.update({ where: { id }, data: { status: 'INATIVO' } });
    await prisma.matricula.updateMany({
      where: { alunoId: id, status: 'ATIVA' },
      data: { status: 'CANCELADA' },
    });
    await prisma.usuario.updateMany({ where: { alunoId: id }, data: { ativo: false } });
    return;
  }
  await prisma.aluno.delete({ where: { id } });
}

/* ------------------------------ Acesso --------------------------------- */

export async function criarAcesso(alunoId: string, email: string, senha?: string) {
  const aluno = await prisma.aluno.findUnique({ where: { id: alunoId }, include: { usuario: true } });
  if (!aluno) throw naoEncontrado('Aluno', alunoId);
  if (aluno.usuario) throw conflito('Este aluno já possui acesso.');

  const senhaFinal = senha ?? senhaProvisoria();
  await prisma.usuario.create({
    data: {
      email: email.toLowerCase(),
      senhaHash: await gerarHashSenha(senhaFinal),
      nome: aluno.nome,
      role: Role.ALUNO,
      alunoId: aluno.id,
      precisaTrocarSenha: !senha,
    },
  });

  return { email: email.toLowerCase(), senhaProvisoria: senha ? undefined : senhaFinal };
}

export async function redefinirSenhaAluno(alunoId: string) {
  const usuario = await prisma.usuario.findUnique({ where: { alunoId } });
  if (!usuario) throw naoEncontrado('Acesso do aluno');

  const senha = senhaProvisoria();
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { senhaHash: await gerarHashSenha(senha), precisaTrocarSenha: true },
  });
  await prisma.refreshToken.updateMany({
    where: { usuarioId: usuario.id, revogadoEm: null },
    data: { revogadoEm: new Date() },
  });

  return { email: usuario.email, senhaProvisoria: senha };
}

/* ---------------------------- Matriculas ------------------------------- */

const incluirMatricula = {
  plano: { include: { modalidade: true } },
  aluno: true,
} satisfies Prisma.MatriculaInclude;

export async function listarMatriculas(alunoId: string) {
  const registros = await prisma.matricula.findMany({
    where: { alunoId },
    include: incluirMatricula,
    orderBy: { criadoEm: 'desc' },
  });
  return registros.map(mapMatricula);
}

export async function criarMatricula(
  alunoId: string,
  dados: {
    planoId: string;
    dataInicio: string;
    dataFim: string | null;
    diaVencimento: number;
    status: 'ATIVA' | 'SUSPENSA' | 'CANCELADA';
    observacao: string | null;
    gerarPrimeiraMensalidade: boolean;
  },
  registradoPor?: string,
) {
  const aluno = await prisma.aluno.findUnique({ where: { id: alunoId } });
  if (!aluno) throw naoEncontrado('Aluno', alunoId);

  const plano = await prisma.plano.findUnique({ where: { id: dados.planoId } });
  if (!plano) throw naoEncontrado('Plano', dados.planoId);

  const duplicada = await prisma.matricula.findFirst({
    where: { alunoId, planoId: dados.planoId, status: 'ATIVA' },
  });
  if (duplicada) throw conflito('O aluno já tem uma matrícula ativa neste plano.');

  const matricula = await prisma.matricula.create({
    data: {
      alunoId,
      planoId: dados.planoId,
      dataInicio: deIsoData(dados.dataInicio),
      dataFim: dados.dataFim ? deIsoData(dados.dataFim) : null,
      diaVencimento: dados.diaVencimento,
      status: dados.status,
      observacao: dados.observacao,
    },
    include: incluirMatricula,
  });

  if (dados.gerarPrimeiraMensalidade && matricula.status === 'ATIVA') {
    // dataInicio ja vem como AAAA-MM-DD: evita conversao de fuso.
    const competencia = dados.dataInicio.slice(0, 7);
    const mensalidade = await prisma.mensalidade.create({
      data: {
        matriculaId: matricula.id,
        alunoId,
        competencia,
        valorCentavos: plano.valorCentavos,
        vencimentoEm: vencimentoDaCompetencia(competencia, dados.diaVencimento),
      },
    });

    await registrarEventoPagamento({
      tipo: TipoEventoPagamento.MENSALIDADE_GERADA,
      alunoId,
      alunoNome: aluno.nome,
      mensalidadeId: mensalidade.id,
      matriculaId: matricula.id,
      valorCentavos: mensalidade.valorCentavos,
      competencia,
      registradoPor: registradoPor ?? null,
      payload: { origem: 'matricula' },
    });
  }

  return mapMatricula(matricula);
}

export async function atualizarMatricula(matriculaId: string, dados: Record<string, unknown>) {
  const existe = await prisma.matricula.findUnique({ where: { id: matriculaId } });
  if (!existe) throw naoEncontrado('Matrícula', matriculaId);

  const payload = { ...dados };
  if (typeof payload['dataInicio'] === 'string') payload['dataInicio'] = deIsoData(payload['dataInicio'] as string);
  if (typeof payload['dataFim'] === 'string') payload['dataFim'] = deIsoData(payload['dataFim'] as string);

  const matricula = await prisma.matricula.update({
    where: { id: matriculaId },
    data: payload,
    include: incluirMatricula,
  });
  return mapMatricula(matricula);
}

export async function cancelarMatricula(matriculaId: string) {
  const matricula = await prisma.matricula.findUnique({ where: { id: matriculaId } });
  if (!matricula) throw naoEncontrado('Matrícula', matriculaId);

  await prisma.$transaction([
    prisma.matricula.update({
      where: { id: matriculaId },
      data: { status: 'CANCELADA', dataFim: new Date() },
    }),
    // Mensalidades abertas de competencias futuras deixam de ser cobradas.
    prisma.mensalidade.updateMany({
      where: { matriculaId, status: 'ABERTA', vencimentoEm: { gt: new Date() } },
      data: { status: 'CANCELADA' },
    }),
  ]);
}
