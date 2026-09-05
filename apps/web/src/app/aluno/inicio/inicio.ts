import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import type {
  CheckinDto,
  FrequenciaDto,
  MensalidadeDto,
  NotificacaoDto,
  Paginado,
} from '@almativa/shared';
import { AlunoAreaApi } from '../../core/api/aluno-area.api';
import { AuthService } from '../../core/auth/auth.service';
import { EstadoVazio } from '../../shared/estado-vazio/estado-vazio';
import { CompetenciaPipe, MoedaPipe, QuandoPipe } from '../../core/pipes/formato.pipes';

@Component({
  selector: 'app-inicio',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    EstadoVazio,
    CompetenciaPipe,
    MoedaPipe,
    QuandoPipe,
  ],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inicio {
  private readonly api = inject(AlunoAreaApi);
  private readonly auth = inject(AuthService);

  readonly primeiroNome = this.auth.primeiroNome;

  readonly checkins = toSignal(this.api.checkins(true).pipe(catchError(() => of([] as CheckinDto[]))), {
    initialValue: [] as CheckinDto[],
  });

  readonly mensalidades = toSignal(
    this.api.mensalidades().pipe(catchError(() => of(vazio<MensalidadeDto>()))),
    { initialValue: vazio<MensalidadeDto>() },
  );

  readonly frequencia = toSignal(
    this.api.frequencia().pipe(catchError(() => of([] as FrequenciaDto[]))),
    { initialValue: [] as FrequenciaDto[] },
  );

  readonly avisos = toSignal(
    this.api.notificacoes(true, 1, 5).pipe(catchError(() => of(vazio<NotificacaoDto>()))),
    { initialValue: vazio<NotificacaoDto>() },
  );

  readonly proximaAula = computed(() => this.checkins()[0] ?? null);

  readonly emAberto = computed(() =>
    this.mensalidades().itens.filter((m) => m.status === 'ABERTA' || m.status === 'VENCIDA'),
  );

  readonly proximoVencimento = computed(() => {
    const abertas = [...this.emAberto()].sort((a, b) =>
      a.vencimentoEm.localeCompare(b.vencimentoEm),
    );
    return abertas[0] ?? null;
  });

  /** Presenças dos últimos 30 dias, para o cartão de progresso. */
  readonly resumoFrequencia = computed(() => {
    const corte = Date.now() - 30 * 86_400_000;
    const recentes = this.frequencia().filter((f) => new Date(f.inicioEm).getTime() >= corte);
    const presencas = recentes.filter((f) => f.status === 'PRESENTE').length;
    return {
      presencas,
      total: recentes.length,
      aproveitamento: recentes.length > 0 ? Math.round((presencas / recentes.length) * 100) : 0,
    };
  });

  readonly saudacao = computed(() => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
  });
}

function vazio<T>(): Paginado<T> {
  return { itens: [], total: 0, pagina: 1, porPagina: 0, totalPaginas: 1 };
}
