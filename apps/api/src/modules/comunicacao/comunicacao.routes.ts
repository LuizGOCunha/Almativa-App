import { Router } from 'express';
import { PublicoNotificacao, StatusCampanha, TipoNotificacao } from '@almativa/shared';
import { autenticar, somenteAdmin } from '../../middleware/autenticar.js';
import { validar } from '../../middleware/validar.js';
import { param, rota } from '../../utils/http.js';
import * as notificacoes from './notificacoes.service.js';
import * as campanhas from './campanhas.service.js';
import {
  campanhaSchema,
  campanhaUpdateSchema,
  listarNotificacoesSchema,
  notificacaoManualSchema,
  segmentoSchema,
} from './comunicacao.schemas.js';

export const comunicacaoRouter = Router();

comunicacaoRouter.use(autenticar, somenteAdmin);

/* ---------------------- Notificacoes do painel admin -------------------- */

comunicacaoRouter.get(
  '/notificacoes',
  validar(listarNotificacoesSchema, 'query'),
  rota(async (req, res) => {
    const q = req.query as unknown as { tipo?: TipoNotificacao; apenasNaoLidas?: string; pagina: number; porPagina: number };
    res.json(
      await notificacoes.listarNotificacoes({
        publico: PublicoNotificacao.ADMIN,
        ...(q.tipo ? { tipo: q.tipo } : {}),
        apenasNaoLidas: q.apenasNaoLidas === 'true',
        pagina: q.pagina,
        porPagina: q.porPagina,
      }),
    );
  }),
);

comunicacaoRouter.get(
  '/notificacoes/nao-lidas',
  rota(async (_req, res) => {
    res.json({ total: await notificacoes.contarNaoLidas(PublicoNotificacao.ADMIN) });
  }),
);

comunicacaoRouter.post(
  '/notificacoes/:id/lida',
  rota(async (req, res) => res.json(await notificacoes.marcarComoLida(param(req, 'id')))),
);

comunicacaoRouter.post(
  '/notificacoes/ler-todas',
  rota(async (_req, res) => {
    res.json({ atualizadas: await notificacoes.marcarTodasComoLidas(PublicoNotificacao.ADMIN) });
  }),
);

comunicacaoRouter.delete(
  '/notificacoes/:id',
  rota(async (req, res) => {
    await notificacoes.arquivarNotificacao(param(req, 'id'));
    res.status(204).send();
  }),
);

/** Aviso pontual disparado pelo admin para alunos selecionados. */
comunicacaoRouter.post(
  '/notificacoes/enviar',
  validar(notificacaoManualSchema),
  rota(async (req, res) => {
    const { alunoIds, titulo, mensagem, canais } = req.body;
    const criadas = await notificacoes.criarNotificacoes(
      alunoIds.map((alunoId: string) => ({
        publico: PublicoNotificacao.ALUNO,
        alunoId,
        tipo: TipoNotificacao.SISTEMA,
        titulo,
        mensagem,
        canais,
      })),
    );
    res.status(201).json({ criadas });
  }),
);

/* ------------------------------ Campanhas ------------------------------ */

comunicacaoRouter.get(
  '/campanhas',
  rota(async (req, res) => {
    res.json(await campanhas.listarCampanhas(req.query['status'] as StatusCampanha | undefined));
  }),
);

comunicacaoRouter.post(
  '/campanhas/previa-segmento',
  validar(segmentoSchema),
  rota(async (req, res) => {
    const alunos = await campanhas.resolverSegmento(req.body);
    res.json({ total: alunos.length, amostra: alunos.slice(0, 20) });
  }),
);

comunicacaoRouter.get(
  '/campanhas/:id',
  rota(async (req, res) => res.json(await campanhas.obterCampanha(param(req, 'id')))),
);

comunicacaoRouter.post(
  '/campanhas',
  validar(campanhaSchema),
  rota(async (req, res) => res.status(201).json(await campanhas.criarCampanha(req.body, req.usuario!.id))),
);

comunicacaoRouter.patch(
  '/campanhas/:id',
  validar(campanhaUpdateSchema),
  rota(async (req, res) => res.json(await campanhas.atualizarCampanha(param(req, 'id'), req.body))),
);

comunicacaoRouter.post(
  '/campanhas/:id/enviar',
  rota(async (req, res) => res.json(await campanhas.enviarCampanha(param(req, 'id')))),
);

comunicacaoRouter.post(
  '/campanhas/:id/cancelar',
  rota(async (req, res) => res.json(await campanhas.cancelarCampanha(param(req, 'id')))),
);

comunicacaoRouter.get(
  '/campanhas/:id/metricas',
  rota(async (req, res) => res.json(await campanhas.atualizarMetricas(param(req, 'id')))),
);
