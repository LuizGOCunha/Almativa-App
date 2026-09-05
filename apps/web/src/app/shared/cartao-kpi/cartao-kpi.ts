import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Cartão de indicador da visão geral. */
@Component({
  selector: 'app-cartao-kpi',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="kpi" [style.--cor]="cor()">
      <div class="kpi__topo">
        <span class="kpi__icone"><mat-icon>{{ icone() }}</mat-icon></span>
        @if (variacao() !== null) {
          <span class="kpi__variacao" [class.negativa]="(variacao() ?? 0) < 0">
            <mat-icon>{{ (variacao() ?? 0) < 0 ? 'trending_down' : 'trending_up' }}</mat-icon>
            {{ (variacao() ?? 0) > 0 ? '+' : '' }}{{ variacao() }}%
          </span>
        }
      </div>
      <p class="kpi__valor">{{ valor() }}</p>
      <p class="kpi__rotulo">{{ rotulo() }}</p>
      @if (detalhe()) {
        <p class="kpi__detalhe">{{ detalhe() }}</p>
      }
    </article>
  `,
  styleUrl: './cartao-kpi.scss',
})
export class CartaoKpi {
  readonly rotulo = input.required<string>();
  readonly valor = input.required<string | number>();
  readonly icone = input('insights');
  readonly cor = input('var(--alm-verde)');
  readonly detalhe = input<string | null>(null);
  /** Variação percentual em relação ao período anterior. */
  readonly variacao = input<number | null>(null);
}
