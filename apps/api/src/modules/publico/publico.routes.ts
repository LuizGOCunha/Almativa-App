import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { AulaGradeDto } from '@almativa/shared';
import { validar } from '../../middleware/validar.js';
import { rota } from '../../utils/http.js';
import { prisma } from '../../db/prisma.js';
import { mapInstrutor, mapModalidade, mapPlano } from '../comum/mapeadores.js';

export const publicoRouter = Router();

const limitadorContato = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    erro: { codigo: 'MUITAS_TENTATIVAS', mensagem: 'Você já enviou várias mensagens. Tente mais tarde.' },
  },
});

publicoRouter.get(
  '/modalidades',
  rota(async (_req, res) => {
    const registros = await prisma.modalidade.findMany({
      where: { ativo: true },
      orderBy: { ordem: 'asc' },
    });
    res.json(registros.map(mapModalidade));
  }),
);

publicoRouter.get(
  '/planos',
  rota(async (_req, res) => {
    const registros = await prisma.plano.findMany({
      where: { ativo: true },
      include: { modalidade: true },
      orderBy: [{ ordem: 'asc' }, { valorCentavos: 'asc' }],
    });
    res.json(registros.map(mapPlano));
  }),
);

publicoRouter.get(
  '/instrutores',
  rota(async (_req, res) => {
    const registros = await prisma.instrutor.findMany({
      where: { ativo: true },
      include: { modalidades: true },
      orderBy: { nome: 'asc' },
    });
    res.json(registros.map(mapInstrutor));
  }),
);

/** Grade semanal exibida no site, sem dados sensiveis. */
publicoRouter.get(
  '/grade',
  rota(async (_req, res) => {
    const turmas = await prisma.turma.findMany({
      where: { ativo: true },
      include: { modalidade: true, instrutor: true },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    });

    const grade: AulaGradeDto[] = turmas.map((t) => ({
      turmaId: t.id,
      nome: t.nome,
      modalidade: t.modalidade.nome,
      modalidadeSlug: t.modalidade.slug,
      cor: t.modalidade.cor,
      instrutor: t.instrutor?.nome ?? null,
      diaSemana: t.diaSemana,
      horaInicio: t.horaInicio,
      horaFim: t.horaFim,
      capacidade: t.capacidade,
      nivel: t.nivel,
    }));

    res.json(grade);
  }),
);

const contatoSchema = z.object({
  nome: z.string().min(3).max(120),
  email: z.string().email(),
  telefone: z.string().min(10).max(20),
  modalidadeInteresse: z.string().max(60).nullish().transform((v) => v ?? null),
  mensagem: z.string().min(5).max(1000),
});

publicoRouter.post(
  '/contato',
  limitadorContato,
  validar(contatoSchema),
  rota(async (req, res) => {
    await prisma.lead.create({ data: req.body });
    res.status(201).json({ recebido: true });
  }),
);

/** Textos e informacoes do site (endereco, telefone, redes). */
publicoRouter.get(
  '/configuracoes',
  rota(async (_req, res) => {
    const registros = await prisma.configuracao.findMany();
    const saida: Record<string, unknown> = {};
    for (const r of registros) saida[r.chave] = r.valor;
    res.json(saida);
  }),
);
