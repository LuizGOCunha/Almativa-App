import type {
  CampanhaDto,
  CheckinDto,
  EventoPagamentoDto,
  FrequenciaDto,
  NotificacaoDto,
} from '@almativa/shared';
import type {
  CampanhaDoc,
  CheckinDoc,
  EventoPagamentoDoc,
  FrequenciaDoc,
  NotificacaoDoc,
} from '../../db/models/index.js';

const iso = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString() : null);

export function mapCheckin(c: CheckinDoc): CheckinDto {
  return {
    id: String(c._id),
    alunoId: c.alunoId,
    alunoNome: c.alunoNome,
    aulaId: c.aulaId,
    turmaId: c.turmaId,
    inicioEm: iso(c.inicioEm)!,
    status: c.status,
    posicaoFila: c.posicaoFila ?? null,
    origem: c.origem,
    criadoEm: iso(c.criadoEm)!,
    canceladoEm: iso(c.canceladoEm),
  };
}

export function mapFrequencia(f: FrequenciaDoc): FrequenciaDto {
  return {
    id: String(f._id),
    alunoId: f.alunoId,
    alunoNome: f.alunoNome,
    aulaId: f.aulaId,
    turmaId: f.turmaId,
    modalidadeSlug: f.modalidadeSlug,
    inicioEm: iso(f.inicioEm)!,
    status: f.status,
    registradoEm: iso(f.registradoEm)!,
    registradoPor: f.registradoPor ?? null,
    origem: f.origem,
    observacao: f.observacao ?? null,
  };
}

export function mapNotificacao(n: NotificacaoDoc): NotificacaoDto {
  return {
    id: String(n._id),
    publico: n.publico,
    alunoId: n.alunoId ?? null,
    tipo: n.tipo,
    titulo: n.titulo,
    mensagem: n.mensagem,
    canais: n.canais as NotificacaoDto['canais'],
    dados: (n.dados ?? {}) as Record<string, unknown>,
    agendadaPara: iso(n.agendadaPara),
    enviadaEm: iso(n.enviadaEm),
    lidaEm: iso(n.lidaEm),
    criadoEm: iso(n.criadoEm)!,
  };
}

export function mapCampanha(c: CampanhaDoc): CampanhaDto {
  return {
    id: String(c._id),
    nome: c.nome,
    descricao: c.descricao ?? null,
    mensagemTitulo: c.mensagemTitulo,
    mensagemCorpo: c.mensagemCorpo,
    canais: c.canais as CampanhaDto['canais'],
    segmento: (c.segmento ?? {}) as CampanhaDto['segmento'],
    status: c.status,
    agendadaPara: iso(c.agendadaPara),
    enviadaEm: iso(c.enviadaEm),
    metricas: {
      alcancados: c.metricas?.alcancados ?? 0,
      enviados: c.metricas?.enviados ?? 0,
      lidos: c.metricas?.lidos ?? 0,
    },
    criadoEm: iso(c.criadoEm)!,
    criadoPor: c.criadoPor ?? null,
  };
}

export function mapEventoPagamento(e: EventoPagamentoDoc): EventoPagamentoDto {
  return {
    id: String(e._id),
    tipo: e.tipo,
    alunoId: e.alunoId,
    mensalidadeId: e.mensalidadeId ?? null,
    pagamentoId: e.pagamentoId ?? null,
    valorCentavos: e.valorCentavos ?? null,
    competencia: e.competencia ?? null,
    ocorridoEm: iso(e.ocorridoEm)!,
    origem: e.origem,
    payload: (e.payload ?? {}) as Record<string, unknown>,
  };
}
