import { Injectable } from '@angular/core';
import type {
  AlunoDto,
  AulaDto,
  CheckinDto,
  FrequenciaDto,
  MensalidadeDto,
  NotificacaoDto,
  Paginado,
  StatusCheckin,
} from '@almativa/shared';
import { ApiBase, paramsDe } from './api.base';

export interface AulaComCheckin extends AulaDto {
  meuCheckin: { status: StatusCheckin; posicaoFila: number | null } | null;
}

@Injectable({ providedIn: 'root' })
export class AlunoAreaApi extends ApiBase {
  perfil() {
    return this.http.get<AlunoDto>(this.url('/aluno/perfil'));
  }

  atualizarPerfil(dados: Record<string, unknown>) {
    return this.http.patch<AlunoDto>(this.url('/aluno/perfil'), dados);
  }

  agenda(de: string, ate: string) {
    return this.http.get<AulaComCheckin[]>(this.url('/aluno/agenda'), { params: paramsDe({ de, ate }) });
  }

  fazerCheckin(aulaId: string) {
    return this.http.post<CheckinDto>(this.url(`/aluno/aulas/${aulaId}/checkin`), {});
  }

  cancelarCheckin(aulaId: string) {
    return this.http.delete<{ cancelado: boolean }>(this.url(`/aluno/aulas/${aulaId}/checkin`));
  }

  checkins(futuros = true) {
    return this.http.get<CheckinDto[]>(this.url('/aluno/checkins'), { params: paramsDe({ futuros }) });
  }

  frequencia() {
    return this.http.get<FrequenciaDto[]>(this.url('/aluno/frequencia'));
  }

  mensalidades() {
    return this.http.get<Paginado<MensalidadeDto>>(this.url('/aluno/mensalidades'));
  }

  notificacoes(apenasNaoLidas = false, pagina = 1, porPagina = 30) {
    return this.http.get<Paginado<NotificacaoDto>>(this.url('/aluno/notificacoes'), {
      params: paramsDe({ apenasNaoLidas, pagina, porPagina }),
    });
  }

  naoLidas() {
    return this.http.get<{ total: number }>(this.url('/aluno/notificacoes/nao-lidas'));
  }

  marcarLida(id: string) {
    return this.http.post<NotificacaoDto>(this.url(`/aluno/notificacoes/${id}/lida`), {});
  }

  lerTodas() {
    return this.http.post<{ atualizadas: number }>(this.url('/aluno/notificacoes/ler-todas'), {});
  }
}
