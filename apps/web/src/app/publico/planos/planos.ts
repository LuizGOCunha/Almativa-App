import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { MESES_POR_PERIODICIDADE, type PlanoDto } from '@almativa/shared';
import { PublicoApi } from '../../core/api/publico.api';
import { MoedaPipe } from '../../core/pipes/formato.pipes';

interface GrupoPlanos {
  titulo: string;
  cor: string;
  planos: (PlanoDto & { valorMensalCentavos: number; economia: number })[];
}

@Component({
  selector: 'app-planos',
  imports: [RouterLink, MatButtonModule, MatIconModule, MoedaPipe],
  templateUrl: './planos.html',
  styleUrl: './planos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Planos {
  private readonly api = inject(PublicoApi);

  private readonly planos = toSignal(this.api.planos().pipe(catchError(() => of([] as PlanoDto[]))), {
    initialValue: [] as PlanoDto[],
  });

  /** Agrupa por modalidade e calcula o custo mensal equivalente. */
  readonly grupos = computed<GrupoPlanos[]>(() => {
    const porGrupo = new Map<string, GrupoPlanos>();

    for (const plano of this.planos()) {
      const chave = plano.modalidade?.id ?? 'combo';
      const titulo = plano.modalidade?.nome ?? 'Combinados';
      const cor = plano.modalidade?.cor ?? '#1E4D3B';

      if (!porGrupo.has(chave)) porGrupo.set(chave, { titulo, cor, planos: [] });

      const meses = MESES_POR_PERIODICIDADE[plano.periodicidade];
      const valorMensalCentavos = Math.round(plano.valorCentavos / meses);
      const referencia = this.planos().find(
        (p) => p.modalidade?.id === plano.modalidade?.id && p.periodicidade === 'MENSAL',
      );
      const economia =
        referencia && meses > 1
          ? Math.max(0, Math.round((1 - valorMensalCentavos / referencia.valorCentavos) * 100))
          : 0;

      porGrupo.get(chave)!.planos.push({ ...plano, valorMensalCentavos, economia });
    }

    // Combos por último.
    return [...porGrupo.entries()]
      .sort(([a], [b]) => (a === 'combo' ? 1 : b === 'combo' ? -1 : 0))
      .map(([, grupo]) => grupo);
  });

  readonly perguntas = [
    {
      pergunta: 'Tem fidelidade?',
      resposta:
        'Os planos mensais não têm. Trimestral, semestral e anual têm o desconto atrelado ao período contratado — se cancelar antes, cobramos a diferença dos meses já usados no valor mensal.',
    },
    {
      pergunta: 'Posso trancar a matrícula?',
      resposta:
        'Sim, por até 60 dias por ano, sem custo. Basta avisar a recepção ou pedir pela sua área de aluno.',
    },
    {
      pergunta: 'Como funciona o vencimento?',
      resposta:
        'Você escolhe o dia (5, 10, 15 ou 20). Avisamos 7, 3 e 1 dia antes pelo app e por e-mail — e nunca bloqueamos o acesso sem falar com você.',
    },
    {
      pergunta: 'E se eu faltar?',
      resposta:
        'A aula não é reposta automaticamente, mas o check-in pelo app libera a vaga para outro aluno e conta ponto com a gente. Consulte a recepção para reposições.',
    },
  ];
}
