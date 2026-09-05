import { Schema, model, type HydratedDocument } from 'mongoose';
import {
  OrigemRegistro,
  TipoEventoPagamento,
  type OrigemRegistro as TipoOrigem,
  type TipoEventoPagamento as TipoDeEvento,
} from '@almativa/shared';

/**
 * Trilha imutavel de tudo que acontece no financeiro de um aluno.
 * O estado atual vive no Postgres (mensalidades/pagamentos); aqui fica o
 * historico append-only usado para relatorios e auditoria.
 */
export interface EventoPagamento {
  tipo: TipoDeEvento;
  alunoId: string;
  alunoNome: string | null;
  mensalidadeId: string | null;
  pagamentoId: string | null;
  matriculaId: string | null;
  valorCentavos: number | null;
  competencia: string | null;
  ocorridoEm: Date;
  origem: TipoOrigem;
  registradoPor: string | null;
  payload: Record<string, unknown>;
  criadoEm: Date;
}

const eventoPagamentoSchema = new Schema<EventoPagamento>(
  {
    tipo: { type: String, enum: Object.values(TipoEventoPagamento), required: true, index: true },
    alunoId: { type: String, required: true, index: true },
    alunoNome: { type: String, default: null },
    mensalidadeId: { type: String, default: null, index: true },
    pagamentoId: { type: String, default: null },
    matriculaId: { type: String, default: null },
    valorCentavos: { type: Number, default: null },
    competencia: { type: String, default: null, index: true },
    ocorridoEm: { type: Date, default: () => new Date(), index: true },
    origem: {
      type: String,
      enum: Object.values(OrigemRegistro),
      default: OrigemRegistro.PAINEL_ADMIN,
    },
    registradoPor: { type: String, default: null },
    payload: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: 'criadoEm', updatedAt: false }, collection: 'eventos_pagamento' },
);

eventoPagamentoSchema.index({ alunoId: 1, ocorridoEm: -1 });
eventoPagamentoSchema.index({ tipo: 1, ocorridoEm: -1 });

export type EventoPagamentoDoc = HydratedDocument<EventoPagamento>;
export const EventoPagamentoModel = model<EventoPagamento>('EventoPagamento', eventoPagamentoSchema);
