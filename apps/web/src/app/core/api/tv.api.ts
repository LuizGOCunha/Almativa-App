import { Injectable } from '@angular/core';
import type { PainelAulaDto, PlaylistDto, TimerPresetDto } from '@almativa/shared';
import { ApiBase, paramsDe } from './api.base';

export interface DispositivoDto {
  id: string;
  nome: string;
  sala: string | null;
  ativo: boolean;
  ultimoAcessoEm: string | null;
  expiraEm: string;
  criadoEm: string;
}

@Injectable({ providedIn: 'root' })
export class TvApi extends ApiBase {
  painel() {
    return this.http.get<PainelAulaDto>(this.url('/tv/painel'));
  }

  timers(opcoes: { modalidadeId?: string; todos?: boolean } = {}) {
    return this.http.get<TimerPresetDto[]>(this.url('/tv/timers'), { params: paramsDe(opcoes) });
  }

  criarTimer(dados: Record<string, unknown>) {
    return this.http.post<TimerPresetDto>(this.url('/tv/timers'), dados);
  }

  atualizarTimer(id: string, dados: Record<string, unknown>) {
    return this.http.patch<TimerPresetDto>(this.url(`/tv/timers/${id}`), dados);
  }

  removerTimer(id: string) {
    return this.http.delete<void>(this.url(`/tv/timers/${id}`));
  }

  playlists(opcoes: { modalidadeId?: string; todas?: boolean } = {}) {
    return this.http.get<PlaylistDto[]>(this.url('/tv/playlists'), { params: paramsDe(opcoes) });
  }

  criarPlaylist(dados: Record<string, unknown>) {
    return this.http.post<PlaylistDto>(this.url('/tv/playlists'), dados);
  }

  atualizarPlaylist(id: string, dados: Record<string, unknown>) {
    return this.http.patch<PlaylistDto>(this.url(`/tv/playlists/${id}`), dados);
  }

  removerPlaylist(id: string) {
    return this.http.delete<void>(this.url(`/tv/playlists/${id}`));
  }

  /* Dispositivos da sala (perfil AULA) */
  dispositivos() {
    return this.http.get<DispositivoDto[]>(this.url('/auth/dispositivos'));
  }

  criarDispositivo(nome: string, sala: string | null, diasValidade = 365) {
    return this.http.post<{ token: string; nomeDispositivo: string; expiraEm: string; id: string }>(
      this.url('/auth/dispositivos'),
      { nome, sala, diasValidade },
    );
  }

  revogarDispositivo(id: string) {
    return this.http.delete<void>(this.url(`/auth/dispositivos/${id}`));
  }
}
