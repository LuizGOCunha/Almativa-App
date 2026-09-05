import { z } from 'zod';

const competencia = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use o formato AAAA-MM.');

export const listarMensalidadesSchema = z.object({
  alunoId: z.string().uuid().optional(),
  competencia: competencia.optional(),
  status: z.enum(['ABERTA', 'PAGA', 'VENCIDA', 'CANCELADA']).optional(),
  vencimentoDe: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  vencimentoAte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  busca: z.string().max(120).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(200).default(20),
});

export const gerarMensalidadesSchema = z.object({
  competencia,
  /** Quando vazio, gera para todas as matriculas ativas. */
  matriculaIds: z.array(z.string().uuid()).optional(),
  /** Recria mensalidades ja existentes que ainda estejam abertas. */
  sobrescrever: z.boolean().default(false),
});

export const criarMensalidadeSchema = z.object({
  matriculaId: z.string().uuid(),
  competencia,
  valorCentavos: z.number().int().min(0).optional(),
  vencimentoEm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  observacao: z.string().max(600).nullish().transform((v) => v ?? null),
});

export const registrarPagamentoSchema = z.object({
  valorCentavos: z.number().int().min(1),
  metodo: z.enum(['PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO', 'BOLETO', 'TRANSFERENCIA']),
  pagoEm: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  referenciaExterna: z.string().max(120).nullish().transform((v) => v ?? null),
  observacao: z.string().max(600).nullish().transform((v) => v ?? null),
});

export const listarRenovacoesSchema = z.object({
  /** Janela de dias a frente para considerar "proxima". */
  dias: z.coerce.number().int().min(1).max(90).default(10),
  incluirPendentes: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

export const listarPagamentosSchema = z.object({
  alunoId: z.string().uuid().optional(),
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  metodo: z.enum(['PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO', 'BOLETO', 'TRANSFERENCIA']).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(200).default(20),
});
