import cron, { type ScheduledTask } from 'node-cron';
import { addDays, addWeeks } from 'date-fns';
import { competenciaDe } from '@almativa/shared';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { gerarMensalidades, marcarVencidas } from '../modules/financeiro/financeiro.service.js';
import { dispararLembretesVencimento } from '../modules/financeiro/renovacoes.service.js';
import { gerarAulas } from '../modules/aulas/aulas.service.js';

const tarefas: ScheduledTask[] = [];

function agendar(nome: string, expressao: string, acao: () => Promise<unknown>): void {
  if (!cron.validate(expressao)) {
    logger.error({ nome, expressao }, 'Expressao cron invalida - job nao agendado');
    return;
  }

  const tarefa = cron.schedule(
    expressao,
    async () => {
      const inicio = Date.now();
      try {
        const resultado = await acao();
        logger.info({ job: nome, ms: Date.now() - inicio, resultado }, 'Job concluido');
      } catch (erro) {
        logger.error({ job: nome, erro }, 'Job falhou');
      }
    },
    { timezone: env.TIMEZONE },
  );

  tarefas.push(tarefa);
  logger.info({ job: nome, expressao, timezone: env.TIMEZONE }, 'Job agendado');
}

const isoData = (data: Date) => data.toISOString().slice(0, 10);

export function iniciarJobs(): void {
  if (!env.JOBS_ENABLED) {
    logger.warn('Jobs agendados desativados (JOBS_ENABLED=false)');
    return;
  }

  // Marca mensalidades em atraso logo apos a virada do dia.
  agendar('marcar-vencidas', env.CRON_MARCAR_VENCIDAS, async () => ({
    atualizadas: await marcarVencidas(),
  }));

  // Lembretes de vencimento para o aluno e para o painel admin.
  agendar('lembretes-vencimento', env.CRON_LEMBRETES_VENCIMENTO, () => dispararLembretesVencimento());

  // Mantem 4 semanas de aulas materializadas a frente.
  agendar('gerar-aulas', env.CRON_GERAR_AULAS, () => {
    const hoje = new Date();
    return gerarAulas(isoData(hoje), isoData(addWeeks(hoje, 4)));
  });

  // Gera as mensalidades da competencia no inicio de cada mes.
  agendar('gerar-mensalidades', env.CRON_GERAR_MENSALIDADES, () =>
    gerarMensalidades(competenciaDe(new Date())),
  );
}

export function pararJobs(): void {
  for (const tarefa of tarefas) tarefa.stop();
  tarefas.length = 0;
}

/** Usado no boot: garante que existam aulas para as proximas duas semanas. */
export async function prepararAgendaInicial(): Promise<void> {
  try {
    const hoje = new Date();
    const resultado = await gerarAulas(isoData(hoje), isoData(addDays(hoje, 14)));
    if (resultado.criadas > 0) {
      logger.info(resultado, 'Aulas materializadas no boot');
    }
  } catch (erro) {
    logger.error({ erro }, 'Falha ao preparar a agenda inicial');
  }
}
