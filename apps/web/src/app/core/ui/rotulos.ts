import type {
  MetodoPagamento,
  StatusAluno,
  StatusAula,
  StatusCampanha,
  StatusCheckin,
  StatusFrequencia,
  StatusMatricula,
  StatusMensalidade,
  TipoNotificacao,
} from '@almativa/shared';

export type Tom = 'sucesso' | 'alerta' | 'erro' | 'info' | 'neutro';

export interface Rotulo {
  texto: string;
  tom: Tom;
  icone?: string;
}

/**
 * As linhas do mat-table chegam ao template como `any`, então os mapas
 * precisam aceitar índice string — sem abrir mão da checagem de que todas
 * as chaves do enum estão presentes.
 */
export type MapaRotulos<T extends string> = Record<T, Rotulo> & Record<string, Rotulo>;

export const ROTULO_STATUS_ALUNO: MapaRotulos<StatusAluno> = {
  ATIVO: { texto: 'Ativo', tom: 'sucesso' },
  INATIVO: { texto: 'Inativo', tom: 'neutro' },
  TRANCADO: { texto: 'Trancado', tom: 'alerta' },
};

export const ROTULO_STATUS_MATRICULA: MapaRotulos<StatusMatricula> = {
  ATIVA: { texto: 'Ativa', tom: 'sucesso' },
  SUSPENSA: { texto: 'Suspensa', tom: 'alerta' },
  CANCELADA: { texto: 'Cancelada', tom: 'neutro' },
};

export const ROTULO_STATUS_MENSALIDADE: MapaRotulos<StatusMensalidade> = {
  ABERTA: { texto: 'Em aberto', tom: 'info', icone: 'schedule' },
  PAGA: { texto: 'Paga', tom: 'sucesso', icone: 'check_circle' },
  VENCIDA: { texto: 'Vencida', tom: 'erro', icone: 'error' },
  CANCELADA: { texto: 'Cancelada', tom: 'neutro', icone: 'block' },
};

export const ROTULO_STATUS_AULA: MapaRotulos<StatusAula> = {
  AGENDADA: { texto: 'Agendada', tom: 'info' },
  EM_ANDAMENTO: { texto: 'Em andamento', tom: 'alerta' },
  REALIZADA: { texto: 'Realizada', tom: 'sucesso' },
  CANCELADA: { texto: 'Cancelada', tom: 'erro' },
};

export const ROTULO_STATUS_CHECKIN: MapaRotulos<StatusCheckin> = {
  CONFIRMADO: { texto: 'Vaga garantida', tom: 'sucesso', icone: 'how_to_reg' },
  LISTA_ESPERA: { texto: 'Lista de espera', tom: 'alerta', icone: 'hourglass_top' },
  CANCELADO: { texto: 'Cancelado', tom: 'neutro', icone: 'close' },
};

export const ROTULO_STATUS_FREQUENCIA: MapaRotulos<StatusFrequencia> = {
  PRESENTE: { texto: 'Presente', tom: 'sucesso', icone: 'check' },
  AUSENTE: { texto: 'Faltou', tom: 'erro', icone: 'close' },
  JUSTIFICADA: { texto: 'Justificada', tom: 'alerta', icone: 'event_busy' },
};

export const ROTULO_STATUS_CAMPANHA: MapaRotulos<StatusCampanha> = {
  RASCUNHO: { texto: 'Rascunho', tom: 'neutro' },
  AGENDADA: { texto: 'Agendada', tom: 'info' },
  ENVIANDO: { texto: 'Enviando', tom: 'alerta' },
  ENVIADA: { texto: 'Enviada', tom: 'sucesso' },
  CANCELADA: { texto: 'Cancelada', tom: 'erro' },
};

export const ROTULO_METODO: Record<MetodoPagamento, string> & Record<string, string> = {
  PIX: 'Pix',
  CARTAO_CREDITO: 'Cartao de credito',
  CARTAO_DEBITO: 'Cartao de debito',
  DINHEIRO: 'Dinheiro',
  BOLETO: 'Boleto',
  TRANSFERENCIA: 'Transferencia',
};

export const ICONE_NOTIFICACAO: Record<TipoNotificacao, string> & Record<string, string> = {
  VENCIMENTO_PROXIMO: 'event_upcoming',
  VENCIMENTO_ATRASADO: 'report',
  PAGAMENTO_CONFIRMADO: 'paid',
  LEMBRETE_AULA: 'alarm',
  AULA_CANCELADA: 'event_busy',
  CHECKIN_CONFIRMADO: 'how_to_reg',
  VAGA_LIBERADA: 'confirmation_number',
  CAMPANHA: 'campaign',
  SISTEMA: 'info',
};

export const METODOS_PAGAMENTO = Object.keys(ROTULO_METODO) as MetodoPagamento[];
