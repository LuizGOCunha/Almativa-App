import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validar } from '../../middleware/validar.js';
import { autenticar, somenteAdmin } from '../../middleware/autenticar.js';
import { param, rota } from '../../utils/http.js';
import * as servico from './auth.service.js';
import {
  criarDispositivoSchema,
  loginSchema,
  parearDispositivoSchema,
  refreshSchema,
  trocarSenhaSchema,
} from './auth.schemas.js';

const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { erro: { codigo: 'MUITAS_TENTATIVAS', mensagem: 'Muitas tentativas. Tente de novo em alguns minutos.' } },
});

export const authRouter = Router();

authRouter.post(
  '/login',
  limitadorLogin,
  validar(loginSchema),
  rota(async (req, res) => {
    const { email, senha } = req.body;
    const sessao = await servico.login(email, senha, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    res.json(sessao);
  }),
);

authRouter.post(
  '/refresh',
  validar(refreshSchema),
  rota(async (req, res) => {
    const sessao = await servico.renovar(req.body.refreshToken, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    res.json(sessao);
  }),
);

authRouter.post(
  '/logout',
  autenticar,
  rota(async (req, res) => {
    await servico.sair(req.body?.refreshToken, req.usuario!.id);
    res.status(204).send();
  }),
);

authRouter.get(
  '/me',
  autenticar,
  rota(async (req, res) => {
    res.json(await servico.perfil(req.usuario!.id));
  }),
);

authRouter.post(
  '/trocar-senha',
  autenticar,
  validar(trocarSenhaSchema),
  rota(async (req, res) => {
    await servico.trocarSenha(req.usuario!.id, req.body.senhaAtual, req.body.novaSenha);
    res.status(204).send();
  }),
);

/* ----------------------- Dispositivos (perfil AULA) ---------------------- */

authRouter.post(
  '/dispositivos',
  autenticar,
  somenteAdmin,
  validar(criarDispositivoSchema),
  rota(async (req, res) => {
    const { nome, sala, diasValidade } = req.body;
    res.status(201).json(await servico.criarDispositivo(nome, sala, diasValidade));
  }),
);

authRouter.get(
  '/dispositivos',
  autenticar,
  somenteAdmin,
  rota(async (_req, res) => {
    res.json(await servico.listarDispositivos());
  }),
);

authRouter.delete(
  '/dispositivos/:id',
  autenticar,
  somenteAdmin,
  rota(async (req, res) => {
    await servico.revogarDispositivo(param(req, 'id'));
    res.status(204).send();
  }),
);

/** A tela da sala troca o token de pareamento por um access token. */
authRouter.post(
  '/dispositivos/parear',
  limitadorLogin,
  validar(parearDispositivoSchema),
  rota(async (req, res) => {
    res.json(await servico.autenticarDispositivo(req.body.token));
  }),
);
