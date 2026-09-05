import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import type { AulaGradeDto, InstrutorDto, ModalidadeDto, PlanoDto } from '@almativa/shared';
import { PublicoApi } from '../../core/api/publico.api';
import { DiaSemanaPipe, MoedaPipe } from '../../core/pipes/formato.pipes';

@Component({
  selector: 'app-modalidades',
  imports: [RouterLink, MatButtonModule, MatIconModule, MoedaPipe, DiaSemanaPipe],
  templateUrl: './modalidades.html',
  styleUrl: './modalidades.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Modalidades {
  private readonly api = inject(PublicoApi);

  private readonly modalidadesRaw = toSignal(
    this.api.modalidades().pipe(catchError(() => of([] as ModalidadeDto[]))),
    { initialValue: [] as ModalidadeDto[] },
  );
  private readonly planos = toSignal(this.api.planos().pipe(catchError(() => of([] as PlanoDto[]))), {
    initialValue: [] as PlanoDto[],
  });
  private readonly instrutores = toSignal(
    this.api.instrutores().pipe(catchError(() => of([] as InstrutorDto[]))),
    { initialValue: [] as InstrutorDto[] },
  );
  private readonly grade = toSignal(this.api.grade().pipe(catchError(() => of([] as AulaGradeDto[]))), {
    initialValue: [] as AulaGradeDto[],
  });

  /** Junta modalidade + planos + equipe + horários em um único bloco por seção. */
  readonly blocos = computed(() =>
    this.modalidadesRaw().map((modalidade) => ({
      modalidade,
      planos: this.planos().filter((p) => p.modalidade?.id === modalidade.id),
      equipe: this.instrutores().filter((i) => i.modalidades.some((m) => m.id === modalidade.id)),
      horarios: this.grade()
        .filter((g) => g.modalidadeSlug === modalidade.slug)
        .sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio)),
    })),
  );
}
