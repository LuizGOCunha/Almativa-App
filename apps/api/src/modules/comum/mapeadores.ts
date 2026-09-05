import type {
  AlunoDto,
  AlunoResumoDto,
  AulaDto,
  InstrutorDto,
  MatriculaDto,
  MensalidadeDto,
  ModalidadeDto,
  PagamentoDto,
  PlanoDto,
  PlaylistDto,
  TimerPresetDto,
  TurmaDto,
  IntervaloTimer,
  ItemPlaylist,
} from '@almativa/shared';
import type {
  Aluno,
  Aula,
  Instrutor,
  Matricula,
  Mensalidade,
  Modalidade,
  Pagamento,
  Plano,
  Playlist,
  TimerPreset,
  Turma,
} from '../../generated/prisma/client.js';
import { diferencaEmDias, hojeComoData } from '../../utils/datas.js';

const iso = (data: Date | null | undefined): string | null => (data ? data.toISOString() : null);
const isoData = (data: Date | null | undefined): string | null =>
  data ? data.toISOString().slice(0, 10) : null;

export function mapModalidade(m: Modalidade): ModalidadeDto {
  return {
    id: m.id,
    nome: m.nome,
    slug: m.slug,
    descricao: m.descricao,
    cor: m.cor,
    icone: m.icone,
    ativo: m.ativo,
  };
}

export function mapInstrutor(i: Instrutor & { modalidades?: Modalidade[] }): InstrutorDto {
  return {
    id: i.id,
    nome: i.nome,
    email: i.email,
    telefone: i.telefone,
    bio: i.bio,
    registroProfissional: i.registroProfissional,
    fotoUrl: i.fotoUrl,
    ativo: i.ativo,
    modalidades: (i.modalidades ?? []).map(mapModalidade),
  };
}

export function mapPlano(p: Plano & { modalidade?: Modalidade | null }): PlanoDto {
  return {
    id: p.id,
    nome: p.nome,
    descricao: p.descricao,
    modalidade: p.modalidade ? mapModalidade(p.modalidade) : null,
    valorCentavos: p.valorCentavos,
    periodicidade: p.periodicidade,
    aulasPorSemana: p.aulasPorSemana,
    diaVencimentoPadrao: p.diaVencimentoPadrao,
    ativo: p.ativo,
  };
}

export function mapAlunoResumo(a: Aluno): AlunoResumoDto {
  return {
    id: a.id,
    nome: a.nome,
    email: a.email,
    telefone: a.telefone,
    status: a.status,
    fotoUrl: a.fotoUrl,
  };
}

type MatriculaComPlano = Matricula & { plano: Plano & { modalidade?: Modalidade | null }; aluno?: Aluno };

export function mapMatricula(m: MatriculaComPlano): MatriculaDto {
  return {
    id: m.id,
    alunoId: m.alunoId,
    ...(m.aluno ? { aluno: mapAlunoResumo(m.aluno) } : {}),
    plano: mapPlano(m.plano),
    dataInicio: isoData(m.dataInicio)!,
    dataFim: isoData(m.dataFim),
    diaVencimento: m.diaVencimento,
    status: m.status,
    observacao: m.observacao,
  };
}

export function mapAluno(a: Aluno & { matriculas?: MatriculaComPlano[] }): AlunoDto {
  return {
    ...mapAlunoResumo(a),
    cpf: a.cpf,
    dataNascimento: isoData(a.dataNascimento),
    logradouro: a.logradouro,
    numero: a.numero,
    complemento: a.complemento,
    bairro: a.bairro,
    cidade: a.cidade,
    uf: a.uf,
    cep: a.cep,
    contatoEmergenciaNome: a.contatoEmergenciaNome,
    contatoEmergenciaTelefone: a.contatoEmergenciaTelefone,
    observacoesMedicas: a.observacoesMedicas,
    objetivos: a.objetivos,
    dataMatricula: isoData(a.dataMatricula)!,
    criadoEm: iso(a.criadoEm)!,
    atualizadoEm: iso(a.atualizadoEm)!,
    matriculas: (a.matriculas ?? []).map(mapMatricula),
  };
}

type TurmaCompleta = Turma & {
  modalidade: Modalidade;
  instrutor?: (Instrutor & { modalidades?: Modalidade[] }) | null;
};

