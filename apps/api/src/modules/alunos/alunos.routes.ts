import { Router } from 'express';
import { autenticar, somenteAdmin } from '../../middleware/autenticar.js';
import { validar } from '../../middleware/validar.js';
import { param, rota } from '../../utils/http.js';
import * as servico from './alunos.service.js';
import type { FiltrosAluno } from './alunos.service.js';
import * as presenca from '../presenca/presenca.service.js';
import { listarMensalidades } from '../financeiro/financeiro.service.js';
import {
  alunoSchema,
  alunoUpdateSchema,
  criarAcessoSchema,
  listarAlunosSchema,
  matriculaSchema,
  matriculaUpdateSchema,
} from './alunos.schemas.js';

export const alunosRouter = Router();

alunosRouter.use(autenticar, somenteAdmin);

alunosRouter.get(
  '/',
  validar(listarAlunosSchema, 'query'),
  rota(async (req, res) => {
    res.json(await servico.listar(req.query as unknown as FiltrosAluno));
  }),
);

alunosRouter.get(
  '/:id',
  rota(async (req, res) => res.json(await servico.obter(param(req, 'id')))),
);

alunosRouter.post(
  '/',
  validar(alunoSchema),
  rota(async (req, res) => res.status(201).json(await servico.criar(req.body))),
);

alunosRouter.patch(
  '/:id',
  validar(alunoUpdateSchema),
  rota(async (req, res) => res.json(await servico.atualizar(param(req, 'id'), req.body))),
);

alunosRouter.delete(
  '/:id',
  rota(async (req, res) => {
    await servico.remover(param(req, 'id'));
    res.status(204).send();
  }),
);

/* -------------------------------- Acesso ------------------------------- */

alunosRouter.post(
  '/:id/acesso',
  validar(criarAcessoSchema),
  rota(async (req, res) => {
    res.status(201).json(await servico.criarAcesso(param(req, 'id'), req.body.email, req.body.senha));
  }),
);

alunosRouter.post(
  '/:id/acesso/redefinir-senha',
  rota(async (req, res) => res.json(await servico.redefinirSenhaAluno(param(req, 'id')))),
);

/* ------------------------------ Matriculas ----------------------------- */

alunosRouter.get(
  '/:id/matriculas',
  rota(async (req, res) => res.json(await servico.listarMatriculas(param(req, 'id')))),
);

alunosRouter.post(
  '/:id/matriculas',
  validar(matriculaSchema),
  rota(async (req, res) => {
    res.status(201).json(await servico.criarMatricula(param(req, 'id'), req.body, req.usuario!.id));
  }),
);

alunosRouter.patch(
  '/matriculas/:matriculaId',
  validar(matriculaUpdateSchema),
  rota(async (req, res) => res.json(await servico.atualizarMatricula(param(req, 'matriculaId'), req.body))),
);

alunosRouter.delete(
  '/matriculas/:matriculaId',
  rota(async (req, res) => {
    await servico.cancelarMatricula(param(req, 'matriculaId'));
    res.status(204).send();
  }),
);

/* ------------------------- Visao 360 do aluno -------------------------- */

alunosRouter.get(
  '/:id/mensalidades',
  rota(async (req, res) => {
    res.json(await listarMensalidades({ alunoId: param(req, 'id'), pagina: 1, porPagina: 100 }));
  }),
);

alunosRouter.get(
  '/:id/frequencia',
  rota(async (req, res) => res.json(await presenca.listarFrequenciaDoAluno(param(req, 'id')))),
);

alunosRouter.get(
  '/:id/checkins',
  rota(async (req, res) => {
    res.json(await presenca.listarCheckinsDoAluno(param(req, 'id'), req.query['futuros'] !== 'false'));
  }),
);
