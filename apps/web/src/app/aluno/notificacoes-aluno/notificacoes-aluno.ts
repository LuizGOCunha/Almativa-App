import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { firstValueFrom } from 'rxjs';
import type { NotificacaoDto } from '@almativa/shared';
import { AlunoAreaApi } from '../../core/api/aluno-area.api';
import { AvisoService } from '../../core/ui/aviso.service';
import { ICONE_NOTIFICACAO } from '../../core/ui/rotulos';
import { EstadoVazio } from '../../shared/estado-vazio/estado-vazio';
import { QuandoPipe } from '../../core/pipes/formato.pipes';

@Component({
  selector: 'app-notificacoes-aluno',
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    EstadoVazio,
    QuandoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="alm-titulo-pagina">
      <div>
        <h1>Avisos</h1>
        <p>
          @if (naoLidas() > 0) {
            Você tem <strong>{{ naoLidas() }}</strong> aviso(s) não lido(s).
          } @else {
            Tudo lido por aqui.
          }
        </p>
      </div>
      @if (naoLidas() > 0) {
        <button matButton="outlined" (click)="lerTodas()">
          <mat-icon>done_all</mat-icon> Marcar tudo como lido
        </button>
      }
    </header>

    @if (carregando()) {
      <mat-progress-bar mode="indeterminate" />
    }

    @if (notificacoes().length === 0 && !carregando()) {
      <app-estado-vazio
        icone="notifications_none"
        titulo="Nenhum aviso"
        descricao="Lembretes de vencimento, mudanças de aula e novidades aparecem aqui."
      />
    } @else {
      <ul class="lista">
        @for (n of notificacoes(); track n.id) {
          <li
            class="alm-cartao item"
            [class.item--nova]="!n.lidaEm"
            [attr.data-tipo]="n.tipo"
            (click)="marcarLida(n)"
          >
            <span class="item__icone"><mat-icon>{{ icones[n.tipo] }}</mat-icon></span>

            <div class="item__texto">
              <strong>{{ n.titulo }}</strong>
              <p>{{ n.mensagem }}</p>
              <small>
                {{ n.criadoEm | quando }} · {{ n.criadoEm | date: "dd/MM 'às' HH:mm" }}
              </small>
            </div>

            @if (!n.lidaEm) {
              <span class="item__ponto" aria-label="Não lido"></span>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .lista {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 10px;
    }

    .item {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 16px 20px;
      cursor: pointer;
      border-left: 4px solid transparent;
      transition: border-color 0.16s ease;

      &--nova {
        border-left-color: var(--alm-teal);
        background: color-mix(in srgb, var(--alm-teal) 5%, var(--mat-sys-surface));
      }

      /* O tom acompanha a urgência do aviso. */
      &[data-tipo='VENCIMENTO_ATRASADO'] .item__icone {
        background: var(--alm-erro-fundo);
        color: var(--alm-erro);
      }

      &[data-tipo='VENCIMENTO_PROXIMO'] .item__icone {
        background: var(--alm-alerta-fundo);
        color: var(--alm-alerta);
      }

      &[data-tipo='PAGAMENTO_CONFIRMADO'] .item__icone,
      &[data-tipo='VAGA_LIBERADA'] .item__icone {
        background: var(--alm-sucesso-fundo);
        color: var(--alm-sucesso);
      }

      &__icone {
        display: grid;
        place-items: center;
        flex-shrink: 0;
        width: 38px;
        height: 38px;
        border-radius: 11px;
        background: var(--alm-info-fundo);
        color: var(--alm-info);

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
      }

      &__texto {
        flex: 1;
        min-width: 0;

        strong {
          display: block;
          font-size: 0.9375rem;
          font-weight: 600;
        }

        p {
          margin: 4px 0 0;
          font-size: 0.875rem;
          line-height: 1.55;
          color: var(--mat-sys-on-surface-variant);
        }

        small {
          display: block;
          margin-top: 8px;
          font-size: 0.75rem;
          color: var(--mat-sys-outline);
        }
      }

      &__ponto {
        flex-shrink: 0;
        width: 9px;
        height: 9px;
        margin-top: 6px;
        border-radius: 50%;
        background: var(--alm-teal);
      }
    }
  `,
})
export class NotificacoesAluno {
  private readonly api = inject(AlunoAreaApi);
  private readonly aviso = inject(AvisoService);

  readonly icones = ICONE_NOTIFICACAO;
  readonly notificacoes = signal<NotificacaoDto[]>([]);
  readonly carregando = signal(true);

  readonly naoLidas = computed(() => this.notificacoes().filter((n) => !n.lidaEm).length);

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      const pagina = await firstValueFrom(this.api.notificacoes(false, 1, 60));
      this.notificacoes.set(pagina.itens);
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível carregar seus avisos.');
    } finally {
      this.carregando.set(false);
    }
  }

  async marcarLida(n: NotificacaoDto): Promise<void> {
    if (n.lidaEm) return;

    // Atualiza a lista na hora; o servidor confirma em seguida.
    this.notificacoes.update((lista) =>
      lista.map((item) => (item.id === n.id ? { ...item, lidaEm: new Date().toISOString() } : item)),
    );

    try {
      await firstValueFrom(this.api.marcarLida(n.id));
    } catch (erro) {
      this.aviso.erro(erro);
      await this.carregar();
    }
  }

  async lerTodas(): Promise<void> {
    try {
      await firstValueFrom(this.api.lerTodas());
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro);
    }
  }
}
