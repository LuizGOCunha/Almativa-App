import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, of } from 'rxjs';
import type {
  CampanhaDto,
  ModalidadeDto,
  NotificacaoDto,
  SegmentoCampanha,
} from '@almativa/shared';
import { ComunicacaoApi } from '../../core/api/comunicacao.api';
import { CatalogoApi } from '../../core/api/catalogo.api';
import { AvisoService } from '../../core/ui/aviso.service';
import { ConfirmacaoDialog } from '../../core/ui/confirmacao.dialog';
import { ICONE_NOTIFICACAO, ROTULO_STATUS_CAMPANHA } from '../../core/ui/rotulos';
import { Selo } from '../../shared/selo/selo';
import { EstadoVazio } from '../../shared/estado-vazio/estado-vazio';
import { QuandoPipe } from '../../core/pipes/formato.pipes';

/**
 * Central de comunicação: avisos que chegam ao painel (vencimentos, sistema)
 * e campanhas segmentadas para a área do aluno.
 */
@Component({
  selector: 'app-comunicacao',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatProgressBarModule,
    Selo,
    EstadoVazio,
    QuandoPipe,
  ],
  templateUrl: './comunicacao.html',
  styleUrl: './comunicacao.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Comunicacao {
  private readonly api = inject(ComunicacaoApi);
  private readonly catalogo = inject(CatalogoApi);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly aviso = inject(AvisoService);

  readonly icones = ICONE_NOTIFICACAO;
  /** Placeholder do template de mensagem, fora do parser de interpolação. */
  readonly marcadorNome = '{{nome}}';
  readonly exemploMensagem = 'Oi {{nome}}, faz um tempo que a gente não te vê por aqui…';
  readonly rotulosCampanha = ROTULO_STATUS_CAMPANHA;

  readonly notificacoes = signal<NotificacaoDto[]>([]);
  readonly campanhas = signal<CampanhaDto[]>([]);
  readonly carregando = signal(false);
  readonly salvando = signal(false);
  readonly previa = signal<{ total: number; amostra: { id: string; nome: string }[] } | null>(null);
  readonly somenteNaoLidas = signal(false);

  readonly modalidades = toSignal(
    this.catalogo.modalidades(true).pipe(catchError(() => of([] as ModalidadeDto[]))),
    { initialValue: [] as ModalidadeDto[] },
  );

  readonly form = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.minLength(3)]],
    mensagemTitulo: ['', [Validators.required, Validators.minLength(3)]],
    mensagemCorpo: ['', [Validators.required, Validators.minLength(5)]],
    statusAluno: [['ATIVO'] as string[]],
    modalidadeSlugs: [[] as string[]],
    comMensalidadeVencida: [false],
    semFrequenciaDesdeDias: [null as number | null],
  });

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      const [notificacoes, campanhas] = await Promise.all([
        firstValueFrom(
          this.api.notificacoes({ apenasNaoLidas: this.somenteNaoLidas(), porPagina: 50 }),
        ),
        firstValueFrom(this.api.campanhas()),
      ]);
      this.notificacoes.set(notificacoes.itens);
      this.campanhas.set(campanhas);
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível carregar a comunicação.');
    } finally {
      this.carregando.set(false);
    }
  }

  private segmentoAtual(): SegmentoCampanha {
    const v = this.form.getRawValue();
    return {
      statusAluno: v.statusAluno.length > 0 ? (v.statusAluno as SegmentoCampanha['statusAluno']) : undefined,
      modalidadeSlugs: v.modalidadeSlugs.length > 0 ? v.modalidadeSlugs : undefined,
      comMensalidadeVencida: v.comMensalidadeVencida || undefined,
      semFrequenciaDesdeDias: v.semFrequenciaDesdeDias ?? undefined,
    };
  }

  async calcularPrevia(): Promise<void> {
    try {
      this.previa.set(await firstValueFrom(this.api.previaSegmento(this.segmentoAtual())));
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível calcular o público.');
    }
  }

  nomesAmostra(amostra: { nome: string }[]): string {
    return amostra
      .slice(0, 3)
      .map((a) => a.nome.split(' ')[0])
      .join(', ');
  }

  async marcarLida(n: NotificacaoDto): Promise<void> {
    if (n.lidaEm) return;
    try {
      await firstValueFrom(this.api.marcarLida(n.id));
      this.notificacoes.update((lista) =>
        lista.map((item) => (item.id === n.id ? { ...item, lidaEm: new Date().toISOString() } : item)),
      );
    } catch (erro) {
      this.aviso.erro(erro);
    }
  }

  async lerTodas(): Promise<void> {
    try {
      const r = await firstValueFrom(this.api.lerTodas());
      this.aviso.sucesso(`${r.atualizadas} aviso(s) marcado(s) como lido(s).`);
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro);
    }
  }

  async criarCampanha(enviarAgora: boolean): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    this.salvando.set(true);

    try {
      const campanha = await firstValueFrom(
        this.api.criarCampanha({
          nome: v.nome,
          descricao: null,
          mensagemTitulo: v.mensagemTitulo,
          mensagemCorpo: v.mensagemCorpo,
          canais: ['APP'],
          segmento: this.segmentoAtual(),
          agendadaPara: null,
        }),
      );

      if (enviarAgora) {
        const r = await firstValueFrom(this.api.enviarCampanha(campanha.id));
        this.aviso.sucesso(`Campanha enviada para ${r.enviados} aluno(s).`);
      } else {
        this.aviso.sucesso('Campanha salva como rascunho.');
      }

      this.form.reset({ statusAluno: ['ATIVO'], modalidadeSlugs: [], comMensalidadeVencida: false });
      this.previa.set(null);
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível criar a campanha.');
    } finally {
      this.salvando.set(false);
    }
  }

  async enviar(campanha: CampanhaDto): Promise<void> {
    const ref = this.dialog.open(ConfirmacaoDialog, {
      data: {
        titulo: `Enviar "${campanha.nome}"?`,
        mensagem: `Cerca de ${campanha.metricas.alcancados} aluno(s) receberão este aviso na área deles. A ação não pode ser desfeita.`,
        confirmar: 'Enviar agora',
        icone: 'send',
      },
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;

    try {
      const r = await firstValueFrom(this.api.enviarCampanha(campanha.id));
      this.aviso.sucesso(`Enviada para ${r.enviados} de ${r.alcancados} aluno(s).`);
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível enviar a campanha.');
    }
  }

  async cancelar(campanha: CampanhaDto): Promise<void> {
    try {
      await firstValueFrom(this.api.cancelarCampanha(campanha.id));
      this.aviso.sucesso('Campanha cancelada.');
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro);
    }
  }
}
