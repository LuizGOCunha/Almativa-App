import { z } from 'zod';

const canais = z.array(z.enum(['APP', 'EMAIL', 'WHATSAPP', 'SMS'])).min(1).default(['APP']);

export const segmentoSchema = z.object({
  statusAluno: z.array(z.enum(['ATIVO', 'INATIVO', 'TRANCADO'])).optional(),
  modalidadeSlugs: z.array(z.string()).optional(),
  comMensalidadeVencida: z.boolean().optional(),
  semFrequenciaDesdeDias: z.number().int().min(1).max(365).optional(),
  alunoIds: z.array(z.string().uuid()).optional(),
});

export const campanhaSchema = z.object({
  nome: z.string().min(3).max(120),
  descricao: z.string().max(600).nullish().transform((v) => v ?? null),
  mensagemTitulo: z.string().min(3).max(120),
  /** Aceita {{nome}} como placeholder do primeiro nome do aluno. */
  mensagemCorpo: z.string().min(5).max(2000),
  canais,
  segmento: segmentoSchema.default({}),
  agendadaPara: z.string().datetime().nullish().transform((v) => v ?? null),
});

export const campanhaUpdateSchema = campanhaSchema.partial();

export const notificacaoManualSchema = z.object({
  alunoIds: z.array(z.string().uuid()).min(1),
  titulo: z.string().min(3).max(120),
  mensagem: z.string().min(3).max(1000),
  canais,
});

export const listarNotificacoesSchema = z.object({
  tipo: z.string().optional(),
  apenasNaoLidas: z.enum(['true', 'false']).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});
