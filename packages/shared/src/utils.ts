import { DIAS_SEMANA } from './enums.js';

/** Formata centavos como moeda brasileira. */
export function formatarMoeda(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/** Converte "1.234,56", "1234.56" ou 1234.56 para centavos inteiros. */
export function paraCentavos(valor: string | number): number {
  if (typeof valor === 'number') return Math.round(valor * 100);
  const normalizado = valor.trim().replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

/** Competencia no formato YYYY-MM. */
export function competenciaDe(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

export function competenciaLegivel(competencia: string): string {
  const [ano, mes] = competencia.split('-');
  const nomes = [
    'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  const indice = Number(mes) - 1;
  return `${nomes[indice] ?? mes}/${ano}`;
}

/** Soma meses a uma competencia YYYY-MM. */
export function somarMesesCompetencia(competencia: string, meses: number): string {
  const [ano, mes] = competencia.split('-').map(Number);
  const data = new Date(ano, mes - 1 + meses, 1);
  return competenciaDe(data);
}

export function nomeDiaSemana(dia: number, formato: 'curto' | 'longo' = 'curto'): string {
  return DIAS_SEMANA.find((d) => d.valor === dia)?.[formato] ?? '';
}

/** Diferenca em dias inteiros entre duas datas, ignorando horario. */
export function diasEntre(de: Date | string, ate: Date | string): number {
  const inicio = new Date(de);
  const fim = new Date(ate);
  const a = Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const b = Date.UTC(fim.getFullYear(), fim.getMonth(), fim.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** "HH:MM" -> minutos desde a meia-noite. */
export function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutosParaHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Segundos -> "MM:SS" ou "H:MM:SS". */
export function formatarCronometro(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Aceita URL completa, youtu.be ou o proprio id. */
export function extrairVideoIdYoutube(entrada: string): string | null {
  const valor = entrada.trim();
  if (/^[\w-]{11}$/.test(valor)) return valor;
  const padroes = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
    /(?:youtube\.com\/live\/)([\w-]{11})/,
  ];
  for (const padrao of padroes) {
    const achado = valor.match(padrao);
    if (achado) return achado[1];
  }
  return null;
}

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

/** Validacao de CPF com digitos verificadores. */
export function cpfValido(cpf: string): boolean {
  const digitos = somenteDigitos(cpf);
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false;
  const calcular = (tamanho: number): number => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(digitos[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calcular(9) === Number(digitos[9]) && calcular(10) === Number(digitos[10]);
}

export function formatarTelefone(valor: string): string {
  const d = somenteDigitos(valor);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return valor;
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
