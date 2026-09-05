/**
 * Enumeracoes de dominio compartilhadas entre a API e o front.
 * Os valores sao identicos aos enums do Prisma (Postgres) e aos valores
 * gravados nas colecoes de eventos do MongoDB.
 */

export const Role = {
  ADMIN: 'ADMIN',
  ALUNO: 'ALUNO',
  AULA: 'AULA',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const StatusAluno = {
  ATIVO: 'ATIVO',
  INATIVO: 'INATIVO',
  TRANCADO: 'TRANCADO',
} as const;
export type StatusAluno = (typeof StatusAluno)[keyof typeof StatusAluno];

export const StatusMatricula = {
  ATIVA: 'ATIVA',
  SUSPENSA: 'SUSPENSA',
  CANCELADA: 'CANCELADA',
} as const;
export type StatusMatricula = (typeof StatusMatricula)[keyof typeof StatusMatricula];

export const Periodicidade = {
  MENSAL: 'MENSAL',
  TRIMESTRAL: 'TRIMESTRAL',
  SEMESTRAL: 'SEMESTRAL',
  ANUAL: 'ANUAL',
} as const;
export type Periodicidade = (typeof Periodicidade)[keyof typeof Periodicidade];

/** Quantidade de meses cobertos por cada periodicidade. */
export const MESES_POR_PERIODICIDADE: Record<Periodicidade, number> = {
  MENSAL: 1,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
};

export const StatusMensalidade = {
  ABERTA: 'ABERTA',
  PAGA: 'PAGA',
  VENCIDA: 'VENCIDA',
  CANCELADA: 'CANCELADA',
} as const;
export type StatusMensalidade = (typeof StatusMensalidade)[keyof typeof StatusMensalidade];

export const MetodoPagamento = {
  PIX: 'PIX',
  CARTAO_CREDITO: 'CARTAO_CREDITO',
  CARTAO_DEBITO: 'CARTAO_DEBITO',
  DINHEIRO: 'DINHEIRO',
  BOLETO: 'BOLETO',
  TRANSFERENCIA: 'TRANSFERENCIA',
} as const;
export type MetodoPagamento = (typeof MetodoPagamento)[keyof typeof MetodoPagamento];

export const StatusAula = {
  AGENDADA: 'AGENDADA',
  EM_ANDAMENTO: 'EM_ANDAMENTO',
  REALIZADA: 'REALIZADA',
  CANCELADA: 'CANCELADA',
} as const;
export type StatusAula = (typeof StatusAula)[keyof typeof StatusAula];

/** Check-in garante a vaga na aula. */
export const StatusCheckin = {
  CONFIRMADO: 'CONFIRMADO',
  LISTA_ESPERA: 'LISTA_ESPERA',
  CANCELADO: 'CANCELADO',
} as const;
export type StatusCheckin = (typeof StatusCheckin)[keyof typeof StatusCheckin];

/** Frequencia confirma que o aluno de fato fez a aula. */
export const StatusFrequencia = {
  PRESENTE: 'PRESENTE',
  AUSENTE: 'AUSENTE',
  JUSTIFICADA: 'JUSTIFICADA',
} as const;
export type StatusFrequencia = (typeof StatusFrequencia)[keyof typeof StatusFrequencia];

export const OrigemRegistro = {
  APP_ALUNO: 'APP_ALUNO',
  PAINEL_ADMIN: 'PAINEL_ADMIN',
  TELA_AULA: 'TELA_AULA',
  AUTOMATICO: 'AUTOMATICO',
} as const;
export type OrigemRegistro = (typeof OrigemRegistro)[keyof typeof OrigemRegistro];

export const TipoNotificacao = {
  VENCIMENTO_PROXIMO: 'VENCIMENTO_PROXIMO',
  VENCIMENTO_ATRASADO: 'VENCIMENTO_ATRASADO',
  PAGAMENTO_CONFIRMADO: 'PAGAMENTO_CONFIRMADO',
  LEMBRETE_AULA: 'LEMBRETE_AULA',
  AULA_CANCELADA: 'AULA_CANCELADA',
  CHECKIN_CONFIRMADO: 'CHECKIN_CONFIRMADO',
  VAGA_LIBERADA: 'VAGA_LIBERADA',
  CAMPANHA: 'CAMPANHA',
  SISTEMA: 'SISTEMA',
} as const;
export type TipoNotificacao = (typeof TipoNotificacao)[keyof typeof TipoNotificacao];

export const PublicoNotificacao = {
  ALUNO: 'ALUNO',
  ADMIN: 'ADMIN',
} as const;
export type PublicoNotificacao = (typeof PublicoNotificacao)[keyof typeof PublicoNotificacao];

export const CanalNotificacao = {
  APP: 'APP',
  EMAIL: 'EMAIL',
  WHATSAPP: 'WHATSAPP',
  SMS: 'SMS',
} as const;
export type CanalNotificacao = (typeof CanalNotificacao)[keyof typeof CanalNotificacao];

export const StatusCampanha = {
  RASCUNHO: 'RASCUNHO',
  AGENDADA: 'AGENDADA',
  ENVIANDO: 'ENVIANDO',
  ENVIADA: 'ENVIADA',
  CANCELADA: 'CANCELADA',
} as const;
export type StatusCampanha = (typeof StatusCampanha)[keyof typeof StatusCampanha];

export const TipoEventoPagamento = {
  MENSALIDADE_GERADA: 'MENSALIDADE_GERADA',
  PAGAMENTO_REGISTRADO: 'PAGAMENTO_REGISTRADO',
  PAGAMENTO_ESTORNADO: 'PAGAMENTO_ESTORNADO',
  MENSALIDADE_VENCIDA: 'MENSALIDADE_VENCIDA',
  LEMBRETE_ENVIADO: 'LEMBRETE_ENVIADO',
  MENSALIDADE_CANCELADA: 'MENSALIDADE_CANCELADA',
} as const;
export type TipoEventoPagamento = (typeof TipoEventoPagamento)[keyof typeof TipoEventoPagamento];

/** 0 = domingo, alinhado com Date.getDay(). */
export const DIAS_SEMANA = [
  { valor: 0, curto: 'Dom', longo: 'Domingo' },
  { valor: 1, curto: 'Seg', longo: 'Segunda-feira' },
  { valor: 2, curto: 'Ter', longo: 'Terca-feira' },
  { valor: 3, curto: 'Qua', longo: 'Quarta-feira' },
  { valor: 4, curto: 'Qui', longo: 'Quinta-feira' },
  { valor: 5, curto: 'Sex', longo: 'Sexta-feira' },
  { valor: 6, curto: 'Sab', longo: 'Sabado' },
] as const;

export const TipoIntervaloTimer = {
  PREPARO: 'PREPARO',
  TRABALHO: 'TRABALHO',
  DESCANSO: 'DESCANSO',
  TRANSICAO: 'TRANSICAO',
} as const;
export type TipoIntervaloTimer = (typeof TipoIntervaloTimer)[keyof typeof TipoIntervaloTimer];
