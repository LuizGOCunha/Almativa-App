import { describe, expect, it } from 'vitest';
import type { Router } from 'express';
import { authRouter } from './auth/auth.routes.js';
import { catalogoRouter } from './catalogo/catalogo.routes.js';
import { alunosRouter } from './alunos/alunos.routes.js';
import { aulasRouter } from './aulas/aulas.routes.js';
import { financeiroRouter } from './financeiro/financeiro.routes.js';
import { comunicacaoRouter } from './comunicacao/comunicacao.routes.js';
import { alunoAreaRouter } from './aluno-area/aluno-area.routes.js';
import { tvRouter } from './tv/tv.routes.js';
import { publicoRouter } from './publico/publico.routes.js';

interface RotaRegistrada {
  metodo: string;
  caminho: string;
  ordem: number;
}

/** Le a pilha do Express na ordem em que as rotas foram registradas. */
function lerRotas(router: Router): RotaRegistrada[] {
  const pilha = (router as unknown as { stack: RotaCrua[] }).stack ?? [];
  const rotas: RotaRegistrada[] = [];

  pilha.forEach((camada, ordem) => {
    if (!camada.route) return;
    for (const metodo of Object.keys(camada.route.methods ?? {})) {
      rotas.push({ metodo: metodo.toUpperCase(), caminho: camada.route.path, ordem });
    }
  });

  return rotas;
}

interface RotaCrua {
  route?: { path: string; methods: Record<string, boolean> };
}

/**
 * `anterior` engole `posterior` quando tem o mesmo metodo, o mesmo numero de
 * segmentos, e cada segmento ou e igual ou e um parametro que aceita
 * qualquer coisa — com ao menos um parametro cobrindo um literal.
 */
function engole(anterior: string, posterior: string): boolean {
  const a = anterior.split('/').filter(Boolean);
  const b = posterior.split('/').filter(Boolean);
  if (a.length !== b.length) return false;

  let cobriuLiteral = false;
  for (let i = 0; i < a.length; i++) {
    const segA = a[i];
    const segB = b[i];
    if (segA.startsWith(':')) {
      if (!segB.startsWith(':')) cobriuLiteral = true;
      continue;
    }
    if (segA !== segB) return false;
  }
  return cobriuLiteral;
}

const routers: [string, Router][] = [
  ['auth', authRouter],
  ['catalogo', catalogoRouter],
  ['alunos', alunosRouter],
  ['aulas', aulasRouter],
  ['financeiro', financeiroRouter],
  ['comunicacao', comunicacaoRouter],
  ['aluno-area', alunoAreaRouter],
  ['tv', tvRouter],
  ['publico', publicoRouter],
];

describe('ordem de registro das rotas', () => {
  /**
   * Regressão: `GET /aulas/:id/frequencia` estava registrado antes de
   * `GET /aulas/relatorios/frequencia` e capturava a chamada com
   * id="relatorios". O relatório respondia 200 com lista vazia — o front
   * exibia "nenhum registro" achando que era estado vazio legítimo.
   */
  it.each(routers)('nenhuma rota literal é engolida por uma paramétrica em %s', (_nome, router) => {
    const rotas = lerRotas(router);
    const conflitos: string[] = [];

    for (const posterior of rotas) {
      for (const anterior of rotas) {
        if (anterior.ordem >= posterior.ordem) continue;
        if (anterior.metodo !== posterior.metodo) continue;
        if (engole(anterior.caminho, posterior.caminho)) {
          conflitos.push(
            `${posterior.metodo} ${posterior.caminho} nunca é alcançada: ` +
              `${anterior.metodo} ${anterior.caminho} casa antes`,
          );
        }
      }
    }

    expect(conflitos).toEqual([]);
  });

  it('o relatório de frequência vem antes das rotas de :id', () => {
    const rotas = lerRotas(aulasRouter);
    const relatorio = rotas.find((r) => r.caminho === '/relatorios/frequencia');
    const porId = rotas.find((r) => r.caminho === '/:id/frequencia' && r.metodo === 'GET');

    expect(relatorio).toBeDefined();
    expect(porId).toBeDefined();
    expect(relatorio!.ordem).toBeLessThan(porId!.ordem);
  });
});

describe('helper engole()', () => {
  it('detecta o caso que quebrou', () => {
    expect(engole('/:id/frequencia', '/relatorios/frequencia')).toBe(true);
  });

  it('não acusa quando o número de segmentos difere', () => {
    expect(engole('/:id', '/relatorios/frequencia')).toBe(false);
  });

  it('não acusa entre literais distintos', () => {
    expect(engole('/mensalidades/gerar', '/mensalidades/marcar-vencidas')).toBe(false);
  });

  it('não acusa a paramétrica contra ela mesma', () => {
    expect(engole('/:id/frequencia', '/:id/frequencia')).toBe(false);
  });
});
