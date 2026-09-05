import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, firstValueFrom } from 'rxjs';
import {
  competenciaDe,
  competenciaLegivel,
  somarMesesCompetencia,
  type MensalidadeDto,
  type StatusMensalidade,
} from '@almativa/shared';
import { FinanceiroApi } from '../../core/api/financeiro.api';
import { AvisoService } from '../../core/ui/aviso.service';
import { ConfirmacaoDialog } from '../../core/ui/confirmacao.dialog';
import { ROTULO_STATUS_MENSALIDADE } from '../../core/ui/rotulos';
import { Selo } from '../../shared/selo/selo';
import { EstadoVazio } from '../../shared/estado-vazio/estado-vazio';
import { CompetenciaPipe, MoedaPipe } from '../../core/pipes/formato.pipes';
import { RegistrarPagamentoDialog } from './registrar-pagamento.dialog';

@Component({
  selector: 'app-financeiro',
  imports: [
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatMenuModule,
    Selo,
    EstadoVazio,
    CompetenciaPipe,
    MoedaPipe,
  ],
  templateUrl: './financeiro.html',
  styleUrl: './financeiro.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Financeiro {
  private readonly api = inject(FinanceiroApi);
  private readonly dialog = inject(MatDialog);
  private readonly aviso = inject(AvisoService);

  readonly colunas = ['aluno', 'competencia', 'vencimento', 'valor', 'status', 'acoes'];
  readonly rotulos = ROTULO_STATUS_MENSALIDADE;

  readonly busca = new FormControl('', { nonNullable: true });
  readonly competencia = signal(competenciaDe(new Date()));
  readonly status = signal<StatusMensalidade | ''>('');

  readonly pagina = signal(1);
  readonly porPagina = signal(25);
  readonly total = signal(0);
  readonly carregando = signal(false);
  readonly processando = signal(false);
  readonly mensalidades = signal<MensalidadeDto[]>([]);

  /** Últimas 12 competências para o seletor. */
  readonly competencias = computed(() => {
    const atual = competenciaDe(new Date());
    return Array.from({ length: 13 }, (_, i) => somarMesesCompetencia(atual, 1 - i));
  });

  readonly totais = computed(() => {
    const lista = this.mensalidades();
    const soma = (fn: (m: MensalidadeDto) => boolean) =>
      lista.filter(fn).reduce((t, m) => t + m.valorCentavos, 0);
    return {
      pago: soma((m) => m.status === 'PAGA'),
      aberto: soma((m) => m.status === 'ABERTA'),
      vencido: soma((m) => m.status === 'VENCIDA'),
    };
  });

  constructor() {
    void this.carregar();
    this.busca.valueChanges.pipe(debounceTime(350), takeUntilDestroyed()).subscribe(() => {
      this.pagina.set(1);
      void this.carregar();
    });
  }

  rotuloCompetencia(valor: string): string {
    return competenciaLegivel(valor);
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      const resposta = await firstValueFrom(
        this.api.mensalidades({
          competencia: this.competencia() || undefined,
          status: this.status() || undefined,
          busca: this.busca.value.trim() || undefined,
          pagina: this.pagina(),
          porPagina: this.porPagina(),
        }),
      );
      this.mensalidades.set(resposta.itens);
      this.total.set(resposta.total);
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível carregar as mensalidades.');
    } finally {
      this.carregando.set(false);
    }
  }

  aoFiltrar(): void {
    this.pagina.set(1);
    void this.carregar();
  }

  aoPaginar(evento: PageEvent): void {
    this.pagina.set(evento.pageIndex + 1);
    this.porPagina.set(evento.pageSize);
    void this.carregar();
  }

  /** Cria as cobranças da competência para todas as matrículas ativas. */
  async gerarCompetencia(): Promise<void> {
    const ref = this.dialog.open(ConfirmacaoDialog, {
      data: {
        titulo: `Gerar mensalidades de ${competenciaLegivel(this.competencia())}?`,
        mensagem:
          'Uma cobrança é criada para cada matrícula ativa. Quem já tem mensalidade nesta competência é ignorado — a operação pode ser repetida sem duplicar.',
        confirmar: 'Gerar cobranças',
        icone: 'receipt_long',
      },
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;

    this.processando.set(true);
    try {
      const r = await firstValueFrom(this.api.gerarMensalidades(this.competencia()));
      this.aviso.sucesso(`${r.geradas} mensalidade(s) gerada(s), ${r.ignoradas} ignorada(s).`);
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível gerar as mensalidades.');
    } finally {
      this.processando.set(false);
    }
  }

  async marcarVencidas(): Promise<void> {
    this.processando.set(true);
    try {
      const r = await firstValueFrom(this.api.marcarVencidas());
      this.aviso.sucesso(
        r.atualizadas > 0
          ? `${r.atualizadas} mensalidade(s) marcada(s) como vencida(s).`
          : 'Nenhuma mensalidade venceu desde a última verificação.',
      );
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível atualizar os vencimentos.');
    } finally {
      this.processando.set(false);
    }
  }

  async receber(mensalidade: MensalidadeDto): Promise<void> {
    const ref = this.dialog.open(RegistrarPagamentoDialog, { data: { mensalidade } });
    if (await firstValueFrom(ref.afterClosed())) await this.carregar();
  }

  async cancelar(mensalidade: MensalidadeDto): Promise<void> {
    const ref = this.dialog.open(ConfirmacaoDialog, {
      data: {
        titulo: 'Cancelar cobrança?',
        mensagem: `A mensalidade de ${competenciaLegivel(mensalidade.competencia)} deixa de ser cobrada. Isso não pode ser desfeito.`,
        confirmar: 'Cancelar cobrança',
        cancelar: 'Voltar',
        destrutivo: true,
        icone: 'block',
      },
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;

    try {
      await firstValueFrom(this.api.cancelarMensalidade(mensalidade.id));
      this.aviso.sucesso('Cobrança cancelada.');
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível cancelar a cobrança.');
    }
  }

  async estornar(mensalidade: MensalidadeDto): Promise<void> {
    const pagamento = mensalidade.pagamentos[0];
    if (!pagamento) return;

    const ref = this.dialog.open(ConfirmacaoDialog, {
      data: {
        titulo: 'Estornar pagamento?',
        mensagem: 'A mensalidade volta a ficar em aberto e o estorno é registrado no histórico.',
        confirmar: 'Estornar',
        destrutivo: true,
        icone: 'undo',
      },
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;

    try {
      await firstValueFrom(this.api.estornarPagamento(pagamento.id));
      this.aviso.sucesso('Pagamento estornado.');
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível estornar o pagamento.');
    }
  }
}
