import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Encaminha rejeicoes de handlers async para o middleware de erro. */
export function rota<T extends RequestHandler>(handler: T): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export interface OpcoesPaginacao {
  pagina: number;
  porPagina: number;
  pular: number;
}

export function lerPaginacao(query: Record<string, unknown>, porPaginaPadrao = 20): OpcoesPaginacao {
  const pagina = Math.max(1, Number(query['pagina']) || 1);
  const porPagina = Math.min(200, Math.max(1, Number(query['porPagina']) || porPaginaPadrao));
  return { pagina, porPagina, pular: (pagina - 1) * porPagina };
}

export function paginar<T>(itens: T[], total: number, opcoes: OpcoesPaginacao) {
  return {
    itens,
    total,
    pagina: opcoes.pagina,
    porPagina: opcoes.porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / opcoes.porPagina)),
  };
}

/**
 * No Express 5 os tipos de req.params sao `string | string[]` por causa dos
 * curingas. Nossas rotas usam apenas parametros nomeados simples.
 */
export function param(req: Request, nome: string): string {
  const valor = req.params[nome];
  return Array.isArray(valor) ? (valor[0] ?? '') : (valor ?? '');
}

/** Le uma query string simples, ignorando arrays e objetos. */
export function queryTexto(req: Request, nome: string): string | undefined {
  const valor = req.query[nome];
  return typeof valor === 'string' ? valor : undefined;
}
