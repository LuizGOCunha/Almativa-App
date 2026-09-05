import type { NextFunction, Request, Response } from 'express';
import { z, type ZodType } from 'zod';
import { ErroApp } from '../utils/erros.js';

type Alvo = 'body' | 'query' | 'params';

/** Valida e substitui req[alvo] pelo objeto ja tipado. */
export function validar(esquema: ZodType, alvo: Alvo = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const resultado = esquema.safeParse(req[alvo]);
    if (!resultado.success) {
      const detalhes = z.treeifyError(resultado.error);
      throw new ErroApp(422, 'VALIDACAO', 'Dados inválidos na requisição.', detalhes);
    }
    if (alvo === 'query') {
      // req.query e getter-only no Express 5.
      Object.defineProperty(req, 'query', { value: resultado.data, writable: true });
    } else {
      req[alvo] = resultado.data as never;
    }
    next();
  };
}
