import { Router } from 'express';
import { autenticar, somenteAdmin } from '../../middleware/autenticar.js';
import { validar } from '../../middleware/validar.js';
import { param, rota } from '../../utils/http.js';
import * as servico from './financeiro.service.js';
import * as renovacoes from './renovacoes.service.js';
import { historicoFinanceiroDoAluno } from './eventos.js';
import { mapEventoPagamento } from '../comum/mapeadores-eventos.js';
import {
  criarMensalidadeSchema,
  gerarMensalidadesSchema,
  listarMensalidadesSchema,
  listarPagamentosSchema,
  listarRenovacoesSchema,
  registrarPagamentoSchema,
} from './financeiro.schemas.js';

export const financeiroRouter = Router();

financeiroRouter.use(autenticar, somenteAdmin);

/* ----------------------------- Mensalidades ---------------------------- */

financeiroRouter.get(
  '/mensalidades',
  validar(listarMensalidadesSchema, 'query'),
  rota(async (req, res) => {
    res.json(await servico.listarMensalidades(req.query as never));
  }),
);

financeiroRouter.get(
  '/mensalidades/:id',
  rota(async (req, res) => res.json(await servico.obterMensalidade(param(req, 'id')))),
);

financeiroRouter.post(
  '/mensalidades',
  validar(criarMensalidadeSchema),
  rota(async (req, res) => {
    res.status(201).json(await servico.criarMensalidadeAvulsa(req.body, req.usuario!.id));
  }),
);

financeiroRouter.post(
  '/mensalidades/gerar',
  validar(gerarMensalidadesSchema),
  rota(async (req, res) => {
    const { competencia, matriculaIds, sobrescrever } = req.body;
    res.json(await servico.gerarMensalidades(competencia, { matriculaIds, sobrescrever }, req.usuario!.id));
  }),
);

financeiroRouter.post(
  '/mensalidades/marcar-vencidas',
  rota(async (_req, res) => {
    res.json({ atualizadas: await servico.marcarVencidas() });
  }),
);

financeiroRouter.delete(
  '/mensalidades/:id',
  rota(async (req, res) => res.json(await servico.cancelarMensalidade(param(req, 'id'), req.usuario!.id))),
);

/* ------------------------------ Pagamentos ----------------------------- */

financeiroRouter.get(
  '/pagamentos',
  validar(listarPagamentosSchema, 'query'),
  rota(async (req, res) => res.json(await servico.listarPagamentos(req.query as never))),
);

financeiroRouter.post(
  '/mensalidades/:id/pagamentos',
  validar(registrarPagamentoSchema),
  rota(async (req, res) => {
    res.status(201).json(await servico.registrarPagamento(param(req, 'id'), req.body, req.usuario!.id));
  }),
);

financeiroRouter.post(
  '/pagamentos/:id/estorno',
  rota(async (req, res) => {
    await servico.estornarPagamento(param(req, 'id'), req.usuario!.id);
    res.status(204).send();
  }),
);

/* ------------------------------ Renovacoes ----------------------------- */

financeiroRouter.get(
  '/renovacoes',
  validar(listarRenovacoesSchema, 'query'),
  rota(async (req, res) => {
    const { dias, incluirPendentes } = req.query as unknown as { dias: number; incluirPendentes: boolean };
    res.json(await renovacoes.listarRenovacoes({ dias, incluirPendentes }));
  }),
);

financeiroRouter.post(
  '/renovacoes/lembretes',
  rota(async (req, res) => {
    res.json(await renovacoes.dispararLembretesVencimento({ forcar: req.body?.forcar === true }));
  }),
);

/* -------------------------- Historico do aluno ------------------------- */

financeiroRouter.get(
  '/alunos/:alunoId/historico',
  rota(async (req, res) => {
    const eventos = await historicoFinanceiroDoAluno(param(req, 'alunoId'), 100);
    res.json(eventos.map(mapEventoPagamento));
  }),
);
