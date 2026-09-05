import { Injectable } from '@angular/core';
import type {
  AlunoDto,
  CheckinDto,
  FrequenciaDto,
  MatriculaDto,
  MensalidadeDto,
  Paginado,
  StatusAluno,
} from '@almativa/shared';
import { ApiBase, paramsDe } from './api.base';

export interface FiltrosAluno {
  busca?: string;
  status?: StatusAluno;
  modalidadeId?: string;
  planoId?: string;
  inadimplentes?: boolean;
  pagina?: number;
  porPagina?: number;
  ordenarPor?: 'nome' | 'criadoEm' | 'dataMatricula';
  ordem?: 'asc' | 'desc';
}

@Injectable({ providedIn: 'root' })
export class AlunosApi extends ApiBase {
  listar(filtros: FiltrosAluno = {}) {
    return this.http.get<Paginado<AlunoDto>>(this.url('/alunos'), { params: paramsDe(filtros) });
  }

  obter(id: string) {
    return this.http.get<AlunoDto>(this.url(`/alunos/${id}`));
  }

  criar(dados: Record<string, unknown>) {
    return this.http.post<{ aluno: AlunoDto; senhaProvisoria?: string }>(this.url('/alunos'), dados);
  }

  atualizar(id: string, dados: Record<string, unknown>) {
    return this.http.patch<AlunoDto>(this.url(`/alunos/${id}`), dados);
  }

  remover(id: string) {
    return this.http.delete<void>(this.url(`/alunos/${id}`));
  }

  criarAcesso(id: string, email: string, senha?: string) {
    return this.http.post<{ email: string; senhaProvisoria?: string }>(
      this.url(`/alunos/${id}/acesso`),
      { email, senha },
    );
  }

  redefinirSenha(id: string) {
    return this.http.post<{ email: string; senhaProvisoria: string }>(
      this.url(`/alunos/${id}/acesso/redefinir-senha`),
      {},
    );
  }

  matriculas(id: string) {
    return this.http.get<MatriculaDto[]>(this.url(`/alunos/${id}/matriculas`));
  }

  criarMatricula(id: string, dados: Record<string, unknown>) {
    return this.http.post<MatriculaDto>(this.url(`/alunos/${id}/matriculas`), dados);
  }

  atualizarMatricula(matriculaId: string, dados: Record<string, unknown>) {
    return this.http.patch<MatriculaDto>(this.url(`/alunos/matriculas/${matriculaId}`), dados);
  }

  cancelarMatricula(matriculaId: string) {
    return this.http.delete<void>(this.url(`/alunos/matriculas/${matriculaId}`));
  }

  mensalidades(id: string) {
    return this.http.get<Paginado<MensalidadeDto>>(this.url(`/alunos/${id}/mensalidades`));
  }

  frequencia(id: string) {
    return this.http.get<FrequenciaDto[]>(this.url(`/alunos/${id}/frequencia`));
  }

  checkins(id: string, futuros = true) {
    return this.http.get<CheckinDto[]>(this.url(`/alunos/${id}/checkins`), {
      params: paramsDe({ futuros }),
    });
  }
}
