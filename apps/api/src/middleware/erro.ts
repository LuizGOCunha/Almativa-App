import type { NextFunction, Request, Response } from 'express';
import { ZodError, z } from 'zod';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { ErroApp } from '../utils/erros.js';

/** Codigos conhecidos do Prisma que viram erro de negocio. */
function traduzirPrisma(erro: { code?: string; meta?: Record<string, unknown> }): ErroApp | null {
  switch (erro.code) {
    case 'P2002': {
      const campos = (erro.meta?.['target'] as string[] | undefined)?.join(', ') ?? 'registro';
      return new ErroApp(409, 'DUPLICADO', `Já existe um registro com este valor: ${campos}.`);
    }
    case 'P2003':
      return new ErroApp(409, 'VINCULO_INVALIDO', 'Referência informada não existe.');
    case 'P2025':
      return new ErroApp(404, 'NAO_ENCONTRADO', 'Registro não encontrado.');
    default:
      return null;
  }
}

export function rotaNaoEncontrada(req: Request, res: Response): void {
  res.status(404).json({
    erro: { codigo: 'ROTA_NAO_ENCONTRADA', mensagem: `Rota ${req.method} ${req.originalUrl} não existe.` },
  });
}

export function tratarErro(
  erro: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let resposta: ErroApp;

  if (erro instanceof ErroApp) {
    resposta = erro;
  } else if (erro instanceof ZodError) {
    resposta = new ErroApp(422, 'VALIDACAO', 'Dados inválidos na requisição.', z.treeifyError(erro));
  } else if (typeof erro === 'object' && erro !== null && 'code' in erro) {
    resposta =
      traduzirPrisma(erro as { code?: string; meta?: Record<string, unknown> }) ??
      new ErroApp(500, 'ERRO_INTERNO', 'Erro inesperado no servidor.');
  } else {
    resposta = new ErroApp(500, 'ERRO_INTERNO', 'Erro inesperado no servidor.');
  }

  if (resposta.status >= 500) {
    logger.error({ erro, rota: `${req.method} ${req.originalUrl}` }, 'Falha nao tratada');
  } else {
    logger.debug({ codigo: resposta.codigo, rota: `${req.method} ${req.originalUrl}` }, resposta.message);
  }

  res.status(resposta.status).json({
    erro: {
      codigo: resposta.codigo,
      mensagem: resposta.message,
      ...(resposta.detalhes ? { detalhes: resposta.detalhes } : {}),
      ...(!env.ehProducao && resposta.status >= 500 && erro instanceof Error
        ? { stack: erro.stack }
        : {}),
    },
  });
}
