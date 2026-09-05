import { z } from 'zod';

export const listarAulasSchema = z.object({
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD.'),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD.'),
  turmaId: z.string().uuid().optional(),
  modalidadeId: z.string().uuid().optional(),
  instrutorId: z.string().uuid().optional(),
  status: z.enum(['AGENDADA', 'EM_ANDAMENTO', 'REALIZADA', 'CANCELADA']).optional(),
});

export const gerarAulasSchema = z.object({
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  turmaIds: z.array(z.string().uuid()).optional(),
});

export const atualizarAulaSchema = z.object({
  instrutorId: z.string().uuid().nullish(),
  capacidade: z.number().int().min(1).max(100).optional(),
  status: z.enum(['AGENDADA', 'EM_ANDAMENTO', 'REALIZADA', 'CANCELADA']).optional(),
  observacoes: z.string().max(600).nullish(),
});

export const cancelarAulaSchema = z.object({
  motivo: z.string().max(300).nullish().transform((v) => v ?? null),
});
