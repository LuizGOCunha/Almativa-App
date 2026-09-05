import { criarApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { conectarPostgres, desconectarPostgres } from './db/prisma.js';
import { conectarMongo, desconectarMongo } from './db/mongo.js';
import { iniciarJobs, pararJobs, prepararAgendaInicial } from './jobs/index.js';

async function principal(): Promise<void> {
  await conectarPostgres();
  await conectarMongo();

  const app = criarApp();
  const servidor = app.listen(env.PORT, () => {
    logger.info(
      { porta: env.PORT, ambiente: env.NODE_ENV, prefixo: env.API_PREFIX },
      `API Almativa no ar em http://localhost:${env.PORT}${env.API_PREFIX}`,
    );
  });

  await prepararAgendaInicial();
  iniciarJobs();

  const encerrar = async (sinal: string): Promise<void> => {
    logger.info({ sinal }, 'Encerrando a API...');
    pararJobs();
    servidor.close();
    await Promise.allSettled([desconectarPostgres(), desconectarMongo()]);
    process.exit(0);
  };

  process.on('SIGTERM', () => void encerrar('SIGTERM'));
  process.on('SIGINT', () => void encerrar('SIGINT'));
  process.on('unhandledRejection', (motivo) => {
    logger.error({ motivo }, 'Promise rejeitada sem tratamento');
  });
}

principal().catch((erro) => {
  logger.error({ erro }, 'Falha ao subir a API');
  process.exit(1);
});
