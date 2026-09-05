import { Schema, model, type HydratedDocument } from 'mongoose';
import {
  OrigemRegistro,
  StatusCheckin,
  type OrigemRegistro as TipoOrigem,
  type StatusCheckin as TipoStatusCheckin,
} from '@almativa/shared';

/**
 * Check-in = reserva de vaga na aula. Nao significa que o aluno compareceu;
 * isso e registrado na colecao de frequencia.
 */
export interface Checkin {
  alunoId: string;
  alunoNome: string;
  aulaId: string;
  turmaId: string;
  modalidadeSlug: string;
  inicioEm: Date;
  status: TipoStatusCheckin;
  posicaoFila: number | null;
  origem: TipoOrigem;
  canceladoEm: Date | null;
  canceladoPor: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

const checkinSchema = new Schema<Checkin>(
  {
    alunoId: { type: String, required: true, index: true },
    alunoNome: { type: String, required: true },
    aulaId: { type: String, required: true, index: true },
    turmaId: { type: String, required: true, index: true },
    modalidadeSlug: { type: String, required: true },
    inicioEm: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: Object.values(StatusCheckin),
      default: StatusCheckin.CONFIRMADO,
      required: true,
    },
    posicaoFila: { type: Number, default: null },
    origem: {
      type: String,
      enum: Object.values(OrigemRegistro),
      default: OrigemRegistro.APP_ALUNO,
      required: true,
    },
    canceladoEm: { type: Date, default: null },
    canceladoPor: { type: String, default: null },
  },
  { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }, collection: 'checkins' },
);

// Um aluno nao pode ter dois check-ins ativos na mesma aula.
checkinSchema.index(
  { aulaId: 1, alunoId: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: StatusCheckin.CANCELADO } } },
);
checkinSchema.index({ alunoId: 1, inicioEm: -1 });

export type CheckinDoc = HydratedDocument<Checkin>;
export const CheckinModel = model<Checkin>('Checkin', checkinSchema);
