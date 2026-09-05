import { Injectable } from '@angular/core';
import type {
  AulaDto,
  CheckinDto,
  FrequenciaDto,
  StatusAula,
  StatusFrequencia,
} from '@almativa/shared';
import { ApiBase, paramsDe } from './api.base';

export interface AulaDetalheDto extends AulaDto {
  listaCheckins: CheckinDto[];
  listaFrequencia: FrequenciaDto[];
}

export interface LinhaRelatorioFrequencia {
  alunoId: string;
  alunoNome: string;
  presencas: number;
  ausencias: number;
  justificadas: number;
  totalAulas: number;
  aproveitamento: number;
  ultimaAula: string | null;
}

@Injectable({ providedIn: 'root' })
export class AulasApi extends ApiBase {
  listar(filtros: {
    de: string;
    ate: string;
    turmaId?: string;
    modalidadeId?: string;
    instrutorId?: string;
    status?: StatusAula;
  }) {
    return this.http.get<AulaDto[]>(this.url('/aulas'), { params: paramsDe(filtros) });
  }

  obter(id: string) {
    return this.http.get<AulaDetalheDto>(this.url(`/aulas/${id}`));
  }

  gerar(de: string, ate: string, turmaIds?: string[]) {
    return this.http.post<{ criadas: number; existentes: number }>(this.url('/aulas/gerar'), {
      de,
      ate,
      turmaIds,
    });
  }

  atualizar(id: string, dados: Record<string, unknown>) {
    return this.http.patch<AulaDto>(this.url(`/aulas/${id}`), dados);
  }

  cancelar(id: string, motivo: string | null) {
    return this.http.post<{ cancelada: boolean; checkinsLiberados: number }>(
      this.url(`/aulas/${id}/cancelar`),
      { motivo },
    );
  }

  checkins(id: string) {
    return this.http.get<CheckinDto[]>(this.url(`/aulas/${id}/checkins`));
  }

  adicionarCheckin(aulaId: string, alunoId: string, origem = 'PAINEL_ADMIN') {
    return this.http.post<CheckinDto>(this.url(`/aulas/${aulaId}/checkins`), { alunoId, origem });
  }

  removerCheckin(aulaId: string, alunoId: string) {
    return this.http.delete<{ cancelado: boolean; promovido: string | null }>(
      this.url(`/aulas/${aulaId}/checkins/${alunoId}`),
    );
  }

  frequencia(id: string) {
    return this.http.get<FrequenciaDto[]>(this.url(`/aulas/${id}/frequencia`));
  }

  registrarPresenca(
    aulaId: string,
    alunoId: string,
    status: StatusFrequencia,
    origem = 'PAINEL_ADMIN',
    observacao: string | null = null,
  ) {
    return this.http.post<FrequenciaDto>(this.url(`/aulas/${aulaId}/frequencia`), {
      alunoId,
      status,
      origem,
      observacao,
    });
  }

  fecharChamada(
    aulaId: string,
    registros: { alunoId: string; status: StatusFrequencia; observacao: string | null }[],
    finalizarAula = true,
    origem = 'PAINEL_ADMIN',
  ) {
    return this.http.post<{ registrados: number; presentes: number }>(
      this.url(`/aulas/${aulaId}/frequencia/lote`),
      { registros, finalizarAula, origem },
    );
  }

  relatorioFrequencia(filtros: {
    de: string;
    ate: string;
    alunoId?: string;
    turmaId?: string;
    modalidadeSlug?: string;
  }) {
    return this.http.get<LinhaRelatorioFrequencia[]>(this.url('/aulas/relatorios/frequencia'), {
      params: paramsDe(filtros),
    });
  }
}
