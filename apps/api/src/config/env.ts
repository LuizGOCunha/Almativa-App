import 'dotenv/config';
import { z } from 'zod';

const listaCsv = (valor: string) =>
  valor
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  API_PREFIX: z.string().default('/api'),
  CORS_ORIGINS: z.string().default('http://localhost:4200'),
  TIMEZONE: z.string().default('America/Sao_Paulo'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL e obrigatoria'),
  MONGO_URL: z.string().min(1, 'MONGO_URL e obrigatoria'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET precisa de ao menos 16 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET precisa de ao menos 16 caracteres'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  JWT_DEVICE_TTL: z.string().default('365d'),

  JOBS_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  CRON_LEMBRETES_VENCIMENTO: z.string().default('0 8 * * *'),
  CRON_MARCAR_VENCIDAS: z.string().default('10 0 * * *'),
  CRON_GERAR_AULAS: z.string().default('0 3 * * 1'),
  CRON_GERAR_MENSALIDADES: z.string().default('0 2 1 * *'),
  DIAS_AVISO_VENCIMENTO: z.string().default('7,3,1'),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@almativa.com.br'),
  SEED_ADMIN_SENHA: z.string().default('almativa123'),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  const problemas = resultado.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`\nVariaveis de ambiente invalidas:\n${problemas}\n`);
  console.error('Copie apps/api/.env.example para apps/api/.env e ajuste os valores.\n');
  process.exit(1);
}

const bruto = resultado.data;

export const env = {
  ...bruto,
  ehProducao: bruto.NODE_ENV === 'production',
  ehTeste: bruto.NODE_ENV === 'test',
  corsOrigins: listaCsv(bruto.CORS_ORIGINS),
  diasAvisoVencimento: listaCsv(bruto.DIAS_AVISO_VENCIMENTO)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a),
} as const;

export type Env = typeof env;
