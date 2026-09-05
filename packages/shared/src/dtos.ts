import type {
  CanalNotificacao,
  MetodoPagamento,
  OrigemRegistro,
  Periodicidade,
  PublicoNotificacao,
  Role,
  StatusAluno,
  StatusAula,
  StatusCampanha,
  StatusCheckin,
  StatusFrequencia,
  StatusMatricula,
  StatusMensalidade,
  TipoEventoPagamento,
  TipoIntervaloTimer,
  TipoNotificacao,
} from './enums.js';

/** Envelope padrao de listagens paginadas da API. */
export interface Paginado<T> {
  itens: T[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
}

export interface ErroApi {
  erro: {
    codigo: string;
    mensagem: string;
    detalhes?: unknown;
  };
}

/* ---------------------------- Auth ---------------------------- */

export interface LoginRequest {
  email: string;
  senha: string;
}

export interface SessaoDto {
  accessToken: string;
  refreshToken: string;
  expiraEm: number;
  usuario: UsuarioDto;
}

export interface UsuarioDto {
  id: string;
  email: string;
  nome: string;
  role: Role;
  alunoId: string | null;
  precisaTrocarSenha: boolean;
}

/** Token de longa duracao usado pelo dispositivo da TV na sala de aula. */
export interface TokenDispositivoDto {
  token: string;
  nomeDispositivo: string;
  expiraEm: string;
}

/* ---------------------- Cadastro (Postgres) -------------------- */

export interface ModalidadeDto {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  cor: string;
  icone: string | null;
  ativo: boolean;
}

export interface InstrutorDto {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  bio: string | null;
  registroProfissional: string | null;
  fotoUrl: string | null;
  ativo: boolean;
  modalidades: ModalidadeDto[];
}

export interface PlanoDto {
  id: string;
  nome: string;
  descricao: string | null;
  modalidade: ModalidadeDto | null;
  valorCentavos: number;
  periodicidade: Periodicidade;
  aulasPorSemana: number | null;
  diaVencimentoPadrao: number;
  ativo: boolean;
}

export interface AlunoResumoDto {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  status: StatusAluno;
  fotoUrl: string | null;
}

export interface AlunoDto extends AlunoResumoDto {
  cpf: string | null;
  dataNascimento: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  contatoEmergenciaNome: string | null;
  contatoEmergenciaTelefone: string | null;
  observacoesMedicas: string | null;
  objetivos: string | null;
  dataMatricula: string;
  criadoEm: string;
  atualizadoEm: string;
  matriculas: MatriculaDto[];
}

export interface MatriculaDto {
  id: string;
  alunoId: string;
  aluno?: AlunoResumoDto;
  plano: PlanoDto;
  dataInicio: string;
  dataFim: string | null;
  diaVencimento: number;
  status: StatusMatricula;
  observacao: string | null;
}

export interface TurmaDto {
  id: string;
  nome: string;
  modalidade: ModalidadeDto;
  instrutor: InstrutorDto | null;
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
  capacidade: number;
  sala: string | null;
  nivel: string | null;
  ativo: boolean;
}

export interface AulaDto {
  id: string;
  turma: TurmaDto;
  instrutor: InstrutorDto | null;
  inicioEm: string;
  fimEm: string;
  capacidade: number;
  status: StatusAula;
  observacoes: string | null;
  /** Agregados vindos do MongoDB. */
  checkins: number;
  vagasDisponiveis: number;
  presentes: number;
}

export interface MensalidadeDto {
  id: string;
  alunoId: string;
  aluno?: AlunoResumoDto;
  matriculaId: string;
  planoNome: string;
  competencia: string;
  valorCentavos: number;
  vencimentoEm: string;
  status: StatusMensalidade;
  pagoEm: string | null;
  diasEmAtraso: number;
  pagamentos: PagamentoDto[];
}

export interface PagamentoDto {
  id: string;
  mensalidadeId: string;
  alunoId: string;
  valorCentavos: number;
  metodo: MetodoPagamento;
  pagoEm: string;
  referenciaExterna: string | null;
  observacao: string | null;
  registradoPor: string | null;
}

/* ---------------------- Eventos (MongoDB) ---------------------- */

export interface CheckinDto {
  id: string;
  alunoId: string;
  alunoNome: string;
  aulaId: string;
  turmaId: string;
  inicioEm: string;
  status: StatusCheckin;
  posicaoFila: number | null;
  origem: OrigemRegistro;
  criadoEm: string;
  canceladoEm: string | null;
}

export interface FrequenciaDto {
  id: string;
  alunoId: string;
  alunoNome: string;
  aulaId: string;
  turmaId: string;
  modalidadeSlug: string;
  /** Inicio da aula a que a presenca se refere. */
  inicioEm: string;
  status: StatusFrequencia;
  registradoEm: string;
  registradoPor: string | null;
  origem: OrigemRegistro;
  observacao: string | null;
}

export interface NotificacaoDto {
  id: string;
  publico: PublicoNotificacao;
  alunoId: string | null;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  canais: CanalNotificacao[];
  dados: Record<string, unknown>;
  agendadaPara: string | null;
  enviadaEm: string | null;
  lidaEm: string | null;
  criadoEm: string;
}

export interface SegmentoCampanha {
  statusAluno?: StatusAluno[];
  modalidadeSlugs?: string[];
  comMensalidadeVencida?: boolean;
  semFrequenciaDesdeDias?: number;
  alunoIds?: string[];
}

export interface CampanhaDto {
  id: string;
  nome: string;
  descricao: string | null;
  mensagemTitulo: string;
  mensagemCorpo: string;
  canais: CanalNotificacao[];
  segmento: SegmentoCampanha;
  status: StatusCampanha;
  agendadaPara: string | null;
  enviadaEm: string | null;
  metricas: { alcancados: number; enviados: number; lidos: number };
  criadoEm: string;
  criadoPor: string | null;
}

export interface EventoPagamentoDto {
  id: string;
  tipo: TipoEventoPagamento;
  alunoId: string;
  mensalidadeId: string | null;
  pagamentoId: string | null;
  valorCentavos: number | null;
  competencia: string | null;
  ocorridoEm: string;
  origem: OrigemRegistro;
  payload: Record<string, unknown>;
}

/* ------------- Renovacoes / lembretes de vencimento ------------ */

export type SituacaoRenovacao = 'PROXIMA' | 'VENCE_HOJE' | 'PENDENTE';

export interface RenovacaoDto {
  mensalidadeId: string;
  aluno: AlunoResumoDto;
  planoNome: string;
  competencia: string;
  valorCentavos: number;
  vencimentoEm: string;
  status: StatusMensalidade;
  /** Negativo quando ja venceu. */
  diasParaVencer: number;
  situacao: SituacaoRenovacao;
  lembretesEnviados: number;
  ultimoLembreteEm: string | null;
}

/* ------------------------- Timers e TV ------------------------- */

export interface IntervaloTimer {
  tipo: TipoIntervaloTimer;
  rotulo: string;
  duracaoSegundos: number;
}

export interface TimerPresetDto {
  id: string;
  nome: string;
  descricao: string | null;
  modalidade: ModalidadeDto | null;
  rounds: number;
  intervalos: IntervaloTimer[];
  avisoSonoro: boolean;
  segundosAviso: number;
  duracaoTotalSegundos: number;
  ativo: boolean;
}

export interface ItemPlaylist {
  videoId: string;
  titulo: string;
  duracaoSegundos: number | null;
  inicioEm: number | null;
}

export interface PlaylistDto {
  id: string;
  nome: string;
  descricao: string | null;
  modalidade: ModalidadeDto | null;
  itens: ItemPlaylist[];
  somenteAudio: boolean;
  volumePadrao: number;
  embaralhar: boolean;
  ativo: boolean;
}

/** Payload consumido pela tela de TV da sala de aula (perfil AULA). */
export interface PainelAulaDto {
  agora: string;
  aulaAtual: AulaDto | null;
  proximaAula: AulaDto | null;
  presentes: FrequenciaDto[];
  checkins: CheckinDto[];
  timersSugeridos: TimerPresetDto[];
  playlistsSugeridas: PlaylistDto[];
  avisos: NotificacaoDto[];
}

/* ----------------------- Dashboard admin ----------------------- */

export interface DashboardAdminDto {
  alunosAtivos: number;
  alunosInativos: number;
  matriculasAtivas: number;
  receitaMesCentavos: number;
  receitaMesAnteriorCentavos: number;
  inadimplenciaCentavos: number;
  mensalidadesVencidas: number;
  renovacoesProximas: number;
  aulasHoje: number;
  checkinsHoje: number;
  presencasHoje: number;
  taxaPresenca30d: number;
  ocupacaoMediaSemana: number;
  porModalidade: { modalidade: string; cor: string; alunos: number; aulas: number }[];
  frequenciaUltimos30Dias: { data: string; presencas: number }[];
  receitaUltimos6Meses: { competencia: string; valorCentavos: number }[];
}

/* --------------------------- Publico --------------------------- */

export interface AulaGradeDto {
  turmaId: string;
  nome: string;
  modalidade: string;
  modalidadeSlug: string;
  cor: string;
  instrutor: string | null;
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
  capacidade: number;
  nivel: string | null;
}

export interface ContatoRequest {
  nome: string;
  email: string;
  telefone: string;
  modalidadeInteresse: string | null;
  mensagem: string;
}
