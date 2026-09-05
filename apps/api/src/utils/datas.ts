import { addDays, addMonths, endOfDay, startOfDay } from 'date-fns';

/**
 * Convencao de datas do projeto.
 *
 * Colunas `@db.Date` do Postgres (vencimento, nascimento, matricula) voltam do
 * driver como meia-noite UTC. Se compararmos com uma data local, em fusos
 * negativos como o do Brasil o dia "escorrega" um para tras. Por isso toda
 * data-pura e construida e lida em UTC, e as comparacoes usam getUTC*.
 *
 * Colunas de timestamp (inicio de aula, pagamento) continuam no fuso local do
 * servidor - use inicioDoDiaLocal/fimDoDiaLocal para filtra-las.
 */

/** Data-pura (sem hora) em UTC. */
export function dataPura(ano: number, mes1a12: number, dia: number): Date {
  return new Date(Date.UTC(ano, mes1a12 - 1, dia));
}

/** "AAAA-MM-DD" -> data-pura em UTC. */
export function deIsoData(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return dataPura(ano, mes, dia);
}

export function paraIsoData(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** Hoje, no fuso local, no mesmo formato das colunas `date` (meia-noite UTC). */
export function hojeComoData(): Date {
  const agora = new Date();
  return dataPura(agora.getFullYear(), agora.getMonth() + 1, agora.getDate());
}

/** Diferenca em dias inteiros entre duas data-puras (comparacao em UTC). */
export function diferencaEmDias(de: Date, ate: Date): number {
  const a = Date.UTC(de.getUTCFullYear(), de.getUTCMonth(), de.getUTCDate());
  const b = Date.UTC(ate.getUTCFullYear(), ate.getUTCMonth(), ate.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

/** Competencia no formato AAAA-MM. */
export function competenciaDe(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

export function inicioDaCompetencia(competencia: string): Date {
  const [ano, mes] = competencia.split('-').map(Number);
  return dataPura(ano, mes, 1);
}

/**
 * Vencimento da competencia respeitando o dia escolhido pelo aluno.
 * Se o mes nao tem o dia (ex.: 31 em fevereiro), usa o ultimo dia do mes.
 */
export function vencimentoDaCompetencia(competencia: string, diaVencimento: number): Date {
  const [ano, mes] = competencia.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return dataPura(ano, mes, Math.min(Math.max(1, diaVencimento), ultimoDia));
}

export function somarMesesCompetencia(competencia: string, meses: number): string {
  const [ano, mes] = competencia.split('-').map(Number);
  return competenciaDe(new Date(ano, mes - 1 + meses, 1));
}

/* ------------------------ Timestamps (fuso local) ------------------------ */

/** "AAAA-MM-DD" -> 00:00:00 no fuso local. */
export function inicioDoDiaLocal(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia, 0, 0, 0, 0);
}

/** "AAAA-MM-DD" -> 23:59:59.999 no fuso local. */
export function fimDoDiaLocal(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia, 23, 59, 59, 999);
}

/** "AAAA-MM" -> primeiro instante do mes no fuso local. */
export function inicioDoMesLocal(competencia: string): Date {
  const [ano, mes] = competencia.split('-').map(Number);
  return new Date(ano, mes - 1, 1, 0, 0, 0, 0);
}

/** Combina uma data com "HH:MM" no fuso local. */
export function comHora(data: Date, hora: string): Date {
  const [h, m] = hora.split(':').map(Number);
  const resultado = new Date(data);
  resultado.setHours(h, m || 0, 0, 0);
  return resultado;
}

/** Segunda-feira da semana da data informada (fuso local). */
export function inicioDaSemana(data: Date): Date {
  const resultado = startOfDay(data);
  const dia = resultado.getDay();
  const ajuste = dia === 0 ? -6 : 1 - dia;
  return addDays(resultado, ajuste);
}

export { addDays, addMonths, endOfDay, startOfDay };
