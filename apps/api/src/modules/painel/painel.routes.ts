import { Router } from 'express';
import { autenticar, somenteAdmin } from '../../middleware/autenticar.js';
import { rota } from '../../utils/http.js';
import { dashboard } from './painel.service.js';

export const painelRouter = Router();

painelRouter.use(autenticar, somenteAdmin);

painelRouter.get(
  '/dashboard',
  rota(async (_req, res) => res.json(await dashboard())),
);
