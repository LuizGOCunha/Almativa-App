import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import {
  competenciaLegivel,
  formatarMoeda,
  type DashboardAdminDto,
  type RenovacaoDto,
} from '@almativa/shared';
import { PainelApi } from '../../core/api/painel.api';
import { FinanceiroApi } from '../../core/api/financeiro.api';
import { CartaoKpi } from '../../shared/cartao-kpi/cartao-kpi';
import { EstadoVazio } from '../../shared/estado-vazio/estado-vazio';
import { MoedaPipe, QuandoPipe } from '../../core/pipes/formato.pipes';

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    CartaoKpi,
    EstadoVazio,
    MoedaPipe,
    QuandoPipe,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly painel = inject(PainelApi);
  private readonly financeiro = inject(FinanceiroApi);

  readonly dados = toSignal(this.painel.dashboard().pipe(catchError(() => of(null))), {
    initialValue: null as DashboardAdminDto | null,
  });

  readonly renovacoes = toSignal(
    this.financeiro.renovacoes(10, true).pipe(catchError(() => of([] as RenovacaoDto[]))),
    { initialValue: [] as RenovacaoDto[] },
  );

  readonly agora = signal(new Date());

  /** Variação da receita do mês contra o mês anterior. */
  readonly variacaoReceita = computed(() => {
    const d = this.dados();
    if (!d || d.receitaMesAnteriorCentavos === 0) return null;
    return Math.round(
      ((d.receitaMesCentavos - d.receitaMesAnteriorCentavos) / d.receitaMesAnteriorCentavos) * 100,
    );
  });

  /** Pendências que exigem ação hoje. */
  readonly pendentes = computed(() => this.renovacoes().filter((r) => r.situacao !== 'PROXIMA'));

  readonly proximas = computed(() =>
    this.renovacoes()
      .filter((r) => r.situacao === 'PROXIMA')
      .slice(0, 6),
  );

  /** Barras do gráfico de receita, normalizadas pelo maior valor. */
  readonly barrasReceita = computed(() => {
    const serie = this.dados()?.receitaUltimos6Meses ?? [];
    const maior = Math.max(1, ...serie.map((s) => s.valorCentavos));
    return serie.map((s) => ({
      competencia: s.competencia,
      rotulo: competenciaLegivel(s.competencia).slice(0, 3),
      valor: formatarMoeda(s.valorCentavos),
      altura: Math.round((s.valorCentavos / maior) * 100),
      zerado: s.valorCentavos === 0,
    }));
  });

  /** Sparkline de presenças dos últimos 30 dias. */
  readonly barrasFrequencia = computed(() => {
    const serie = this.dados()?.frequenciaUltimos30Dias ?? [];
    const maior = Math.max(1, ...serie.map((s) => s.presencas));
    return serie.map((s) => ({
      data: s.data,
      presencas: s.presencas,
      altura: Math.max(4, Math.round((s.presencas / maior) * 100)),
    }));
  });

  readonly totalPorModalidade = computed(() => {
    const linhas = this.dados()?.porModalidade ?? [];
    const total = Math.max(1, ...[linhas.reduce((t, l) => t + l.alunos, 0)]);
    return linhas.map((l) => ({ ...l, percentual: Math.round((l.alunos / total) * 100) }));
  });
}
