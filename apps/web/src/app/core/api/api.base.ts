import { inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/** Monta HttpParams ignorando null/undefined/''. */
export function paramsDe(valores: object): HttpParams {
  let params = new HttpParams();
  for (const [chave, valor] of Object.entries(valores)) {
    if (valor === null || valor === undefined || valor === '') continue;
    params = params.set(chave, String(valor));
  }
  return params;
}

/** Base compartilhada pelos servicos de API. */
export abstract class ApiBase {
  protected readonly http = inject(HttpClient);
  protected readonly api = environment.apiUrl;

  protected url(caminho: string): string {
    return `${this.api}${caminho}`;
  }
}
