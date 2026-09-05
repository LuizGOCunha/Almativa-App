import { z } from 'zod';
import { extrairVideoIdYoutube } from '@almativa/shared';

export const intervaloSchema = z.object({
  tipo: z.enum(['PREPARO', 'TRABALHO', 'DESCANSO', 'TRANSICAO']),
  rotulo: z.string().min(1).max(40),
  duracaoSegundos: z.number().int().min(1).max(7200),
});

export const timerSchema = z.object({
  nome: z.string().min(2).max(80),
  descricao: z.string().max(400).nullish().transform((v) => v ?? null),
  modalidadeId: z.string().uuid().nullish().transform((v) => v ?? null),
  rounds: z.number().int().min(1).max(99).default(1),
  intervalos: z.array(intervaloSchema).min(1, 'Configure ao menos um intervalo.'),
  avisoSonoro: z.boolean().default(true),
  segundosAviso: z.number().int().min(0).max(60).default(10),
  ordem: z.number().int().min(0).default(0),
  ativo: z.boolean().default(true),
});
export const timerUpdateSchema = timerSchema.partial();

/** Aceita URL completa do YouTube ou o id de 11 caracteres. */
export const itemPlaylistSchema = z.object({
  videoId: z
    .string()
    .min(1)
    .transform((v, ctx) => {
      const id = extrairVideoIdYoutube(v);
      if (!id) {
        ctx.addIssue({ code: 'custom', message: 'Link ou id do YouTube inválido.' });
        return z.NEVER;
      }
      return id;
    }),
  titulo: z.string().min(1).max(160),
  duracaoSegundos: z.number().int().min(0).nullish().transform((v) => v ?? null),
  inicioEm: z.number().int().min(0).nullish().transform((v) => v ?? null),
});

export const playlistSchema = z.object({
  nome: z.string().min(2).max(80),
  descricao: z.string().max(400).nullish().transform((v) => v ?? null),
  modalidadeId: z.string().uuid().nullish().transform((v) => v ?? null),
  itens: z.array(itemPlaylistSchema).min(1, 'Adicione ao menos um vídeo.'),
  somenteAudio: z.boolean().default(false),
  volumePadrao: z.number().int().min(0).max(100).default(40),
  embaralhar: z.boolean().default(false),
  ordem: z.number().int().min(0).default(0),
  ativo: z.boolean().default(true),
});
export const playlistUpdateSchema = playlistSchema.partial();
