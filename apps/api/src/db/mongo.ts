import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

mongoose.set('strictQuery', true);

export async function conectarMongo(): Promise<void> {
  mongoose.connection.on('error', (erro) => logger.error({ erro }, 'Erro no MongoDB'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB desconectado'));

  await mongoose.connect(env.MONGO_URL, {
    serverSelectionTimeoutMS: 8000,
    autoIndex: !env.ehProducao,
  });

  logger.info('MongoDB conectado');
}

export async function desconectarMongo(): Promise<void> {
  await mongoose.disconnect();
}

export { mongoose };
