import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import type { MensalidadeDto } from '@almativa/shared';
import { AlunoAreaApi } from '../../core/api/aluno-area.api';
import { ROTULO_METODO, ROTULO_STATUS_MENSALIDADE } from '../../core/ui/rotulos';
import { Selo } from '../../shared/selo/selo';
import { EstadoVazio } from '../../shared/estado-vazio/estado-vazio';
import { CompetenciaPipe, MoedaPipe, QuandoPipe } from '../../core/pipes/formato.pipes';

@Component({
  selector: 'app-mensalidades-aluno',
  imports: [
    DatePipe,
    MatIconModule,
    Selo,
    EstadoVazio,
    CompetenciaPipe,
    MoedaPipe,
    QuandoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="alm-titulo-pagina">
      <div>
        <h1>Mensalidades</h1>
        <p>Suas cobranças, vencimentos e pagamentos já registrados.</p>
      </div>
    </header>

    @if (emAberto().length > 0) {
      <section class="destaque">
        <mat-icon>report</mat-icon>
        <div>
          <strong>{{ totalEmAberto() | moeda }} em aberto</strong>
          <span>
            {{ emAberto().length }} cobrança(s) aguardando pagamento. Fale com a recepção para
            acertar.
          </span>
        </div>
      </section>
    }

    @if (mensalidades().length === 0) {
      <app-estado-vazio
        icone="receipt_long"
        titulo="Nenhuma mensalidade"
        descricao="Assim que sua matrícula for ativada, as cobranças aparecem aqui."
      />
    } @else {
      <ul class="lista">
        @for (m of mensalidades(); track m.id) {
          <li class="alm-cartao item" [class.item--vencida]="m.status === 'VENCIDA'">
            <div class="item__competencia">
              <strong>{{ m.competencia | competencia }}</strong>
              <small>{{ m.planoNome }}</small>
            </div>

            <div class="item__valor">
              <strong>{{ m.valorCentavos | moeda }}</strong>
              <small>
                vence {{ m.vencimentoEm | date: 'dd/MM/yyyy' }}
                @if (m.diasEmAtraso > 0) {
                  · <span class="atraso">{{ m.diasEmAtraso }} dia(s) em atraso</span>
                }
              </small>
            </div>

            <div class="item__status">
              <app-selo [rotulo]="rotulos[m.status]" />
              @if (m.pagamentos.length > 0) {
                <small>
                  {{ metodos[m.pagamentos[0].metodo] }} · {{ m.pagamentos[0].pagoEm | quando }}
                </small>
              }
            </div>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .destaque {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 18px 20px;
      margin-bottom: 20px;
      border-radius: var(--alm-raio);
      background: var(--alm-erro-fundo);
      color: var(--alm-erro);

      strong {
        display: block;
        font-family: Outfit, sans-serif;
        font-size: 1.25rem;
      }

      span {
        display: block;
        margin-top: 4px;
        font-size: 0.875rem;
        line-height: 1.55;
        color: color-mix(in srgb, var(--alm-erro) 82%, black);
      }
    }

    .lista {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 10px;
    }

    .item {
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
      padding: 16px 20px;

      &--vencida {
        border-left: 4px solid var(--alm-erro);
      }

      &__competencia {
        min-width: 160px;

        strong {
          display: block;
          font-size: 1rem;
          font-weight: 600;
        }

        small {
          display: block;
          margin-top: 2px;
          font-size: 0.75rem;
          color: var(--mat-sys-on-surface-variant);
        }
      }

      &__valor {
        flex: 1;
        min-width: 150px;

        strong {
          display: block;
          font-family: Outfit, sans-serif;
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--alm-verde-escuro);
          font-variant-numeric: tabular-nums;
        }

        small {
          display: block;
          margin-top: 2px;
          font-size: 0.75rem;
          color: var(--mat-sys-on-surface-variant);
        }

        .atraso {
          color: var(--alm-erro);
          font-weight: 600;
        }
      }

      &__status {
        text-align: end;

        small {
          display: block;
          margin-top: 5px;
          font-size: 0.6875rem;
          color: var(--mat-sys-outline);
        }
      }
    }
  `,
})
export class MensalidadesAluno {
  private readonly api = inject(AlunoAreaApi);

  readonly rotulos = ROTULO_STATUS_MENSALIDADE;
  readonly metodos = ROTULO_METODO;

  readonly mensalidades = toSignal(
    this.api.mensalidades().pipe(
      map((p) => p.itens),
      catchError(() => of([] as MensalidadeDto[])),
    ),
    { initialValue: [] as MensalidadeDto[] },
  );

  readonly emAberto = computed(() =>
    this.mensalidades().filter((m) => m.status === 'ABERTA' || m.status === 'VENCIDA'),
  );

  readonly totalEmAberto = computed(() =>
    this.emAberto().reduce((soma, m) => soma + m.valorCentavos, 0),
  );
}
