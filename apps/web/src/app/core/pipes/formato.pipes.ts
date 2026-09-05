import { Pipe, type PipeTransform } from '@angular/core';
import {
  competenciaLegivel,
  formatarCronometro,
  formatarMoeda,
  formatarTelefone,
  iniciais,
  nomeDiaSemana,
} from '@almativa/shared';

/** Centavos -> R$ 0,00 */
@Pipe({ name: 'moeda' })
export class MoedaPipe implements PipeTransform {
  transform(centavos: number | null | undefined): string {
    return formatarMoeda(centavos ?? 0);
  }
}

/** "2026-09" -> "Setembro/2026" */
@Pipe({ name: 'competencia' })
export class CompetenciaPipe implements PipeTransform {
  transform(valor: string | null | undefined): string {
    return valor ? competenciaLegivel(valor) : '—';
  }
}

/** 0..6 -> "Seg" / "Segunda-feira" */
@Pipe({ name: 'diaSemana' })
export class DiaSemanaPipe implements PipeTransform {
  transform(dia: number | null | undefined, formato: 'curto' | 'longo' = 'curto'): string {
    return dia === null || dia === undefined ? '' : nomeDiaSemana(dia, formato);
  }
}

/** Segundos -> "MM:SS" */
@Pipe({ name: 'cronometro' })
export class CronometroPipe implements PipeTransform {
  transform(segundos: number | null | undefined): string {
    return formatarCronometro(segundos ?? 0);
  }
}

@Pipe({ name: 'telefone' })
export class TelefonePipe implements PipeTransform {
  transform(valor: string | null | undefined): string {
    return valor ? formatarTelefone(valor) : '—';
  }
}

/** Nome -> "AB" para avatares. */
@Pipe({ name: 'iniciais' })
export class IniciaisPipe implements PipeTransform {
  transform(nome: string | null | undefined): string {
    return nome ? iniciais(nome) : '?';
  }
}

/**
 * Data ISO -> "hoje", "ontem", "em 3 dias", "ha 5 dias".
 *
 * Strings "AAAA-MM-DD" sao interpretadas pelo JS como meia-noite UTC. Em
 * fusos negativos (Brasil) isso joga a data um dia para tras, entao datas
 * puras sao montadas explicitamente no fuso local.
 */
@Pipe({ name: 'quando' })
export class QuandoPipe implements PipeTransform {
  transform(iso: string | Date | null | undefined): string {
    if (!iso) return '—';
    const alvo = paraDataLocal(iso);
    const hoje = new Date();
    const a = Date.UTC(alvo.getFullYear(), alvo.getMonth(), alvo.getDate());
    const b = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const dias = Math.round((a - b) / 86_400_000);

    if (dias === 0) return 'hoje';
    if (dias === 1) return 'amanha';
    if (dias === -1) return 'ontem';
    if (dias > 1 && dias <= 30) return `em ${dias} dias`;
    if (dias < -1 && dias >= -30) return `ha ${Math.abs(dias)} dias`;
    return alvo.toLocaleDateString('pt-BR');
  }
}

/** Lista de pipes para importar de uma vez nos componentes. */
export const PIPES_FORMATO = [
  MoedaPipe,
  CompetenciaPipe,
  DiaSemanaPipe,
  CronometroPipe,
  TelefonePipe,
  IniciaisPipe,
  QuandoPipe,
] as const;

/** Converte a entrada em Date sem escorregar de dia em datas puras. */
function paraDataLocal(valor: string | Date): Date {
  if (valor instanceof Date) return valor;
  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (soData) {
    return new Date(Number(soData[1]), Number(soData[2]) - 1, Number(soData[3]));
  }
  return new Date(valor);
}
