import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import type { ErroApi } from '@almativa/shared';

/** Snackbars padronizados + traducao de erros da API. */
@Injectable({ providedIn: 'root' })
export class AvisoService {
  private readonly snack = inject(MatSnackBar);

  sucesso(mensagem: string): void {
    this.snack.open(mensagem, 'OK', { duration: 4000, panelClass: 'alm-snack-sucesso' });
  }

  info(mensagem: string): void {
    this.snack.open(mensagem, 'OK', { duration: 4000 });
  }

  erro(erro: unknown, alternativa = 'Nao foi possivel concluir a acao.'): void {
    this.snack.open(mensagemDeErro(erro, alternativa), 'Fechar', {
      duration: 7000,
      panelClass: 'alm-snack-erro',
    });
  }
}

/** Extrai a mensagem legivel do envelope de erro da API. */
export function mensagemDeErro(erro: unknown, alternativa = 'Erro inesperado.'): string {
  if (erro instanceof HttpErrorResponse) {
    if (erro.status === 0) return 'Sem conexao com o servidor. Verifique se a API esta no ar.';
    const corpo = erro.error as ErroApi | undefined;
    if (corpo?.erro?.mensagem) {
      const detalhes = primeiroDetalhe(corpo.erro.detalhes);
      return detalhes ? `${corpo.erro.mensagem} ${detalhes}` : corpo.erro.mensagem;
    }
    return `${alternativa} (HTTP ${erro.status})`;
  }
  if (erro instanceof Error) return erro.message;
  return alternativa;
}

/** Pega a primeira mensagem util da arvore de erros do Zod. */
function primeiroDetalhe(detalhes: unknown): string | null {
  if (!detalhes || typeof detalhes !== 'object') return null;
  const fila: unknown[] = [detalhes];

  while (fila.length > 0) {
    const atual = fila.shift();
    if (!atual || typeof atual !== 'object') continue;

    const no = atual as { errors?: unknown; properties?: Record<string, unknown>; items?: unknown[] };
    if (Array.isArray(no.errors) && no.errors.length > 0 && typeof no.errors[0] === 'string') {
      return no.errors[0];
    }
    if (no.properties) fila.push(...Object.values(no.properties));
    if (Array.isArray(no.items)) fila.push(...no.items);
  }
  return null;
}
