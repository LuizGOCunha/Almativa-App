import { Schema, model, type HydratedDocument } from 'mongoose';

/** Log de acoes administrativas relevantes. */
export interface Auditoria {
  usuarioId: string | null;
  usuarioEmail: string | null;
  acao: string;
  recurso: string;
  recursoId: string | null;
  ip: string | null;
  detalhes: Record<string, unknown>;
  ocorridoEm: Date;
}

const auditoriaSchema = new Schema<Auditoria>(
  {
    usuarioId: { type: String, default: null, index: true },
    usuarioEmail: { type: String, default: null },
    acao: { type: String, required: true, index: true },
    recurso: { type: String, required: true },
    recursoId: { type: String, default: null },
    ip: { type: String, default: null },
    detalhes: { type: Schema.Types.Mixed, default: {} },
    ocorridoEm: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: false, collection: 'auditoria' },
);

auditoriaSchema.index({ recurso: 1, recursoId: 1, ocorridoEm: -1 });

export type AuditoriaDoc = HydratedDocument<Auditoria>;
export const AuditoriaModel = model<Auditoria>('Auditoria', auditoriaSchema);
