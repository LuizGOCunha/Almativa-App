import { Injectable } from '@angular/core';
import type { InstrutorDto, ModalidadeDto, PlanoDto, TurmaDto } from '@almativa/shared';
import { ApiBase, paramsDe } from './api.base';

@Injectable({ providedIn: 'root' })
export class CatalogoApi extends ApiBase {
  /* Modalidades */
  modalidades(apenasAtivas = false) {
    return this.http.get<ModalidadeDto[]>(this.url('/catalogo/modalidades'), {
      params: paramsDe({ ativas: apenasAtivas || null }),
    });
  }

  criarModalidade(dados: Partial<ModalidadeDto> & { ordem?: number }) {
    return this.http.post<ModalidadeDto>(this.url('/catalogo/modalidades'), dados);
  }

  atualizarModalidade(id: string, dados: Partial<ModalidadeDto>) {
    return this.http.patch<ModalidadeDto>(this.url(`/catalogo/modalidades/${id}`), dados);
  }

  removerModalidade(id: string) {
    return this.http.delete<void>(this.url(`/catalogo/modalidades/${id}`));
  }

  /* Instrutores */
  instrutores(apenasAtivos = false) {
    return this.http.get<InstrutorDto[]>(this.url('/catalogo/instrutores'), {
      params: paramsDe({ ativos: apenasAtivos || null }),
    });
  }

  criarInstrutor(dados: Record<string, unknown>) {
    return this.http.post<InstrutorDto>(this.url('/catalogo/instrutores'), dados);
  }

  atualizarInstrutor(id: string, dados: Record<string, unknown>) {
    return this.http.patch<InstrutorDto>(this.url(`/catalogo/instrutores/${id}`), dados);
  }

  removerInstrutor(id: string) {
    return this.http.delete<void>(this.url(`/catalogo/instrutores/${id}`));
  }

  /* Planos */
  planos(apenasAtivos = false) {
    return this.http.get<PlanoDto[]>(this.url('/catalogo/planos'), {
      params: paramsDe({ ativos: apenasAtivos || null }),
    });
  }

  criarPlano(dados: Record<string, unknown>) {
    return this.http.post<PlanoDto>(this.url('/catalogo/planos'), dados);
  }

  atualizarPlano(id: string, dados: Record<string, unknown>) {
    return this.http.patch<PlanoDto>(this.url(`/catalogo/planos/${id}`), dados);
  }

  removerPlano(id: string) {
    return this.http.delete<void>(this.url(`/catalogo/planos/${id}`));
  }

  /* Turmas */
  turmas(filtros: { ativo?: boolean; modalidadeId?: string } = {}) {
    return this.http.get<TurmaDto[]>(this.url('/catalogo/turmas'), { params: paramsDe(filtros) });
  }

  criarTurma(dados: Record<string, unknown>) {
    return this.http.post<TurmaDto>(this.url('/catalogo/turmas'), dados);
  }

  atualizarTurma(id: string, dados: Record<string, unknown>) {
    return this.http.patch<TurmaDto>(this.url(`/catalogo/turmas/${id}`), dados);
  }

  removerTurma(id: string) {
    return this.http.delete<void>(this.url(`/catalogo/turmas/${id}`));
  }
}
