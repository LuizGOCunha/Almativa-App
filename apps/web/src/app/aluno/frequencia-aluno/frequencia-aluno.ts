import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import type { FrequenciaDto } from '@almativa/shared';
import { AlunoAreaApi } from '../../core/api/aluno-area.api';
import { ROTULO_STATUS_FREQUENCIA } from '../../core/ui/rotulos';
import { Selo } from '../../shared/selo/selo';
import { EstadoVazio } from '../../shared/estado-vazio/estado-vazio';

@Component({
  selector: 'app-frequencia-aluno',
  imports: [DatePipe, MatIconModule, Selo, EstadoVazio],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="alm-titulo-pagina">
      <div>
        <h1>Minha frequência</h1>
        <p>Todas as aulas em que sua presença foi registrada.</p>
      </div>
    </header>

    <section class="resumo">
      <article>
        <span>Presenças</span>
        <strong>{{ resumo().presencas }}</strong>
        <small>no total</small>
      </article>
      <article>
        <span>Aproveitamento</span>
        <strong>{{ resumo().aproveitamento }}%</strong>
        <small>{{ resumo().total }} aula(s) marcada(s)</small>
      </article>
      <article>
        <span>Últimos 30 dias</span>
        <strong>{{ resumo().recentes }}</strong>
        <small>aulas feitas</small>
      </article>
    </section>

    @if (porMes().length === 0) {
      <app-estado-vazio
        icone="fact_check"
        titulo="Nenhuma presença ainda"
        descricao="Sua frequência aparece aqui depois que o professor fecha a chamada."
      />
    } @else {
      @for (grupo of porMes(); track grupo.chave) {
        <section class="mes">
          <h2>
            {{ grupo.rotulo }}
            <span>{{ grupo.presencas }} presença(s)</span>
          </h2>

          <ul class="lista">
            @for (f of grupo.itens; track f.id) {
              <li class="alm-cartao item" [attr.data-status]="f.status">
                <mat-icon>{{ iconePara(f.status) }}</mat-icon>
                <div class="item__texto">
                  <strong>{{ f.inicioEm | date: "EEEE, dd/MM 'às' HH:mm" }}</strong>
                  <small>{{ f.modalidadeSlug }}</small>
                </div>
                <app-selo [rotulo]="rotulos[f.status]" [comIcone]="false" />
              </li>
            }
          </ul>
        </section>
      }
    }
  `,
  styles: `
    .resumo {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      margin-bottom: 26px;

      article {
        padding: 18px 20px;
        border-radius: var(--alm-raio);
        background: var(--mat-sys-surface);
        border: 1px solid var(--mat-sys-outline-variant);
      }

      span {
        display: block;
        font-size: 0.6875rem;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--mat-sys-on-surface-variant);
      }

      strong {
        display: block;
        margin-top: 6px;
        font-family: Outfit, sans-serif;
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--alm-verde-escuro);
        font-variant-numeric: tabular-nums;
      }

      small {
        display: block;
        margin-top: 2px;
        font-size: 0.75rem;
        color: var(--mat-sys-outline);
      }
    }

    .mes {
      margin-bottom: 24px;

      h2 {
        display: flex;
        align-items: baseline;
        gap: 10px;
        margin-bottom: 10px;
        font-size: 0.8125rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--mat-sys-on-surface-variant);

        span {
          font-size: 0.75rem;
          letter-spacing: 0;
          text-transform: none;
          color: var(--alm-verde);
          font-weight: 600;
        }
      }
    }

    .lista {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 8px;
    }

    .item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 13px 18px;

      mat-icon {
        flex-shrink: 0;
        color: var(--mat-sys-outline);
      }

      &[data-status='PRESENTE'] mat-icon {
        color: var(--alm-sucesso);
      }

      &[data-status='AUSENTE'] mat-icon {
        color: var(--alm-erro);
      }

      &[data-status='JUSTIFICADA'] mat-icon {
        color: var(--alm-alerta);
      }

      &__texto {
        flex: 1;
        min-width: 0;

        strong {
          display: block;
          font-size: 0.9375rem;
          font-weight: 500;
          text-transform: capitalize;
        }

        small {
          display: block;
          margin-top: 2px;
          font-size: 0.75rem;
          color: var(--mat-sys-on-surface-variant);
          text-transform: capitalize;
        }
      }
    }
  `,
})
export class FrequenciaAluno {
  private readonly api = inject(AlunoAreaApi);

  readonly rotulos = ROTULO_STATUS_FREQUENCIA;

  readonly frequencia = toSignal(
    this.api.frequencia().pipe(catchError(() => of([] as FrequenciaDto[]))),
    { initialValue: [] as FrequenciaDto[] },
  );

  readonly resumo = computed(() => {
    const lista = this.frequencia();
    const presencas = lista.filter((f) => f.status === 'PRESENTE').length;
    const corte = Date.now() - 30 * 86_400_000;
    return {
      total: lista.length,
      presencas,
      aproveitamento: lista.length > 0 ? Math.round((presencas / lista.length) * 100) : 0,
      recentes: lista.filter(
        (f) => f.status === 'PRESENTE' && new Date(f.inicioEm).getTime() >= corte,
      ).length,
    };
  });

  /** Agrupa por mês para dar sensação de histórico, não de lista infinita. */
  readonly porMes = computed(() => {
    const grupos = new Map<string, FrequenciaDto[]>();

    for (const f of this.frequencia()) {
      const chave = f.inicioEm.slice(0, 7);
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave)!.push(f);
    }

    return [...grupos.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([chave, itens]) => ({
        chave,
        rotulo: new Date(`${chave}-01T12:00:00`).toLocaleDateString('pt-BR', {
          month: 'long',
          year: 'numeric',
        }),
        presencas: itens.filter((f) => f.status === 'PRESENTE').length,
        itens,
      }));
  });

  iconePara(status: string): string {
    return status === 'PRESENTE' ? 'check_circle' : status === 'AUSENTE' ? 'cancel' : 'event_busy';
  }
}
