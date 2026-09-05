import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { rotaNaoEncontrada, tratarErro } from './middleware/erro.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { publicoRouter } from './modules/publico/publico.routes.js';
import { catalogoRouter } from './modules/catalogo/catalogo.routes.js';
import { alunosRouter } from './modules/alunos/alunos.routes.js';
import { aulasRouter } from './modules/aulas/aulas.routes.js';
import { financeiroRouter } from './modules/financeiro/financeiro.routes.js';
import { comunicacaoRouter } from './modules/comunicacao/comunicacao.routes.js';
import { painelRouter } from './modules/painel/painel.routes.js';
import { alunoAreaRouter } from './modules/aluno-area/aluno-area.routes.js';
import { tvRouter } from './modules/tv/tv.routes.js';

export function criarApp(): Express {
  const app = express();

  // Atras de proxy/ingress o rate limit precisa do IP real.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // A tela da sala embeda o player do YouTube.
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false,
    }),
  );

  app.use(
    cors({
      origin: (origem, callback) => {
        if (!origem || env.corsOrigins.includes(origem)) return callback(null, true);
        callback(new Error(`Origem ${origem} nao autorizada.`));
      },
      credentials: true,
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  if (!env.ehTeste) {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url?.endsWith('/saude') ?? false },
      }),
    );
  }

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: env.ehProducao ? 240 : 2000,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  const api = express.Router();

  api.get('/saude', (_req, res) => {
    res.json({ status: 'ok', ambiente: env.NODE_ENV, agora: new Date().toISOString() });
  });

  api.use('/publico', publicoRouter);
  api.use('/auth', authRouter);
  api.use('/catalogo', catalogoRouter);
  api.use('/alunos', alunosRouter);
  api.use('/aulas', aulasRouter);
  api.use('/financeiro', financeiroRouter);
  api.use('/comunicacao', comunicacaoRouter);
  api.use('/painel', painelRouter);
  api.use('/aluno', alunoAreaRouter);
  api.use('/tv', tvRouter);

  app.use(env.API_PREFIX, api);

  app.use(rotaNaoEncontrada);
  app.use(tratarErro);

  return app;
}
