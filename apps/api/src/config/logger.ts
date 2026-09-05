import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.ehProducao ? 'info' : 'debug',
  transport: env.ehProducao
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.senha', '*.senhaHash', '*.token'],
    remove: true,
  },
});
