import { StatusFrequencia, competenciaDe, type DashboardAdminDto } from '@almativa/shared';
import { addDays, endOfDay, startOfDay, subDays, subMonths } from 'date-fns';
import { prisma } from '../../db/prisma.js';
import { CheckinModel, FrequenciaModel } from '../../db/models/index.js';
import {
  hojeComoData,
  inicioDaSemana,
  inicioDoMesLocal,
  somarMesesCompetencia,
} from '../../utils/datas.js';

/** KPIs da home do painel administrativo. */
export async function dashboard(): Promise<DashboardAdminDto> {
  const agora = new Date();
  const inicioHoje = startOfDay(agora);
  const fimHoje = endOfDay(agora);
  const hojeData = hojeComoData();
  const competenciaAtual = competenciaDe(agora);
  const competenciaAnterior = somarMesesCompetencia(competenciaAtual, -1);
  const ha30Dias = subDays(inicioHoje, 30);

  const [
    alunosAtivos,
    alunosInativos,
    matriculasAtivas,
    pagamentosMes,
    pagamentosMesAnterior,
    vencidas,
    renovacoesProximas,
    aulasHoje,
  ] = await Promise.all([
    prisma.aluno.count({ where: { status: 'ATIVO' } }),
    prisma.aluno.count({ where: { status: { in: ['INATIVO', 'TRANCADO'] } } }),
    prisma.matricula.count({ where: { status: 'ATIVA' } }),
    prisma.pagamento.aggregate({
      _sum: { valorCentavos: true },
      where: {
        estornadoEm: null,
        pagoEm: { gte: inicioDoMesLocal(competenciaAtual) },
      },
    }),
    prisma.pagamento.aggregate({
      _sum: { valorCentavos: true },
      where: {
        estornadoEm: null,
        pagoEm: {
          gte: inicioDoMesLocal(competenciaAnterior),
          lt: inicioDoMesLocal(competenciaAtual),
        },
      },
    }),
    prisma.mensalidade.aggregate({
      _sum: { valorCentavos: true },
      _count: true,
      where: { status: 'VENCIDA' },
    }),
    prisma.mensalidade.count({
      where: { status: 'ABERTA', vencimentoEm: { gte: hojeData, lte: addDays(hojeData, 10) } },
    }),
    prisma.aula.count({
      where: { inicioEm: { gte: inicioHoje, lte: fimHoje }, status: { not: 'CANCELADA' } },
    }),
  ]);

  const [checkinsHoje, presencasHoje, frequencia30d, presencasPorDia] = await Promise.all([
    CheckinModel.countDocuments({ inicioEm: { $gte: inicioHoje, $lte: fimHoje }, status: { $ne: 'CANCELADO' } }),
    FrequenciaModel.countDocuments({
      inicioEm: { $gte: inicioHoje, $lte: fimHoje },
      status: StatusFrequencia.PRESENTE,
    }),
    FrequenciaModel.aggregate<{ _id: string; total: number }>([
      { $match: { inicioEm: { $gte: ha30Dias } } },
      { $group: { _id: '$status', total: { $sum: 1 } } },
    ]),
    FrequenciaModel.aggregate<{ _id: string; total: number }>([
      { $match: { inicioEm: { $gte: ha30Dias }, status: StatusFrequencia.PRESENTE } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$inicioEm' } },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const totalFrequencia = frequencia30d.reduce((t, f) => t + f.total, 0);
  const presentes30d = frequencia30d.find((f) => f._id === StatusFrequencia.PRESENTE)?.total ?? 0;

  return {
    alunosAtivos,
    alunosInativos,
    matriculasAtivas,
    receitaMesCentavos: pagamentosMes._sum.valorCentavos ?? 0,
    receitaMesAnteriorCentavos: pagamentosMesAnterior._sum.valorCentavos ?? 0,
    inadimplenciaCentavos: vencidas._sum.valorCentavos ?? 0,
    mensalidadesVencidas: vencidas._count,
    renovacoesProximas,
    aulasHoje,
    checkinsHoje,
    presencasHoje,
    taxaPresenca30d: totalFrequencia > 0 ? Math.round((presentes30d / totalFrequencia) * 100) : 0,
    ocupacaoMediaSemana: await ocupacaoMediaDaSemana(),
    porModalidade: await resumoPorModalidade(),
    frequenciaUltimos30Dias: preencherDias(presencasPorDia, ha30Dias, inicioHoje),
    receitaUltimos6Meses: await receitaPorCompetencia(6),
  };
}

/** Preenche com zero os dias sem presenca para o grafico nao ficar furado. */
function preencherDias(
  linhas: { _id: string; total: number }[],
  de: Date,
  ate: Date,
): { data: string; presencas: number }[] {
  const mapa = new Map(linhas.map((l) => [l._id, l.total]));
  const saida: { data: string; presencas: number }[] = [];
  for (let dia = new Date(de); dia <= ate; dia = addDays(dia, 1)) {
    const chave = dia.toISOString().slice(0, 10);
    saida.push({ data: chave, presencas: mapa.get(chave) ?? 0 });
  }
  return saida;
}

async function ocupacaoMediaDaSemana(): Promise<number> {
  const inicio = inicioDaSemana(new Date());
  const fim = addDays(inicio, 7);

  const aulas = await prisma.aula.findMany({
    where: { inicioEm: { gte: inicio, lt: fim }, status: { not: 'CANCELADA' } },
    select: { id: true, capacidade: true },
  });
  if (aulas.length === 0) return 0;

  const checkins = await CheckinModel.aggregate<{ _id: string; total: number }>([
    { $match: { aulaId: { $in: aulas.map((a) => a.id) }, status: { $ne: 'CANCELADO' } } },
    { $group: { _id: '$aulaId', total: { $sum: 1 } } },
  ]);
  const porAula = new Map(checkins.map((c) => [c._id, c.total]));

  const soma = aulas.reduce((total, a) => {
    const ocupados = porAula.get(a.id) ?? 0;
    return total + (a.capacidade > 0 ? ocupados / a.capacidade : 0);
  }, 0);

  return Math.round((soma / aulas.length) * 100);
}

async function resumoPorModalidade() {
  const modalidades = await prisma.modalidade.findMany({
    where: { ativo: true },
    orderBy: { ordem: 'asc' },
  });
  const inicioSemana = inicioDaSemana(new Date());

  return Promise.all(
    modalidades.map(async (m) => {
      const [alunos, aulas] = await Promise.all([
        prisma.aluno.count({
          where: {
            status: 'ATIVO',
            matriculas: { some: { status: 'ATIVA', plano: { modalidadeId: m.id } } },
          },
        }),
        prisma.aula.count({
          where: {
            turma: { modalidadeId: m.id },
            inicioEm: { gte: inicioSemana, lt: addDays(inicioSemana, 7) },
            status: { not: 'CANCELADA' },
          },
        }),
      ]);
      return { modalidade: m.nome, cor: m.cor, alunos, aulas };
    }),
  );
}

async function receitaPorCompetencia(meses: number) {
  const agora = new Date();
  const saida: { competencia: string; valorCentavos: number }[] = [];

  for (let i = meses - 1; i >= 0; i--) {
    const referencia = subMonths(agora, i);
    const competencia = competenciaDe(referencia);
    const inicio = inicioDoMesLocal(competencia);
    const fim = inicioDoMesLocal(somarMesesCompetencia(competencia, 1));

    const total = await prisma.pagamento.aggregate({
      _sum: { valorCentavos: true },
      where: { estornadoEm: null, pagoEm: { gte: inicio, lt: fim } },
    });

    saida.push({ competencia, valorCentavos: total._sum.valorCentavos ?? 0 });
  }

  return saida;
}
