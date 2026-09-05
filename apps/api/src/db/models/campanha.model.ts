import { Schema, model, type HydratedDocument } from 'mongoose';
import {
  CanalNotificacao,
  StatusCampanha,
  type CanalNotificacao as TipoCanal,
  type SegmentoCampanha,
  type StatusCampanha as TipoStatusCampanha,
} from '@almativa/shared';

/** Campanha de marketing/retencao disparada para um segmento de alunos. */
export interface Campanha {
  nome: string;
  descricao: string | null;
  mensagemTitulo: string;
  mensagemCorpo: string;
  canais: TipoCanal[];
  segmento: SegmentoCampanha;
  status: TipoStatusCampanha;
  agendadaPara: Date | null;
  enviadaEm: Date | null;
  metricas: { alcancados: number; enviados: number; lidos: number };
  criadoPor: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

const campanhaSchema = new Schema<Campanha>(
  {
    nome: { type: String, required: true },
    descricao: { type: String, default: null },
    mensagemTitulo: { type: String, required: true },
    mensagemCorpo: { type: String, required: true },
    canais: {
      type: [String],
      enum: Object.values(CanalNotificacao),
      default: [CanalNotificacao.APP],
    },
    segmento: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: Object.values(StatusCampanha),
      default: StatusCampanha.RASCUNHO,
      index: true,
    },
    agendadaPara: { type: Date, default: null },
    enviadaEm: { type: Date, default: null },
    metricas: {
      alcancados: { type: Number, default: 0 },
      enviados: { type: Number, default: 0 },
      lidos: { type: Number, default: 0 },
    },
    criadoPor: { type: String, default: null },
  },
  { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }, collection: 'campanhas' },
);

campanhaSchema.index({ status: 1, agendadaPara: 1 });

export type CampanhaDoc = HydratedDocument<Campanha>;
export const CampanhaModel = model<Campanha>('Campanha', campanhaSchema);
