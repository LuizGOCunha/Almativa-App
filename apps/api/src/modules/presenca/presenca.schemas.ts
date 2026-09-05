import { z } from 'zod';

export const checkinSchema = z.object({
  aulaId: z.string().uuid(),
  /** Somente admin/tela pode fazer check-in em nome de outro aluno. */
  alunoId: z.string().uuid().optional(),
  origem: z.enum(['APP_ALUNO', 'PAINEL_ADMIN', 'TELA_AULA']).default('APP_ALUNO'),
});

export const registrarFrequenciaSchema = z.object({
  alunoId: z.string().uuid(),
  status: z.enum(['PRESENTE', 'AUSENTE', 'JUSTIFICADA']).default('PRESENTE'),
  observacao: z.string().max(300).nullish().transform((v) => v ?? null),
  origem: z.enum(['PAINEL_ADMIN', 'TELA_AULA', 'APP_ALUNO']).default('PAINEL_ADMIN'),
});

export const frequenciaEmLoteSchema = z.object({
  registros: z
    .array(
      z.object({
        alunoId: z.string().uuid(),
        status: z.enum(['PRESENTE', 'AUSENTE', 'JUSTIFICADA']),
        observacao: z.string().max(300).nullish().transform((v) => v ?? null),
      }),
    )
    .min(1),
  origem: z.enum(['PAINEL_ADMIN', 'TELA_AULA']).default('PAINEL_ADMIN'),
  /** Marca a aula como REALIZADA ao fechar a chamada. */
  finalizarAula: z.boolean().default(false),
});

export const relatorioFrequenciaSchema = z.object({
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  alunoId: z.string().uuid().optional(),
  turmaId: z.string().uuid().optional(),
  modalidadeSlug: z.string().optional(),
});
