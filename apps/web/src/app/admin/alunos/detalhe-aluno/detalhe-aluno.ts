import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import type {
  AlunoDto,
  EventoPagamentoDto,
  FrequenciaDto,
  MensalidadeDto,
} from '@almativa/shared';
import { AlunosApi } from '../../../core/api/alunos.api';
import { FinanceiroApi } from '../../../core/api/financeiro.api';
import { AvisoService } from '../../../core/ui/aviso.service';
import { ConfirmacaoDialog } from '../../../core/ui/confirmacao.dialog';
import {
  ROTULO_STATUS_ALUNO,
  ROTULO_STATUS_FREQUENCIA,
  ROTULO_STATUS_MATRICULA,
  ROTULO_STATUS_MENSALIDADE,
} from '../../../core/ui/rotulos';
import { Selo } from '../../../shared/selo/selo';
import { EstadoVazio } from '../../../shared/estado-vazio/estado-vazio';
import {
  CompetenciaPipe,
  IniciaisPipe,
  MoedaPipe,
  TelefonePipe,
} from '../../../core/pipes/formato.pipes';
import { FormAlunoDialog } from '../form-aluno.dialog';
import { FormMatriculaDialog } from '../form-matricula.dialog';
import { RegistrarPagamentoDialog } from '../../financeiro/registrar-pagamento.dialog';

@Component({
  selector: 'app-detalhe-aluno',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatTableModule,
    MatMenuModule,
    MatProgressBarModule,
    Selo,
    EstadoVazio,
    CompetenciaPipe,
    IniciaisPipe,
    MoedaPipe,
    TelefonePipe,
  ],
  templateUrl: './detalhe-aluno.html',
  styleUrl: './detalhe-aluno.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalheAluno {
  /** Vem do parâmetro de rota via withComponentInputBinding(). */
  readonly id = input.required<string>();

  private readonly api = inject(AlunosApi);
  private readonly financeiro = inject(FinanceiroApi);
  private readonly dialog = inject(MatDialog);
  private readonly aviso = inject(AvisoService);

  readonly rotulosAluno = ROTULO_STATUS_ALUNO;
  readonly rotulosMatricula = ROTULO_STATUS_MATRICULA;
  readonly rotulosMensalidade = ROTULO_STATUS_MENSALIDADE;
  readonly rotulosFrequencia = ROTULO_STATUS_FREQUENCIA;

  readonly colunasMensalidade = ['competencia', 'vencimento', 'valor', 'status', 'acoes'];
  readonly colunasFrequencia = ['data', 'turma', 'status'];

  readonly aluno = signal<AlunoDto | null>(null);
  readonly mensalidades = signal<MensalidadeDto[]>([]);
  readonly frequencia = signal<FrequenciaDto[]>([]);
  readonly historico = signal<EventoPagamentoDto[]>([]);
  readonly carregando = signal(true);

  readonly matriculasAtivas = computed(
    () => this.aluno()?.matriculas.filter((m) => m.status === 'ATIVA') ?? [],
  );

  readonly emAberto = computed(() =>
    this.mensalidades().filter((m) => m.status === 'ABERTA' || m.status === 'VENCIDA'),
  );

  readonly totalEmAberto = computed(() =>
    this.emAberto().reduce((soma, m) => soma + m.valorCentavos, 0),
  );

  readonly resumoFrequencia = computed(() => {
    const lista = this.frequencia();
    const presencas = lista.filter((f) => f.status === 'PRESENTE').length;
    return {
      total: lista.length,
      presencas,
      aproveitamento: lista.length > 0 ? Math.round((presencas / lista.length) * 100) : 0,
    };
  });

  constructor() {
    // `id` é um input de rota: recarrega sempre que muda.
    queueMicrotask(() => void this.carregar());
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      const [aluno, mensalidades, frequencia, historico] = await Promise.all([
        firstValueFrom(this.api.obter(this.id())),
        firstValueFrom(this.api.mensalidades(this.id())),
        firstValueFrom(this.api.frequencia(this.id())),
        firstValueFrom(this.financeiro.historicoDoAluno(this.id())),
      ]);
      this.aluno.set(aluno);
      this.mensalidades.set(mensalidades.itens);
      this.frequencia.set(frequencia);
      this.historico.set(historico);
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível carregar a ficha do aluno.');
    } finally {
      this.carregando.set(false);
    }
  }

  async editar(): Promise<void> {
    const ref = this.dialog.open(FormAlunoDialog, { data: { aluno: this.aluno() } });
    if (await firstValueFrom(ref.afterClosed())) await this.carregar();
  }

  async novaMatricula(): Promise<void> {
    const ref = this.dialog.open(FormMatriculaDialog, { data: { alunoId: this.id() } });
    if (await firstValueFrom(ref.afterClosed())) await this.carregar();
  }

  async cancelarMatricula(matriculaId: string, planoNome: string): Promise<void> {
    const ref = this.dialog.open(ConfirmacaoDialog, {
      data: {
        titulo: 'Cancelar matrícula?',
        mensagem: `A matrícula em "${planoNome}" será encerrada e as mensalidades futuras em aberto serão canceladas.`,
        confirmar: 'Cancelar matrícula',
        cancelar: 'Voltar',
        destrutivo: true,
        icone: 'cancel',
      },
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;

    try {
      await firstValueFrom(this.api.cancelarMatricula(matriculaId));
      this.aviso.sucesso('Matrícula cancelada.');
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível cancelar a matrícula.');
    }
  }

  async registrarPagamento(mensalidade: MensalidadeDto): Promise<void> {
    const ref = this.dialog.open(RegistrarPagamentoDialog, { data: { mensalidade } });
    if (await firstValueFrom(ref.afterClosed())) await this.carregar();
  }
}
