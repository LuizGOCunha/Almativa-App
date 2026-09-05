import { Injectable } from '@angular/core';
import type {
  CampanhaDto,
  NotificacaoDto,
  Paginado,
  SegmentoCampanha,
  StatusCampanha,
} from '@almativa/shared';
import { ApiBase, paramsDe } from './api.base';

@Injectable({ providedIn: 'root' })
export class ComunicacaoApi extends ApiBase {
  notificacoes(filtros: { tipo?: string; apenasNaoLidas?: boolean; pagina?: number; porPagina?: number } = {}) {
    return this.http.get<Paginado<NotificacaoDto>>(this.url('/comunicacao/notificacoes'), {
      params: paramsDe(filtros),
    });
  }

  naoLidas() {
    return this.http.get<{ total: number }>(this.url('/comunicacao/notificacoes/nao-lidas'));
  }

  marcarLida(id: string) {
    return this.http.post<NotificacaoDto>(this.url(`/comunicacao/notificacoes/${id}/lida`), {});
  }

  lerTodas() {
    return this.http.post<{ atualizadas: number }>(
      this.url('/comunicacao/notificacoes/ler-todas'),
      {},
    );
  }

  arquivar(id: string) {
    return this.http.delete<void>(this.url(`/comunicacao/notificacoes/${id}`));
  }

  enviarAviso(dados: { alunoIds: string[]; titulo: string; mensagem: string; canais: string[] }) {
    return this.http.post<{ criadas: number }>(this.url('/comunicacao/notificacoes/enviar'), dados);
  }

  campanhas(status?: StatusCampanha) {
    return this.http.get<CampanhaDto[]>(this.url('/comunicacao/campanhas'), {
      params: paramsDe({ status }),
    });
  }

  campanha(id: string) {
    return this.http.get<CampanhaDto>(this.url(`/comunicacao/campanhas/${id}`));
  }

  previaSegmento(segmento: SegmentoCampanha) {
    return this.http.post<{ total: number; amostra: { id: string; nome: string; email: string | null }[] }>(
      this.url('/comunicacao/campanhas/previa-segmento'),
      segmento,
    );
  }

  criarCampanha(dados: Record<string, unknown>) {
    return this.http.post<CampanhaDto>(this.url('/comunicacao/campanhas'), dados);
  }

  atualizarCampanha(id: string, dados: Record<string, unknown>) {
    return this.http.patch<CampanhaDto>(this.url(`/comunicacao/campanhas/${id}`), dados);
  }

  enviarCampanha(id: string) {
    return this.http.post<{ enviados: number; alcancados: number }>(
      this.url(`/comunicacao/campanhas/${id}/enviar`),
      {},
    );
  }

  cancelarCampanha(id: string) {
    return this.http.post<CampanhaDto>(this.url(`/comunicacao/campanhas/${id}/cancelar`), {});
  }
}
