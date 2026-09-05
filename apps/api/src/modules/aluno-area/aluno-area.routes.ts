import { Router } from 'express';
import { OrigemRegistro, PublicoNotificacao, StatusCheckin } from '@almativa/shared';
import { z } from 'zod';
import { autenticar, somenteAluno } from '../../middleware/autenticar.js';
import { validar } from '../../middleware/validar.js';
import { param, rota } from '../../utils/http.js';
import { proibido } from '../../utils/erros.js';
import { prisma } from '../../db/prisma.js';
import { CheckinModel } from '../../db/models/index.js';
import { mapAluno } from '../comum/mapeadores.js';
import * as aulas from '../aulas/aulas.service.js';
import * as presenca from '../presenca/presenca.service.js';
import * as notificacoes from '../comunicacao/notificacoes.service.js';
import { listarMensalidades } from '../financeiro/financeiro.service.js';
import { listarAulasSchema } from '../aulas/aulas.schemas.js';

export const alunoAreaRouter = Router();

alunoAreaRouter.use(autenticar, somenteAluno);

/** Todo endpoint desta area opera sobre o aluno do proprio token. */
function alunoDoToken(req: { usuario?: { alunoId: string | null } }): string {
  const alunoId = req.usuario?.alunoId;
  if (!alunoId) throw proibido('Seu login não está vinculado a um cadastro de aluno.');
  return alunoId;
}

alunoAreaRouter.get(
  '/perfil',
  rota(async (req, res) => {
    const aluno = await prisma.aluno.findUnique({
      where: { id: alunoDoToken(req) },
      include: {
        matriculas: {
          include: { plano: { include: { modalidade: true } } },
          orderBy: { criadoEm: 'desc' },
        },
      },
    });
    res.json(aluno ? mapAluno(aluno) : null);
  }),
);

const atualizarPerfilSchema = z.object({
  telefone: z.string().min(10).max(20).nullish(),
  logradouro: z.string().max(160).nullish(),
  numero: z.string().max(20).nullish(),
  complemento: z.string().max(80).nullish(),
  bairro: z.string().max(80).nullish(),
  cidade: z.string().max(80).nullish(),
  uf: z.string().length(2).nullish(),
  cep: z.string().max(9).nullish(),
  contatoEmergenciaNome: z.string().max(120).nullish(),
  contatoEmergenciaTelefone: z.string().max(20).nullish(),
  observacoesMedicas: z.string().max(2000).nullish(),
  objetivos: z.string().max(1000).nullish(),
});

alunoAreaRouter.patch(
  '/perfil',
  validar(atualizarPerfilSchema),
  rota(async (req, res) => {
    const aluno = await prisma.aluno.update({
      where: { id: alunoDoToken(req) },
      data: req.body,
      include: {
        matriculas: {
          include: { plano: { include: { modalidade: true } } },
          orderBy: { criadoEm: 'desc' },
        },
      },
    });
    res.json(mapAluno(aluno));
  }),
);

/* -------------------------------- Agenda ------------------------------- */

alunoAreaRouter.get(
  '/agenda',
  validar(listarAulasSchema, 'query'),
  rota(async (req, res) => {
    const alunoId = alunoDoToken(req);
    const lista = await aulas.listarAulas(req.query as never);

    // Marca em quais aulas o aluno ja tem vaga garantida.
    const meus = await CheckinModel.find({
      alunoId,
      aulaId: { $in: lista.map((a) => a.id) },
      status: { $ne: StatusCheckin.CANCELADO },
    }).select('aulaId status posicaoFila');

    const porAula = new Map(meus.map((c) => [c.aulaId, c]));

    res.json(
      lista.map((aula) => ({
        ...aula,
        meuCheckin: porAula.get(aula.id)
          ? {
              status: porAula.get(aula.id)!.status,
              posicaoFila: porAula.get(aula.id)!.posicaoFila ?? null,
            }
          : null,
      })),
    );
  }),
);

/* ------------------------------- Check-in ------------------------------ */

alunoAreaRouter.post(
  '/aulas/:aulaId/checkin',
  rota(async (req, res) => {
    res.status(201).json(
      await presenca.fazerCheckin({
        aulaId: param(req, 'aulaId'),
        alunoId: alunoDoToken(req),
        origem: OrigemRegistro.APP_ALUNO,
      }),
    );
  }),
);

alunoAreaRouter.delete(
  '/aulas/:aulaId/checkin',
  rota(async (req, res) => {
    const alunoId = alunoDoToken(req);
    res.json(await presenca.cancelarCheckin({ aulaId: param(req, 'aulaId'), alunoId, canceladoPor: alunoId }));
  }),
);

alunoAreaRouter.get(
  '/checkins',
  rota(async (req, res) => {
    res.json(await presenca.listarCheckinsDoAluno(alunoDoToken(req), req.query['futuros'] !== 'false'));
  }),
);

/* ------------------------ Frequencia e financeiro ---------------------- */

alunoAreaRouter.get(
  '/frequencia',
  rota(async (req, res) => res.json(await presenca.listarFrequenciaDoAluno(alunoDoToken(req)))),
);

alunoAreaRouter.get(
  '/mensalidades',
  rota(async (req, res) => {
    res.json(await listarMensalidades({ alunoId: alunoDoToken(req), pagina: 1, porPagina: 60 }));
  }),
);

/* ----------------------------- Notificacoes ---------------------------- */

alunoAreaRouter.get(
  '/notificacoes',
  rota(async (req, res) => {
    res.json(
      await notificacoes.listarNotificacoes({
        publico: PublicoNotificacao.ALUNO,
        alunoId: alunoDoToken(req),
        apenasNaoLidas: req.query['apenasNaoLidas'] === 'true',
        pagina: Number(req.query['pagina']) || 1,
        porPagina: Number(req.query['porPagina']) || 20,
      }),
    );
  }),
);

alunoAreaRouter.get(
  '/notificacoes/nao-lidas',
  rota(async (req, res) => {
    res.json({
      total: await notificacoes.contarNaoLidas(PublicoNotificacao.ALUNO, alunoDoToken(req)),
    });
  }),
);

alunoAreaRouter.post(
  '/notificacoes/:id/lida',
  rota(async (req, res) => {
    res.json(await notificacoes.marcarComoLida(param(req, 'id'), alunoDoToken(req)));
  }),
);

alunoAreaRouter.post(
  '/notificacoes/ler-todas',
  rota(async (req, res) => {
    res.json({
      atualizadas: await notificacoes.marcarTodasComoLidas(PublicoNotificacao.ALUNO, alunoDoToken(req)),
    });
  }),
);
