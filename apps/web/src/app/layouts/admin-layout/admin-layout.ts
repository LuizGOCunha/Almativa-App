import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, map, of, switchMap, timer } from 'rxjs';
import { Shell, type ItemNavegacao } from '../shell/shell';
import { ComunicacaoApi } from '../../core/api/comunicacao.api';
import { FinanceiroApi } from '../../core/api/financeiro.api';

@Component({
  selector: 'app-admin-layout',
  imports: [Shell],
  template: `<app-shell areaRotulo="Administração" [itens]="itens()" [contadores]="contadores()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayout {
  private readonly comunicacao = inject(ComunicacaoApi);
  private readonly financeiro = inject(FinanceiroApi);

  readonly itens = signal<ItemNavegacao[]>([
    { rota: '/admin', rotulo: 'Visão geral', icone: 'dashboard', exato: true },
    { rota: '/admin/alunos', rotulo: 'Alunos', icone: 'group' },
    { rota: '/admin/agenda', rotulo: 'Agenda e chamada', icone: 'calendar_month' },
    { rota: '/admin/financeiro', rotulo: 'Financeiro', icone: 'payments' },
    { rota: '/admin/renovacoes', rotulo: 'Renovações', icone: 'event_repeat', contador: 'renovacoes' },
    { rota: '/admin/frequencia', rotulo: 'Frequência', icone: 'fact_check' },
    { rota: '/admin/comunicacao', rotulo: 'Comunicação', icone: 'campaign', contador: 'notificacoes' },
    { rota: '/admin/sala', rotulo: 'Tela da sala', icone: 'tv' },
    { rota: '/admin/configuracoes', rotulo: 'Configurações', icone: 'settings' },
  ]);

  /** Badges do menu, revalidados a cada minuto. */
  readonly contadores = toSignal(
    timer(0, 60_000).pipe(
      switchMap(() =>
        combineLatest([
          this.comunicacao.naoLidas().pipe(catchError(() => of({ total: 0 }))),
          this.financeiro.renovacoes(10, true).pipe(catchError(() => of([]))),
        ]),
      ),
      map(([naoLidas, renovacoes]) => ({
        notificacoes: naoLidas.total,
        // O badge conta o que já venceu ou vence hoje — o que exige ação.
        renovacoes: renovacoes.filter((r) => r.situacao !== 'PROXIMA').length,
      })),
    ),
    { initialValue: { notificacoes: 0, renovacoes: 0 } },
  );
}
