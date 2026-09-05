import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap, timer } from 'rxjs';
import { Shell, type ItemNavegacao } from '../shell/shell';
import { AlunoAreaApi } from '../../core/api/aluno-area.api';

@Component({
  selector: 'app-aluno-layout',
  imports: [Shell],
  template: `
    <app-shell areaRotulo="Área do aluno" [itens]="itens()" [contadores]="contadores()" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlunoLayout {
  private readonly api = inject(AlunoAreaApi);

  readonly itens = signal<ItemNavegacao[]>([
    { rota: '/aluno', rotulo: 'Início', icone: 'home', exato: true },
    { rota: '/aluno/agenda', rotulo: 'Agenda e check-in', icone: 'event_available' },
    { rota: '/aluno/frequencia', rotulo: 'Minha frequência', icone: 'insights' },
    { rota: '/aluno/mensalidades', rotulo: 'Mensalidades', icone: 'payments' },
    {
      rota: '/aluno/notificacoes',
      rotulo: 'Avisos',
      icone: 'notifications',
      contador: 'avisos',
    },
    { rota: '/aluno/perfil', rotulo: 'Meus dados', icone: 'person' },
  ]);

  readonly contadores = toSignal(
    timer(0, 60_000).pipe(
      switchMap(() => this.api.naoLidas().pipe(catchError(() => of({ total: 0 })))),
      map(({ total }) => ({ avisos: total })),
    ),
    { initialValue: { avisos: 0 } },
  );
}
