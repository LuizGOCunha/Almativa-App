import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import type { RenovacaoDto, SituacaoRenovacao } from '@almativa/shared';
import { FinanceiroApi } from '../../core/api/financeiro.api';
import { AvisoService } from '../../core/ui/aviso.service';
import { ConfirmacaoDialog } from '../../core/ui/confirmacao.dialog';
import { EstadoVazio } from '../../shared/estado-vazio/estado-vazio';
import { CompetenciaPipe, IniciaisPipe, MoedaPipe, QuandoPipe } from '../../core/pipes/formato.pipes';
import { RegistrarPagamentoDialog } from '../financeiro/registrar-pagamento.dialog';

/**
 * Painel de renovações: o que vence nos próximos dias e o que já venceu.
 * É daqui que a recepção dispara os lembretes fora do horário do cron.
 */
@Component({
  selector: 'app-renovacoes',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    MatProgressBarModule,
    MatTooltipModule,
    EstadoVazio,
    CompetenciaPipe,
    IniciaisPipe,
    MoedaPipe,
    QuandoPipe,
  ],
  templateUrl: './renovacoes.html',
  styleUrl: './renovacoes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Renovacoes {
  private readonly api = inject(FinanceiroApi);
  private readonly dialog = inject(MatDialog);
  private readonly aviso = inject(AvisoService);

  readonly colunas = ['aluno', 'plano', 'competencia', 'vencimento', 'valor', 'lembretes', 'acoes'];

  readonly janela = signal(10);
  readonly filtroSituacao = signal<SituacaoRenovacao | ''>('');
  readonly carregando = signal(false);
  readonly enviandoLembretes = signal(false);
  readonly renovacoes = signal<RenovacaoDto[]>([]);

  readonly pendentes = computed(() => this.renovacoes().filter((r) => r.situacao === 'PENDENTE'));
  readonly venceHoje = computed(() => this.renovacoes().filter((r) => r.situacao === 'VENCE_HOJE'));
  readonly proximas = computed(() => this.renovacoes().filter((r) => r.situacao === 'PROXIMA'));

  readonly totalPendente = computed(() =>
    this.pendentes().reduce((soma, r) => soma + r.valorCentavos, 0),
  );
  readonly totalAVencer = computed(() =>
    [...this.venceHoje(), ...this.proximas()].reduce((soma, r) => soma + r.valorCentavos, 0),
  );

  readonly listaFiltrada = computed(() => {
    const filtro = this.filtroSituacao();
    const lista = this.renovacoes();
    return filtro ? lista.filter((r) => r.situacao === filtro) : lista;
  });

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      this.renovacoes.set(await firstValueFrom(this.api.renovacoes(this.janela(), true)));
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível carregar as renovações.');
    } finally {
      this.carregando.set(false);
    }
  }

  aoMudarJanela(dias: number): void {
    this.janela.set(dias);
    void this.carregar();
  }

  classeSituacao(situacao: SituacaoRenovacao): string {
    return situacao === 'PENDENTE'
      ? 'alm-selo--erro'
      : situacao === 'VENCE_HOJE'
        ? 'alm-selo--alerta'
        : 'alm-selo--info';
  }

  rotuloSituacao(r: RenovacaoDto): string {
    if (r.situacao === 'VENCE_HOJE') return 'vence hoje';
    if (r.situacao === 'PENDENTE') {
      return `${Math.abs(r.diasParaVencer)} dia(s) em atraso`;
    }
    return `em ${r.diasParaVencer} dia(s)`;
  }

  /**
   * Dispara os lembretes agora. Por padrão respeita os marcos (7/3/1 dia);
   * o modo "forçar" notifica todo mundo da janela, ignorando os marcos —
   * a deduplicação por marco ainda evita mensagem repetida no mesmo dia.
   */
  async dispararLembretes(forcar: boolean): Promise<void> {
    if (forcar) {
      const ref = this.dialog.open(ConfirmacaoDialog, {
        data: {
          titulo: 'Enviar lembrete para todos?',
          mensagem:
            'Todo aluno com mensalidade em aberto ou vencida na janela receberá um aviso agora, mesmo fora dos marcos automáticos. Quem já recebeu hoje não recebe de novo.',
          confirmar: 'Enviar agora',
          icone: 'campaign',
        },
      });
      if (!(await firstValueFrom(ref.afterClosed()))) return;
    }

    this.enviandoLembretes.set(true);
    try {
      const r = await firstValueFrom(this.api.dispararLembretes(forcar));
      this.aviso.sucesso(
        r.notificados > 0
          ? `${r.notificados} lembrete(s) enviado(s) de ${r.analisadas} mensalidade(s) analisadas.`
          : 'Nenhum lembrete novo — todos já foram avisados.',
      );
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível enviar os lembretes.');
    } finally {
      this.enviandoLembretes.set(false);
    }
  }

  async receber(renovacao: RenovacaoDto): Promise<void> {
    try {
      const mensalidade = await firstValueFrom(this.api.mensalidade(renovacao.mensalidadeId));
      const ref = this.dialog.open(RegistrarPagamentoDialog, { data: { mensalidade } });
      if (await firstValueFrom(ref.afterClosed())) await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível abrir a mensalidade.');
    }
  }
}
