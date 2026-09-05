import { Schema, model, type HydratedDocument } from 'mongoose';
import {
  CanalNotificacao,
  PublicoNotificacao,
  TipoNotificacao,
  type CanalNotificacao as TipoCanal,
  type PublicoNotificacao as TipoPublico,
  type TipoNotificacao as TipoDeNotificacao,
} from '@almativa/shared';

/**
 * Notificacao entregue ao aluno (area logada) ou ao admin (painel).
 * Lembretes de vencimento sao gravados aqui com tipo VENCIMENTO_* e geram
 * uma copia para cada publico.
 */
export interface Notificacao {
  publico: TipoPublico;
  alunoId: string | null;
  tipo: TipoDeNotificacao;
  titulo: string;
  mensagem: string;
  canais: TipoCanal[];
  dados: Record<string, unknown>;
  campanhaId: string | null;
  /** Chave de idempotencia: evita reenviar o mesmo lembrete no mesmo marco. */
  chaveDeduplicacao: string | null;
  agendadaPara: Date | null;
  enviadaEm: Date | null;
  lidaEm: Date | null;
  arquivadaEm: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

const notificacaoSchema = new Schema<Notificacao>(
  {
    publico: { type: String, enum: Object.values(PublicoNotificacao), required: true, index: true },
    alunoId: { type: String, default: null, index: true },
    tipo: { type: String, enum: Object.values(TipoNotificacao), required: true, index: true },
    titulo: { type: String, required: true },
    mensagem: { type: String, required: true },
    canais: {
      type: [String],
      enum: Object.values(CanalNotificacao),
      default: [CanalNotificacao.APP],
    },
    dados: { type: Schema.Types.Mixed, default: {} },
    campanhaId: { type: String, default: null, index: true },
    chaveDeduplicacao: { type: String, default: null },
    agendadaPara: { type: Date, default: null },
    enviadaEm: { type: Date, default: () => new Date() },
    lidaEm: { type: Date, default: null },
    arquivadaEm: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }, collection: 'notificacoes' },
);

notificacaoSchema.index({ publico: 1, lidaEm: 1, criadoEm: -1 });
notificacaoSchema.index({ alunoId: 1, criadoEm: -1 });
notificacaoSchema.index(
  { chaveDeduplicacao: 1 },
  { unique: true, partialFilterExpression: { chaveDeduplicacao: { $type: 'string' } } },
);

export type NotificacaoDoc = HydratedDocument<Notificacao>;
export const NotificacaoModel = model<Notificacao>('Notificacao', notificacaoSchema);
