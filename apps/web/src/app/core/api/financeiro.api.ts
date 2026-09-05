import { Injectable } from '@angular/core';
import type {
  EventoPagamentoDto,
  MensalidadeDto,
  MetodoPagamento,
  Paginado,
  PagamentoDto,
  RenovacaoDto,
  StatusMensalidade,
} from '@almativa/shared';
import { ApiBase, paramsDe } from './api.base';

@Injectable({ providedIn: 'root' })
export class FinanceiroApi extends ApiBase {
  mensalidades(filtros: {
    alunoId?: string;
    competencia?: string;
    status?: StatusMensalidade;
    vencimentoDe?: string;
    vencimentoAte?: string;
    busca?: string;
    pagina?: number;
    porPagina?: number;
  }) {
    return this.http.get<Paginado<MensalidadeDto>>(this.url('/financeiro/mensalidades'), {
      params: paramsDe(filtros),
    });
  }

  mensalidade(id: string) {
    return this.http.get<MensalidadeDto>(this.url(`/financeiro/mensalidades/${id}`));
  }

  gerarMensalidades(competencia: string, sobrescrever = false) {
    return this.http.post<{ geradas: number; ignoradas: number; competencia: string }>(
      this.url('/financeiro/mensalidades/gerar'),
      { competencia, sobrescrever },
    );
  }

  criarMensalidade(dados: Record<string, unknown>) {
    return this.http.post<MensalidadeDto>(this.url('/financeiro/mensalidades'), dados);
  }

  cancelarMensalidade(id: string) {
    return this.http.delete<MensalidadeDto>(this.url(`/financeiro/mensalidades/${id}`));
  }

  marcarVencidas() {
    return this.http.post<{ atualizadas: number }>(
      this.url('/financeiro/mensalidades/marcar-vencidas'),
      {},
    );
  }

  registrarPagamento(
    mensalidadeId: string,
    dados: {
      valorCentavos: number;
      metodo: MetodoPagamento;
      pagoEm?: string;
      referenciaExterna?: string | null;
      observacao?: string | null;
    },
  ) {
    return this.http.post<MensalidadeDto>(
      this.url(`/financeiro/mensalidades/${mensalidadeId}/pagamentos`),
      dados,
    );
  }

  estornarPagamento(id: string) {
    return this.http.post<void>(this.url(`/financeiro/pagamentos/${id}/estorno`), {});
  }

  pagamentos(filtros: {
    alunoId?: string;
    de?: string;
    ate?: string;
    metodo?: MetodoPagamento;
    pagina?: number;
    porPagina?: number;
  }) {
    return this.http.get<Paginado<PagamentoDto>>(this.url('/financeiro/pagamentos'), {
      params: paramsDe(filtros),
    });
  }

  renovacoes(dias = 10, incluirPendentes = true) {
    return this.http.get<RenovacaoDto[]>(this.url('/financeiro/renovacoes'), {
      params: paramsDe({ dias, incluirPendentes }),
    });
  }

  dispararLembretes(forcar = false) {
    return this.http.post<{ analisadas: number; notificados: number }>(
      this.url('/financeiro/renovacoes/lembretes'),
      { forcar },
    );
  }

  historicoDoAluno(alunoId: string) {
    return this.http.get<EventoPagamentoDto[]>(this.url(`/financeiro/alunos/${alunoId}/historico`));
  }
}
