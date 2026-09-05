import { Router } from 'express';
import { Role } from '@almativa/shared';
import { autenticar, exigirPerfil, somenteAdmin } from '../../middleware/autenticar.js';
import { validar } from '../../middleware/validar.js';
import { param, rota } from '../../utils/http.js';
import * as servico from './aulas.service.js';
import * as presenca from '../presenca/presenca.service.js';
import {
  atualizarAulaSchema,
  cancelarAulaSchema,
  gerarAulasSchema,
  listarAulasSchema,
} from './aulas.schemas.js';
import {
  checkinSchema,
  frequenciaEmLoteSchema,
  registrarFrequenciaSchema,
  relatorioFrequenciaSchema,
} from '../presenca/presenca.schemas.js';

export const aulasRouter = Router();

aulasRouter.use(autenticar);

/* -------------------------------- Agenda ------------------------------- */

aulasRouter.get(
  '/',
  validar(listarAulasSchema, 'query'),
  rota(async (req, res) => res.json(await servico.listarAulas(req.query as never))),
);

aulasRouter.get(
  '/:id',
  rota(async (req, res) => res.json(await servico.obterAula(param(req, 'id')))),
);

aulasRouter.post(
  '/gerar',
  somenteAdmin,
  validar(gerarAulasSchema),
  rota(async (req, res) => {
    const { de, ate, turmaIds } = req.body;
    res.json(await servico.gerarAulas(de, ate, turmaIds));
  }),
);

aulasRouter.patch(
  '/:id',
  somenteAdmin,
  validar(atualizarAulaSchema),
  rota(async (req, res) => res.json(await servico.atualizarAula(param(req, 'id'), req.body))),
);

aulasRouter.post(
  '/:id/cancelar',
  somenteAdmin,
  validar(cancelarAulaSchema),
  rota(async (req, res) => {
    res.json(await servico.cancelarAula(param(req, 'id'), req.body.motivo, req.usuario!.id));
  }),
);

/* -------------------------------- Checkin ------------------------------ */

aulasRouter.get(
  '/:id/checkins',
  rota(async (req, res) => res.json(await presenca.listarCheckinsDaAula(param(req, 'id')))),
);

aulasRouter.post(
  '/:id/checkins',
  exigirPerfil(Role.ADMIN, Role.AULA),
  validar(checkinSchema.omit({ aulaId: true })),
  rota(async (req, res) => {
    const resultado = await presenca.fazerCheckin({
      aulaId: param(req, 'id'),
      alunoId: req.body.alunoId,
      origem: req.body.origem,
      // O admin pode liberar check-in fora da matricula (aula experimental).
      exigirMatriculaAtiva: false,
    });
    res.status(201).json(resultado);
  }),
);

aulasRouter.delete(
  '/:id/checkins/:alunoId',
  exigirPerfil(Role.ADMIN, Role.AULA),
  rota(async (req, res) => {
    res.json(
      await presenca.cancelarCheckin({
        aulaId: param(req, 'id'),
        alunoId: param(req, 'alunoId'),
        canceladoPor: req.usuario!.id,
      }),
    );
  }),
);

/* ------------------------------ Frequencia ----------------------------- */

aulasRouter.get(
  '/:id/frequencia',
  rota(async (req, res) => res.json(await presenca.listarFrequenciaDaAula(param(req, 'id')))),
);

aulasRouter.post(
  '/:id/frequencia',
  exigirPerfil(Role.ADMIN, Role.AULA),
  validar(registrarFrequenciaSchema),
  rota(async (req, res) => {
    res.status(201).json(
      await presenca.registrarFrequencia({
        aulaId: param(req, 'id'),
        alunoId: req.body.alunoId,
        status: req.body.status,
        observacao: req.body.observacao,
        origem: req.body.origem,
        registradoPor: req.usuario!.id,
      }),
    );
  }),
);

aulasRouter.post(
  '/:id/frequencia/lote',
  exigirPerfil(Role.ADMIN, Role.AULA),
  validar(frequenciaEmLoteSchema),
  rota(async (req, res) => {
    res.json(
      await presenca.registrarFrequenciaEmLote({
        aulaId: param(req, 'id'),
        registros: req.body.registros,
        origem: req.body.origem,
        registradoPor: req.usuario!.id,
        finalizarAula: req.body.finalizarAula,
      }),
    );
  }),
);

aulasRouter.get(
  '/relatorios/frequencia',
  somenteAdmin,
  validar(relatorioFrequenciaSchema, 'query'),
  rota(async (req, res) => res.json(await presenca.relatorioFrequencia(req.query as never))),
);