export function mapTurma(t: TurmaCompleta): TurmaDto {
  return {
    id: t.id,
    nome: t.nome,
    modalidade: mapModalidade(t.modalidade),
    instrutor: t.instrutor ? mapInstrutor(t.instrutor) : null,
    diaSemana: t.diaSemana,
    horaInicio: t.horaInicio,
    horaFim: t.horaFim,
    capacidade: t.capacidade,
    sala: t.sala,
    nivel: t.nivel,
    ativo: t.ativo,
  };
}

export interface AgregadosAula {
  checkins: number;
  presentes: number;
}

export function mapAula(
  a: Aula & { turma: TurmaCompleta; instrutor?: (Instrutor & { modalidades?: Modalidade[] }) | null },
  agregados: AgregadosAula = { checkins: 0, presentes: 0 },
): AulaDto {
  return {
    id: a.id,
    turma: mapTurma(a.turma),
    instrutor: a.instrutor ? mapInstrutor(a.instrutor) : a.turma.instrutor ? mapInstrutor(a.turma.instrutor) : null,
    inicioEm: a.inicioEm.toISOString(),
    fimEm: a.fimEm.toISOString(),
    capacidade: a.capacidade,
    status: a.status,
    observacoes: a.observacoes,
    checkins: agregados.checkins,
    vagasDisponiveis: Math.max(0, a.capacidade - agregados.checkins),
    presentes: agregados.presentes,
  };
}

export function mapPagamento(p: Pagamento): PagamentoDto {
  return {
    id: p.id,
    mensalidadeId: p.mensalidadeId,
    alunoId: p.alunoId,
    valorCentavos: p.valorCentavos,
    metodo: p.metodo,
    pagoEm: p.pagoEm.toISOString(),
    referenciaExterna: p.referenciaExterna,
    observacao: p.observacao,
    registradoPor: p.registradoPorId,
  };
}

type MensalidadeCompleta = Mensalidade & {
  matricula?: (Matricula & { plano: Plano }) | null;
  aluno?: Aluno | null;
  pagamentos?: Pagamento[];
};

export function mapMensalidade(m: MensalidadeCompleta, hoje = hojeComoData()): MensalidadeDto {
  const emAberto = m.status !== 'PAGA' && m.status !== 'CANCELADA';
  const diasEmAtraso = emAberto ? Math.max(0, diferencaEmDias(m.vencimentoEm, hoje)) : 0;

  return {
    id: m.id,
    alunoId: m.alunoId,
    ...(m.aluno ? { aluno: mapAlunoResumo(m.aluno) } : {}),
    matriculaId: m.matriculaId,
    planoNome: m.matricula?.plano.nome ?? '—',
    competencia: m.competencia,
    valorCentavos: m.valorCentavos,
    vencimentoEm: m.vencimentoEm.toISOString().slice(0, 10),
    status: m.status,
    pagoEm: iso(m.pagoEm),
    diasEmAtraso,
    pagamentos: (m.pagamentos ?? []).map(mapPagamento),
  };
}

export function mapTimer(t: TimerPreset & { modalidade?: Modalidade | null }): TimerPresetDto {
  const intervalos = (t.intervalos as unknown as IntervaloTimer[]) ?? [];
  const duracaoCiclo = intervalos.reduce((total, i) => total + i.duracaoSegundos, 0);
  return {
    id: t.id,
    nome: t.nome,
    descricao: t.descricao,
    modalidade: t.modalidade ? mapModalidade(t.modalidade) : null,
    rounds: t.rounds,
    intervalos,
    avisoSonoro: t.avisoSonoro,
    segundosAviso: t.segundosAviso,
    duracaoTotalSegundos: duracaoCiclo * t.rounds,
    ativo: t.ativo,
  };
}

export function mapPlaylist(p: Playlist & { modalidade?: Modalidade | null }): PlaylistDto {
  return {
    id: p.id,
    nome: p.nome,
    descricao: p.descricao,
    modalidade: p.modalidade ? mapModalidade(p.modalidade) : null,
    itens: (p.itens as unknown as ItemPlaylist[]) ?? [],
    somenteAudio: p.somenteAudio,
    volumePadrao: p.volumePadrao,
    embaralhar: p.embaralhar,
    ativo: p.ativo,
  };
}
