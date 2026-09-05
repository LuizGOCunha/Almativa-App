import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * Prisma 7 exige um driver adapter: a connection string vem do .env e nao
 * mais do bloco datasource do schema.
 */
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log: ['warn', 'error'],
});

export async function conectarPostgres(): Promise<void> {
  await prisma.$connect();
  logger.info('Postgres conectado');
}

export async function desconectarPostgres(): Promise<void> {
  await prisma.$disconnect();
}
