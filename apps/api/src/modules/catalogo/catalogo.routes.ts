import { Router } from 'express';
import { autenticar, somenteAdmin } from '../../middleware/autenticar.js';
import { validar } from '../../middleware/validar.js';
import { param, rota } from '../../utils/http.js';
import * as servico from './catalogo.service.js';
import {
  instrutorSchema,
  instrutorUpdateSchema,
  modalidadeSchema,
  modalidadeUpdateSchema,
  planoSchema,
  planoUpdateSchema,
  turmaSchema,
  turmaUpdateSchema,
} from './catalogo.schemas.js';

export const catalogoRouter = Router();

// Leitura liberada para qualquer usuario autenticado; escrita so para admin.
catalogoRouter.use(autenticar);

/* ----------------------------- Modalidades ----------------------------- */

catalogoRouter.get(
  '/modalidades',
  rota(async (req, res) => {
    res.json(await servico.listarModalidades(req.query['ativas'] === 'true'));
  }),
);

catalogoRouter.post(
  '/modalidades',
  somenteAdmin,
  validar(modalidadeSchema),
  rota(async (req, res) => res.status(201).json(await servico.criarModalidade(req.body))),
);

catalogoRouter.patch(
  '/modalidades/:id',
  somenteAdmin,
  validar(modalidadeUpdateSchema),
  rota(async (req, res) => res.json(await servico.atualizarModalidade(param(req, 'id'), req.body))),
);

catalogoRouter.delete(
  '/modalidades/:id',
  somenteAdmin,
  rota(async (req, res) => {
    await servico.removerModalidade(param(req, 'id'));
    res.status(204).send();
  }),
);

/* ------------------------------ Instrutores ---------------------------- */

catalogoRouter.get(
  '/instrutores',
  rota(async (req, res) => res.json(await servico.listarInstrutores(req.query['ativos'] === 'true'))),
);

catalogoRouter.get(
  '/instrutores/:id',
  rota(async (req, res) => res.json(await servico.obterInstrutor(param(req, 'id')))),
);

catalogoRouter.post(
  '/instrutores',
  somenteAdmin,
  validar(instrutorSchema),
  rota(async (req, res) => res.status(201).json(await servico.criarInstrutor(req.body))),
);

catalogoRouter.patch(
  '/instrutores/:id',
  somenteAdmin,
  validar(instrutorUpdateSchema),
  rota(async (req, res) => res.json(await servico.atualizarInstrutor(param(req, 'id'), req.body))),
);

catalogoRouter.delete(
  '/instrutores/:id',
  somenteAdmin,
  rota(async (req, res) => {
    await servico.removerInstrutor(param(req, 'id'));
    res.status(204).send();
  }),
);

/* -------------------------------- Planos ------------------------------- */

catalogoRouter.get(
  '/planos',
  rota(async (req, res) => res.json(await servico.listarPlanos(req.query['ativos'] === 'true'))),
);

catalogoRouter.get(
  '/planos/:id',
  rota(async (req, res) => res.json(await servico.obterPlano(param(req, 'id')))),
);

catalogoRouter.post(
  '/planos',
  somenteAdmin,
  validar(planoSchema),
  rota(async (req, res) => res.status(201).json(await servico.criarPlano(req.body))),
);

catalogoRouter.patch(
  '/planos/:id',
  somenteAdmin,
  validar(planoUpdateSchema),
  rota(async (req, res) => res.json(await servico.atualizarPlano(param(req, 'id'), req.body))),
);

catalogoRouter.delete(
  '/planos/:id',
  somenteAdmin,
  rota(async (req, res) => {
    await servico.removerPlano(param(req, 'id'));
    res.status(204).send();
  }),
);

/* -------------------------------- Turmas ------------------------------- */

catalogoRouter.get(
  '/turmas',
  rota(async (req, res) => {
    const ativo = req.query['ativo'];
    res.json(
      await servico.listarTurmas({
        ...(ativo !== undefined ? { ativo: ativo === 'true' } : {}),
        ...(req.query['modalidadeId'] ? { modalidadeId: String(req.query['modalidadeId']) } : {}),
      }),
    );
  }),
);

catalogoRouter.get(
  '/turmas/:id',
  rota(async (req, res) => res.json(await servico.obterTurma(param(req, 'id')))),
);

catalogoRouter.post(
  '/turmas',
  somenteAdmin,
  validar(turmaSchema),
  rota(async (req, res) => res.status(201).json(await servico.criarTurma(req.body))),
);

catalogoRouter.patch(
  '/turmas/:id',
  somenteAdmin,
  validar(turmaUpdateSchema),
  rota(async (req, res) => res.json(await servico.atualizarTurma(param(req, 'id'), req.body))),
);

catalogoRouter.delete(
  '/turmas/:id',
  somenteAdmin,
  rota(async (req, res) => {
    await servico.removerTurma(param(req, 'id'));
    res.status(204).send();
  }),
);
