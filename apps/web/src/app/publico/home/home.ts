import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import type { InstrutorDto, ModalidadeDto, PlanoDto } from '@almativa/shared';
import { PublicoApi, type ConfiguracoesSite } from '../../core/api/publico.api';
import { MoedaPipe } from '../../core/pipes/formato.pipes';
import { LogoAlmativa } from '../../shared/logo/logo';

@Component({
  selector: 'app-home',
  imports: [RouterLink, MatButtonModule, MatIconModule, MoedaPipe, LogoAlmativa],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly api = inject(PublicoApi);

  readonly modalidades = toSignal(
    this.api.modalidades().pipe(catchError(() => of([] as ModalidadeDto[]))),
    { initialValue: [] as ModalidadeDto[] },
  );

  readonly planos = toSignal(this.api.planos().pipe(catchError(() => of([] as PlanoDto[]))), {
    initialValue: [] as PlanoDto[],
  });

  readonly instrutores = toSignal(
    this.api.instrutores().pipe(catchError(() => of([] as InstrutorDto[]))),
    { initialValue: [] as InstrutorDto[] },
  );

  readonly config = toSignal(
    this.api.configuracoes().pipe(catchError(() => of({} as ConfiguracoesSite))),
    { initialValue: {} as ConfiguracoesSite },
  );

  readonly diferenciais = signal([
    {
      icone: 'groups',
      titulo: 'Turmas pequenas',
      texto: 'No máximo 8 pessoas no Pilates. O professor consegue olhar para cada aluno.',
    },
    {
      icone: 'medical_services',
      titulo: 'Fisio e treino conversando',
      texto: 'Seu fisioterapeuta e seu instrutor dividem o mesmo prontuário. Nada se perde.',
    },
    {
      icone: 'event_available',
      titulo: 'Check-in pelo app',
      texto: 'Garanta sua vaga, veja sua frequência e acompanhe suas mensalidades pelo celular.',
    },
    {
      icone: 'trending_up',
      titulo: 'Progresso registrado',
      texto: 'Cada aula que você faz fica registrada. Dá para ver a evolução em números.',
    },
  ]);
}
