import { z } from 'zod';

const hora = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:MM.');

export const modalidadeSchema = z.object({
  nome: z.string().min(2).max(60),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hífen.'),
  descricao: z.string().max(600).nullish().transform((v) => v ?? null),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Informe uma cor hex (#RRGGBB).').default('#1E4D3B'),
  icone: z.string().max(60).nullish().transform((v) => v ?? null),
  ordem: z.number().int().min(0).default(0),
  ativo: z.boolean().default(true),
});
export const modalidadeUpdateSchema = modalidadeSchema.partial();

export const instrutorSchema = z.object({
  nome: z.string().min(2).max(120),
  email: z.string().email().nullish().transform((v) => v ?? null),
  telefone: z.string().max(20).nullish().transform((v) => v ?? null),
  bio: z.string().max(1200).nullish().transform((v) => v ?? null),
  registroProfissional: z.string().max(40).nullish().transform((v) => v ?? null),
  fotoUrl: z.string().url().nullish().transform((v) => v ?? null),
  ativo: z.boolean().default(true),
  modalidadeIds: z.array(z.string().uuid()).default([]),
});
export const instrutorUpdateSchema = instrutorSchema.partial();

export const planoSchema = z.object({
  nome: z.string().min(2).max(80),
  descricao: z.string().max(600).nullish().transform((v) => v ?? null),
  modalidadeId: z.string().uuid().nullish().transform((v) => v ?? null),
  valorCentavos: z.number().int().min(0),
  periodicidade: z.enum(['MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL']).default('MENSAL'),
  aulasPorSemana: z.number().int().min(1).max(14).nullish().transform((v) => v ?? null),
  diaVencimentoPadrao: z.number().int().min(1).max(28).default(10),
  ordem: z.number().int().min(0).default(0),
  ativo: z.boolean().default(true),
});
export const planoUpdateSchema = planoSchema.partial();

export const turmaSchema = z
  .object({
    nome: z.string().min(2).max(80),
    modalidadeId: z.string().uuid(),
    instrutorId: z.string().uuid().nullish().transform((v) => v ?? null),
    diaSemana: z.number().int().min(0).max(6),
    horaInicio: hora,
    horaFim: hora,
    capacidade: z.number().int().min(1).max(100).default(12),
    sala: z.string().max(60).nullish().transform((v) => v ?? null),
    nivel: z.string().max(40).nullish().transform((v) => v ?? null),
    ativo: z.boolean().default(true),
  })
  .refine((t) => t.horaFim > t.horaInicio, {
    message: 'O horário de término deve ser depois do início.',
    path: ['horaFim'],
  });

export const turmaUpdateSchema = z.object({
  nome: z.string().min(2).max(80).optional(),
  modalidadeId: z.string().uuid().optional(),
  instrutorId: z.string().uuid().nullish().optional(),
  diaSemana: z.number().int().min(0).max(6).optional(),
  horaInicio: hora.optional(),
  horaFim: hora.optional(),
  capacidade: z.number().int().min(1).max(100).optional(),
  sala: z.string().max(60).nullish().optional(),
  nivel: z.string().max(40).nullish().optional(),
  ativo: z.boolean().optional(),
});
