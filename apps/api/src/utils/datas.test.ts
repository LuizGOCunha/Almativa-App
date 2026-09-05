import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  comHora,
  competenciaDe,
  dataPura,
  deIsoData,
  diferencaEmDias,
  fimDoDiaLocal,
  hojeComoData,
  inicioDaCompetencia,
  inicioDaSemana,
  inicioDoDiaLocal,
  inicioDoMesLocal,
  paraIsoData,
  somarMesesCompetencia,
  vencimentoDaCompetencia,
} from './datas.js';

/**
 * A convenção está descrita no topo de `datas.ts` e na seção "Convenção de
 * datas" do README: data pura vive em UTC, timestamp vive no fuso local.
 * Estes testes travam esse contrato — foi a fonte de todos os bugs de fuso.
 */
describe('utils/datas', () => {
  afterEach(() => vi.useRealTimers());

  describe('datas puras (UTC)', () => {
    it('constrói a data à meia-noite UTC, como o Postgres devolve', () => {
      expect(dataPura(2026, 9, 5).toISOString()).toBe('2026-09-05T00:00:00.000Z');
    });

    it('faz a volta ISO -> Date -> ISO sem perder o dia', () => {
      expect(paraIsoData(deIsoData('2026-09-05'))).toBe('2026-09-05');
      expect(paraIsoData(deIsoData('2026-01-01'))).toBe('2026-01-01');
      expect(paraIsoData(deIsoData('2026-12-31'))).toBe('2026-12-31');
    });

    it('hojeComoData usa o dia local, mas no formato das colunas date', () => {
      // 05/09/2026 09:00 em São Paulo = 12:00 UTC.
      vi.setSystemTime(new Date('2026-09-05T12:00:00.000Z'));
      expect(hojeComoData().toISOString()).toBe('2026-09-05T00:00:00.000Z');
    });

    /**
     * Regressão: com getters locais, uma coluna `date` de 05/09 lida como
     * 2026-09-05T00:00Z virava 04/09 em UTC-3 — a mensalidade que vencia hoje
     * aparecia como vencida ontem.
     */
    it('diferencaEmDias não escorrega em fuso negativo', () => {
      const hoje = dataPura(2026, 9, 5);

      expect(diferencaEmDias(hoje, dataPura(2026, 9, 5))).toBe(0);
      expect(diferencaEmDias(hoje, dataPura(2026, 9, 10))).toBe(5);
      expect(diferencaEmDias(hoje, dataPura(2026, 9, 4))).toBe(-1);
    });

    it('diferencaEmDias atravessa a virada do mês e do ano', () => {
      expect(diferencaEmDias(dataPura(2026, 8, 31), dataPura(2026, 9, 1))).toBe(1);
      expect(diferencaEmDias(dataPura(2026, 12, 31), dataPura(2027, 1, 1))).toBe(1);
    });
  });

  describe('competências', () => {
    it('formata a competência a partir da data', () => {
      expect(competenciaDe(new Date(2026, 8, 5))).toBe('2026-09');
      expect(competenciaDe(new Date(2026, 0, 15))).toBe('2026-01');
    });

    it('soma e subtrai meses atravessando o ano', () => {
      expect(somarMesesCompetencia('2026-09', 1)).toBe('2026-10');
      expect(somarMesesCompetencia('2026-12', 1)).toBe('2027-01');
      expect(somarMesesCompetencia('2026-01', -1)).toBe('2025-12');
      expect(somarMesesCompetencia('2026-09', 3)).toBe('2026-12');
    });

    it('resolve o primeiro dia da competência', () => {
      expect(inicioDaCompetencia('2026-09').toISOString()).toBe('2026-09-01T00:00:00.000Z');
    });
  });

  describe('vencimentoDaCompetencia', () => {
    it('usa o dia escolhido pelo aluno', () => {
      expect(paraIsoData(vencimentoDaCompetencia('2026-09', 10))).toBe('2026-09-10');
    });

    it('cai no último dia quando o mês é curto', () => {
      // Fevereiro de 2026 não é bissexto: dia 31 vira 28.
      expect(paraIsoData(vencimentoDaCompetencia('2026-02', 31))).toBe('2026-02-28');
      expect(paraIsoData(vencimentoDaCompetencia('2026-04', 31))).toBe('2026-04-30');
    });

    it('respeita ano bissexto', () => {
      expect(paraIsoData(vencimentoDaCompetencia('2028-02', 30))).toBe('2028-02-29');
    });

    it('protege contra dia fora da faixa', () => {
      expect(paraIsoData(vencimentoDaCompetencia('2026-09', 0))).toBe('2026-09-01');
      expect(paraIsoData(vencimentoDaCompetencia('2026-09', 99))).toBe('2026-09-30');
    });
  });

  describe('timestamps (fuso local)', () => {
    it('inicioDoDiaLocal e fimDoDiaLocal cobrem o dia inteiro', () => {
      const inicio = inicioDoDiaLocal('2026-09-05');
      const fim = fimDoDiaLocal('2026-09-05');

      expect(inicio.getHours()).toBe(0);
      expect(inicio.getDate()).toBe(5);
      expect(fim.getHours()).toBe(23);
      expect(fim.getMinutes()).toBe(59);
      expect(fim.getDate()).toBe(5);
      expect(fim.getTime()).toBeGreaterThan(inicio.getTime());
    });

    it('inicioDoMesLocal aponta para o primeiro instante do mês', () => {
      const inicio = inicioDoMesLocal('2026-09');
      expect(inicio.getDate()).toBe(1);
      expect(inicio.getMonth()).toBe(8);
      expect(inicio.getHours()).toBe(0);
    });

    it('comHora combina a data com o horário da turma', () => {
      const aula = comHora(new Date(2026, 8, 5), '07:30');
      expect(aula.getHours()).toBe(7);
      expect(aula.getMinutes()).toBe(30);
      expect(aula.getDate()).toBe(5);
    });
  });

  describe('inicioDaSemana', () => {
    it('devolve a segunda-feira da semana', () => {
      // 05/09/2026 é um sábado; a segunda é dia 31/08.
      expect(inicioDaSemana(new Date(2026, 8, 5)).getDate()).toBe(31);
    });

    it('trata domingo como fim da semana, não início', () => {
      // 06/09/2026 é domingo: a segunda ainda é 31/08.
      const segunda = inicioDaSemana(new Date(2026, 8, 6));
      expect(segunda.getDate()).toBe(31);
      expect(segunda.getMonth()).toBe(7);
    });

    it('é idempotente quando já é segunda', () => {
      expect(inicioDaSemana(new Date(2026, 8, 7)).getDate()).toBe(7);
    });
  });
});
