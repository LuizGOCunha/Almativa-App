import { z } from 'zod';
import { cpfValido, somenteDigitos } from '@almativa/shared';

const opcional = <T extends z.ZodTypeAny>(schema: T) =>
  schema.nullish().transform((v) => (v === undefined ? null : v));

export const alunoSchema = z.object({
  nome: z.string().min(3, 'Informe o nome completo.').max(120),
  email: opcional(z.string().email('E-mail inválido.')),
  telefone: opcional(z.string().min(10).max(20)),
  cpf: opcional(
    z.string().refine((v) => cpfValido(v), 'CPF inválido.').transform((v) => somenteDigitos(v)),
  ),
  dataNascimento: opcional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD.')),
  fotoUrl: opcional(z.string().url()),
  status: z.enum(['ATIVO', 'INATIVO', 'TRANCADO']).default('ATIVO'),
  logradouro: opcional(z.string().max(160)),
  numero: opcional(z.string().max(20)),
  complemento: opcional(z.string().max(80)),
  bairro: opcional(z.string().max(80)),
  cidade: opcional(z.string().max(80)),
  uf: opcional(z.string().length(2).toUpperCase()),
  cep: opcional(z.string().max(9)),
  contatoEmergenciaNome: opcional(z.string().max(120)),
  contatoEmergenciaTelefone: opcional(z.string().max(20)),
  observacoesMedicas: opcional(z.string().max(2000)),
  objetivos: opcional(z.string().max(1000)),
  dataMatricula: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Cria o login do aluno junto com o cadastro. */
  criarAcesso: z.boolean().default(false),
});

export const alunoUpdateSchema = alunoSchema.partial().omit({ criarAcesso: true });

export const listarAlunosSchema = z.object({
  busca: z.string().max(120).optional(),
  status: z.enum(['ATIVO', 'INATIVO', 'TRANCADO']).optional(),
  modalidadeId: z.string().uuid().optional(),
  planoId: z.string().uuid().optional(),
  inadimplentes: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(200).default(20),
  ordenarPor: z.enum(['nome', 'criadoEm', 'dataMatricula']).default('nome'),
  ordem: z.enum(['asc', 'desc']).default('asc'),
});

export const matriculaSchema = z.object({
  planoId: z.string().uuid(),
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().transform((v) => v ?? null),
  diaVencimento: z.number().int().min(1).max(28),
  status: z.enum(['ATIVA', 'SUSPENSA', 'CANCELADA']).default('ATIVA'),
  observacao: z.string().max(600).nullish().transform((v) => v ?? null),
  /** Gera a mensalidade da competencia atual na hora da matricula. */
  gerarPrimeiraMensalidade: z.boolean().default(true),
});

export const matriculaUpdateSchema = matriculaSchema.partial().omit({ gerarPrimeiraMensalidade: true });

export const criarAcessoSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(8).optional(),
});
