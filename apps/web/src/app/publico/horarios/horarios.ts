import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { DIAS_SEMANA, type AulaGradeDto, type ModalidadeDto } from '@almativa/shared';
import { PublicoApi } from '../../core/api/publico.api';

interface ColunaDia {
  valor: number;
  curto: string;
  longo: string;
  aulas: AulaGradeDto[];
}

@Component({
  selector: 'app-horarios',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatChipsModule],
  templateUrl: './horarios.html',
  styleUrl: './horarios.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Horarios {
  private readonly api = inject(PublicoApi);

  readonly grade = toSignal(this.api.grade().pipe(catchError(() => of([] as AulaGradeDto[]))), {
    initialValue: [] as AulaGradeDto[],
  });
  readonly modalidades = toSignal(
    this.api.modalidades().pipe(catchError(() => of([] as ModalidadeDto[]))),
    { initialValue: [] as ModalidadeDto[] },
  );

  readonly filtro = signal<string | null>(null);
  readonly hoje = new Date().getDay();

  /** Só mostra domingo se houver alguma turma nele. */
  readonly colunas = computed<ColunaDia[]>(() => {
    const filtrada = this.filtro()
      ? this.grade().filter((a) => a.modalidadeSlug === this.filtro())
      : this.grade();

    return DIAS_SEMANA.map((dia) => ({
      valor: dia.valor,
      curto: dia.curto,
      longo: dia.longo,
      aulas: filtrada
        .filter((a) => a.diaSemana === dia.valor)
        .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
    })).filter((coluna) => coluna.valor !== 0 || coluna.aulas.length > 0);
  });

  readonly totalAulas = computed(() =>
    this.colunas().reduce((total, coluna) => total + coluna.aulas.length, 0),
  );

  alternarFiltro(slug: string): void {
    this.filtro.update((atual) => (atual === slug ? null : slug));
  }
}
