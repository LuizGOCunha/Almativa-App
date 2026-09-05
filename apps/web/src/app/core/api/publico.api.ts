import { Injectable } from '@angular/core';
import type {
  AulaGradeDto,
  ContatoRequest,
  InstrutorDto,
  ModalidadeDto,
  PlanoDto,
} from '@almativa/shared';
import { ApiBase } from './api.base';

export interface ConfiguracoesSite {
  contato?: {
    telefone: string;
    whatsapp: string;
    email: string;
    endereco: string;
    instagram: string;
    horarioFuncionamento: string;
  };
  site?: { chamada: string; subtitulo: string; sobre: string };
}

@Injectable({ providedIn: 'root' })
export class PublicoApi extends ApiBase {
  modalidades() {
    return this.http.get<ModalidadeDto[]>(this.url('/publico/modalidades'));
  }

  planos() {
    return this.http.get<PlanoDto[]>(this.url('/publico/planos'));
  }

  instrutores() {
    return this.http.get<InstrutorDto[]>(this.url('/publico/instrutores'));
  }

  grade() {
    return this.http.get<AulaGradeDto[]>(this.url('/publico/grade'));
  }

  configuracoes() {
    return this.http.get<ConfiguracoesSite>(this.url('/publico/configuracoes'));
  }

  enviarContato(dados: ContatoRequest) {
    return this.http.post<{ recebido: boolean }>(this.url('/publico/contato'), dados);
  }
}
