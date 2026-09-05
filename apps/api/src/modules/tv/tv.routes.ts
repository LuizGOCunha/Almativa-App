import { Router } from 'express';
import { Role } from '@almativa/shared';
import { autenticar, exigirPerfil, somenteAdmin } from '../../middleware/autenticar.js';
import { validar } from '../../middleware/validar.js';
import { param, rota } from '../../utils/http.js';
import * as servico from './tv.service.js';
import { playlistSchema, playlistUpdateSchema, timerSchema, timerUpdateSchema } from './tv.schemas.js';

export const tvRouter = Router();

tvRouter.use(autenticar);

/** Consumido pela tela da sala em polling. */
tvRouter.get(
  '/painel',
  exigirPerfil(Role.AULA, Role.ADMIN),
  rota(async (_req, res) => res.json(await servico.painelDaSala())),
);

/* -------------------------------- Timers ------------------------------- */

tvRouter.get(
  '/timers',
  rota(async (req, res) => {
    const modalidadeId = req.query['modalidadeId'] as string | undefined;
    res.json(
      req.query['todos'] === 'true' && req.usuario!.role === Role.ADMIN
        ? await servico.listarTodosTimers()
        : await servico.listarTimers(modalidadeId),
    );
  }),
);

tvRouter.post(
  '/timers',
  somenteAdmin,
  validar(timerSchema),
  rota(async (req, res) => res.status(201).json(await servico.criarTimer(req.body))),
);

tvRouter.patch(
  '/timers/:id',
  somenteAdmin,
  validar(timerUpdateSchema),
  rota(async (req, res) => res.json(await servico.atualizarTimer(param(req, 'id'), req.body))),
);

tvRouter.delete(
  '/timers/:id',
  somenteAdmin,
  rota(async (req, res) => {
    await servico.removerTimer(param(req, 'id'));
    res.status(204).send();
  }),
);

/* ------------------------------- Playlists ----------------------------- */

tvRouter.get(
  '/playlists',
  rota(async (req, res) => {
    const modalidadeId = req.query['modalidadeId'] as string | undefined;
    res.json(
      req.query['todas'] === 'true' && req.usuario!.role === Role.ADMIN
        ? await servico.listarTodasPlaylists()
        : await servico.listarPlaylists(modalidadeId),
    );
  }),
);

tvRouter.post(
  '/playlists',
  somenteAdmin,
  validar(playlistSchema),
  rota(async (req, res) => res.status(201).json(await servico.criarPlaylist(req.body))),
);

tvRouter.patch(
  '/playlists/:id',
  somenteAdmin,
  validar(playlistUpdateSchema),
  rota(async (req, res) => res.json(await servico.atualizarPlaylist(param(req, 'id'), req.body))),
);

tvRouter.delete(
  '/playlists/:id',
  somenteAdmin,
  rota(async (req, res) => {
    await servico.removerPlaylist(param(req, 'id'));
    res.status(204).send();
  }),
);
