import { Schema, model, type HydratedDocument } from 'mongoose';
import {
  OrigemRegistro,
  StatusFrequencia,
  type OrigemRegistro as TipoOrigem,
  type StatusFrequencia as TipoStatusFrequencia,
} from '@almativa/shared';

/**
 * Frequencia = confirmacao de que o aluno realmente fez a aula.
 * Registrada pelo instrutor no painel ou pela tela da sala (perfil AULA).
 */
export interface Frequencia {
  alunoId: string;
  alunoNome: string;
  aulaId: string;
  turmaId: string;
  modalidadeSlug: string;
  inicioEm: Date;
  status: TipoStatusFrequencia;
  registradoEm: Date;
  registradoPor: string | null;
  origem: TipoOrigem;
  observacao: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

const frequenciaSchema = new Schema<Frequencia>(
  {
    alunoId: { type: String, required: true, index: true },
    alunoNome: { type: String, required: true },
    aulaId: { type: String, required: true, index: true },
    turmaId: { type: String, required: true, index: true },
    modalidadeSlug: { type: String, required: true, index: true },
    inicioEm: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: Object.values(StatusFrequencia),
      default: StatusFrequencia.PRESENTE,
      required: true,
    },
    registradoEm: { type: Date, default: () => new Date() },
    registradoPor: { type: String, default: null },
    origem: {
      type: String,
      enum: Object.values(OrigemRegistro),
      default: OrigemRegistro.PAINEL_ADMIN,
      required: true,
    },
    observacao: { type: String, default: null },
  },
  { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }, collection: 'frequencias' },
);

// Uma linha de presenca por aluno por aula.
frequenciaSchema.index({ aulaId: 1, alunoId: 1 }, { unique: true });
frequenciaSchema.index({ alunoId: 1, inicioEm: -1 });
frequenciaSchema.index({ inicioEm: -1, status: 1 });

export type FrequenciaDoc = HydratedDocument<Frequencia>;
export const FrequenciaModel = model<Frequencia>('Frequencia', frequenciaSchema);
