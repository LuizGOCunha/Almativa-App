import { OrigemRegistro, type TipoEventoPagamento } from '@almativa/shared';
import { EventoPagamentoModel } from '../../db/models/index.js';
import { logger } from '../../config/logger.js';

export interface EntradaEventoPagamento {
  tipo: TipoEventoPagamento;
  alunoId: string;
  alunoNome?: string | null;
  mensalidadeId?: string | null;
  pagamentoId?: string | null;
  matriculaId?: string | null;
  valorCentavos?: number | null;
  competencia?: string | null;
  origem?: OrigemRegistro;
  registradoPor?: string | null;
  payload?: Record<string, unknown>;
  ocorridoEm?: Date;
}

/**
 * Grava a trilha financeira no Mongo. Nunca deve derrubar a operacao
 * principal: falhas aqui sao logadas, nao propagadas.
 */
export async function registrarEventoPagamento(entrada: EntradaEventoPagamento): Promise<void> {
  try {
    await EventoPagamentoModel.create({
      tipo: entrada.tipo,
      alunoId: entrada.alunoId,
      alunoNome: entrada.alunoNome ?? null,
      mensalidadeId: entrada.mensalidadeId ?? null,
      pagamentoId: entrada.pagamentoId ?? null,
      matriculaId: entrada.matriculaId ?? null,
      valorCentavos: entrada.valorCentavos ?? null,
      competencia: entrada.competencia ?? null,
      ocorridoEm: entrada.ocorridoEm ?? new Date(),
      origem: entrada.origem ?? OrigemRegistro.PAINEL_ADMIN,
      registradoPor: entrada.registradoPor ?? null,
      payload: entrada.payload ?? {},
    });
  } catch (erro) {
    logger.error({ erro, entrada }, 'Falha ao gravar evento de pagamento no Mongo');
  }
}

export async function historicoFinanceiroDoAluno(alunoId: string, limite = 50) {
  return EventoPagamentoModel.find({ alunoId }).sort({ ocorridoEm: -1 }).limit(limite);
}
