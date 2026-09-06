import { z } from 'zod';
import { Role } from '@almativa/shared';

export const loginSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  senha: z.string().min(6, 'A senha precisa de ao menos 6 caracteres.'),
});

export const registrarSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  nome: z.string().min(2, 'Nome precisa ter ao menos 2 caracteres.').max(120),
  senha: z.string().min(8, 'A senha precisa de ao menos 8 caracteres.'),
  role: z.nativeEnum(Role).refine((r) => r !== Role.AULA, {
    message: 'Role AULA deve ser criado através do fluxo de dispositivos.',
  }),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const trocarSenhaSchema = z.object({
  senhaAtual: z.string().min(6),
  novaSenha: z.string().min(8, 'A nova senha precisa de ao menos 8 caracteres.'),
});

export const criarDispositivoSchema = z.object({
  nome: z.string().min(2).max(80),
  sala: z.string().max(60).nullish().transform((v) => v ?? null),
  diasValidade: z.number().int().min(1).max(1095).default(365),
});

export const parearDispositivoSchema = z.object({
  token: z.string().min(20),
});
