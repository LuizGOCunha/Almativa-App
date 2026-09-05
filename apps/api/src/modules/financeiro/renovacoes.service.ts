import {
  TipoEventoPagamento,
  TipoNotificacao,
  type RenovacaoDto,
  type SituacaoRenovacao,
} from '@almativa/shared';
import { addDays } from 'date-fns';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { diferencaEmDias, hojeComoData } from '../../utils/datas.js';
import { NotificacaoModel } from '../../db/models/index.js';
import { mapAlunoResumo } from '../comum/mapeadores.js';
import { notificarVencimento } from '../comunicacao/notificacoes.service.js';
import { registrarEventoPagamento } from './eventos.js';

function situacaoDe(diasParaVencer: number): SituacaoRenovacao {
  if (diasParaVencer < 0) return 'PENDENTE';
  if (diasParaVencer === 0) return 'VENCE_HOJE';
  return 'PROXIMA';
}

/**
 * Renovacoes que o admin precisa acompanhar: mensalidades que vencem nos
 * proximos `dias` e as que ja venceram e continuam em aberto.
 */
export async function listarRenovacoes(opcoes: {
  dias: number;
  incluirPendentes: boolean;
}): Promise<RenovacaoDto[]> {
  const hoje = hojeComoData();
  const limite = addDays(hoje, opcoes.dias);

  const mensalidades = await prisma.mensalidade.findMany({
    where: {
      status: opcoes.incluirPendentes ? { in: ['ABERTA', 'VENCIDA'] } : 'ABERTA',
      OR: [
        { vencimentoEm: { gte: hoje, lte: limite } },
        ...(opcoes.incluirPendentes ? [{ vencimentoEm: { lt: hoje } }] : []),
      ],
    },
    include: { aluno: true, matricula: { include: { plano: true } } },
    orderBy: { vencimentoEm: 'asc' },
  });

  if (mensalidades.length === 0) return [];

  // Quantos lembretes ja foram enviados para cada mensalidade.
  const contagens = await NotificacaoModel.aggregate<{ _id: string; total: number; ultimo: Date }>([
    {
      $match: {
        publico: 'ALUNO',
        tipo: { $in: [TipoNotificacao.VENCIMENTO_PROXIMO, TipoNotificacao.VENCIMENTO_ATRASADO] },
        'dados.mensalidadeId': { $in: mensalidades.map((m) => m.id) },
      },
    },
    { $group: { _id: '$dados.mensalidadeId', total: { $sum: 1 }, ultimo: { $max: '$criadoEm' } } },
  ]);

  const porMensalidade = new Map(contagens.map((c) => [c._id, c]));

  return mensalidades.map((m) => {
    const diasParaVencer = diferencaEmDias(hoje, m.vencimentoEm);
    const lembretes = porMensalidade.get(m.id);
    return {
      mensalidadeId: m.id,
      aluno: mapAlunoResumo(m.aluno),
      planoNome: m.matricula.plano.nome,
      competencia: m.competencia,
      valorCentavos: m.valorCentavos,
      vencimentoEm: m.vencimentoEm.toISOString().slice(0, 10),
      status: m.status,
      diasParaVencer,
      situacao: situacaoDe(diasParaVencer),
      lembretesEnviados: lembretes?.total ?? 0,
      ultimoLembreteEm: lembretes?.ultimo ? new Date(lembretes.ultimo).toISOString() : null,
    };
  });
}

/**
 * Dispara os lembretes de vencimento do dia.
 * Roda no cron e tambem pode ser acionado manualmente pelo admin.
 * Marcos configurados em DIAS_AVISO_VENCIMENTO (padrao 7, 3 e 1 dia antes),
 * mais o dia do vencimento e reforcos para quem ja esta em atraso.
 */
export async function dispararLembretesVencimento(opcoes: { forcar?: boolean } = {}): Promise<{
  analisadas: number;
  notificados: number;
}> {
  const hoje = hojeComoData();

  const marcosAntes = env.diasAvisoVencimento;
  const maiorMarco = Math.max(...marcosAntes, 1);
  const marcosAtraso = [1, 3, 7, 15, 30];

  const mensalidades = await prisma.mensalidade.findMany({
    where: {
      status: { in: ['ABERTA', 'VENCIDA'] },
      vencimentoEm: { lte: addDays(hoje, maiorMarco) },
    },
    include: { aluno: true },
  });

  let notificados = 0;

  for (const m of mensalidades) {
    const dias = diferencaEmDias(hoje, m.vencimentoEm);

    const ehMarco = opcoes.forcar
      ? true
      : dias === 0 || (dias > 0 && marcosAntes.includes(dias)) || (dias < 0 && marcosAtraso.includes(-dias));

    if (!ehMarco) continue;

    const resultado = await notificarVencimento({
      alunoId: m.alunoId,
      alunoNome: m.aluno.nome,
      mensalidadeId: m.id,
      competencia: m.competencia,
      valorCentavos: m.valorCentavos,
      vencimentoEm: m.vencimentoEm,
      diasParaVencer: dias,
    });

    if (resultado.aluno || resultado.admin) {
      notificados++;
      await registrarEventoPagamento({
        tipo: TipoEventoPagamento.LEMBRETE_ENVIADO,
        alunoId: m.alunoId,
        alunoNome: m.aluno.nome,
        mensalidadeId: m.id,
        valorCentavos: m.valorCentavos,
        competencia: m.competencia,
        origem: 'AUTOMATICO',
        payload: { diasParaVencer: dias },
      });
    }
  }

  logger.info({ analisadas: mensalidades.length, notificados }, 'Lembretes de vencimento processados');
  return { analisadas: mensalidades.length, notificados };
}
