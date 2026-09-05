import { CompetenciaPipe, CronometroPipe, MoedaPipe, QuandoPipe } from './formato.pipes';

describe('Pipes de formato', () => {
  describe('QuandoPipe', () => {
    let pipe: QuandoPipe;

    beforeEach(() => {
      pipe = new QuandoPipe();
      jasmine.clock().install();
      // Sexta, 05/09/2026, meio-dia no fuso local.
      jasmine.clock().mockDate(new Date(2026, 8, 5, 12, 0, 0));
    });

    afterEach(() => jasmine.clock().uninstall());

    it('trata "hoje" corretamente para uma data pura', () => {
      expect(pipe.transform('2026-09-05')).toBe('hoje');
    });

    /**
     * Regressão: "AAAA-MM-DD" é parseado pelo JS como meia-noite UTC. Em
     * fusos negativos isso jogava a data um dia para trás — uma mensalidade
     * que vencia hoje aparecia como vencida ontem, e "em 5 dias" virava
     * "em 4". Ver a seção "Convenção de datas" do README.
     */
    it('não escorrega de dia em fuso negativo', () => {
      expect(pipe.transform('2026-09-10')).toBe('em 5 dias');
      expect(pipe.transform('2026-09-06')).toBe('amanha');
      expect(pipe.transform('2026-09-04')).toBe('ontem');
    });

    it('descreve o passado recente', () => {
      expect(pipe.transform('2026-08-31')).toBe('ha 5 dias');
    });

    it('cai para data absoluta fora da janela de 30 dias', () => {
      expect(pipe.transform('2026-11-20')).toBe(new Date(2026, 10, 20).toLocaleDateString('pt-BR'));
    });

    it('aceita timestamp completo sem alterar o dia', () => {
      expect(pipe.transform('2026-09-05T23:30:00.000Z')).toBe('hoje');
    });

    it('devolve travessão para valor ausente', () => {
      expect(pipe.transform(null)).toBe('—');
      expect(pipe.transform(undefined)).toBe('—');
    });
  });

  describe('MoedaPipe', () => {
    const pipe = new MoedaPipe();

    it('formata centavos como real', () => {
      //   é o espaço não separável que o Intl insere após "R$".
      expect(pipe.transform(32000)).toBe('R$ 320,00');
    });

    it('trata zero e ausência', () => {
      expect(pipe.transform(0)).toBe('R$ 0,00');
      expect(pipe.transform(null)).toBe('R$ 0,00');
    });
  });

  describe('CompetenciaPipe', () => {
    const pipe = new CompetenciaPipe();

    it('escreve a competência por extenso', () => {
      expect(pipe.transform('2026-09')).toBe('Setembro/2026');
    });

    it('trata ausência', () => {
      expect(pipe.transform(null)).toBe('—');
    });
  });

  describe('CronometroPipe', () => {
    const pipe = new CronometroPipe();

    it('formata minutos e segundos', () => {
      expect(pipe.transform(45)).toBe('00:45');
      expect(pipe.transform(300)).toBe('05:00');
    });

    it('inclui a hora quando passa de 60 minutos', () => {
      expect(pipe.transform(3661)).toBe('1:01:01');
    });

    it('não devolve valor negativo', () => {
      expect(pipe.transform(-10)).toBe('00:00');
    });
  });
});
