import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, firstValueFrom } from 'rxjs';
import type { AlunoDto, ModalidadeDto, StatusAluno } from '@almativa/shared';
import { AlunosApi } from '../../../core/api/alunos.api';
import { CatalogoApi } from '../../../core/api/catalogo.api';
import { AvisoService } from '../../../core/ui/aviso.service';
import { ConfirmacaoDialog } from '../../../core/ui/confirmacao.dialog';
import { ROTULO_STATUS_ALUNO } from '../../../core/ui/rotulos';
import { Selo } from '../../../shared/selo/selo';
import { EstadoVazio } from '../../../shared/estado-vazio/estado-vazio';
import { IniciaisPipe, TelefonePipe } from '../../../core/pipes/formato.pipes';
import { FormAlunoDialog } from '../form-aluno.dialog';
import { SenhaProvisoriaDialog } from '../senha-provisoria.dialog';

@Component({
  selector: 'app-lista-alunos',
  imports: [
    RouterLink,
    DatePipe,
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
    IniciaisPipe,
    TelefonePipe,
  ],
  templateUrl: './lista-alunos.html',
  styleUrl: './lista-alunos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListaAlunos {
  private readonly api = inject(AlunosApi);
  private readonly catalogo = inject(CatalogoApi);
  private readonly dialog = inject(MatDialog);
  private readonly aviso = inject(AvisoService);

  readonly colunas = ['aluno', 'contato', 'planos', 'status', 'acoes'];
  readonly rotulos = ROTULO_STATUS_ALUNO;

  readonly busca = new FormControl('', { nonNullable: true });
  readonly status = signal<StatusAluno | ''>('');
  readonly modalidadeId = signal<string>('');
  readonly somenteInadimplentes = signal(false);

  readonly pagina = signal(1);
  readonly porPagina = signal(20);
  readonly total = signal(0);
  readonly carregando = signal(false);
  readonly alunos = signal<AlunoDto[]>([]);

  readonly modalidades = toSignal(this.catalogo.modalidades(true), {
    initialValue: [] as ModalidadeDto[],
  });

  constructor() {
    void this.carregar();
    // Recarrega quando o texto de busca estabiliza.
    this.busca.valueChanges
      .pipe(debounceTime(350), takeUntilDestroyed())
      .subscribe(() => {
        this.pagina.set(1);
        void this.carregar();
      });
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      const resposta = await firstValueFrom(
        this.api.listar({
          busca: this.busca.value.trim() || undefined,
          status: this.status() || undefined,
          modalidadeId: this.modalidadeId() || undefined,
          inadimplentes: this.somenteInadimplentes() || undefined,
          pagina: this.pagina(),
          porPagina: this.porPagina(),
        }),
      );
      this.alunos.set(resposta.itens);
      this.total.set(resposta.total);
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível carregar os alunos.');
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

  limparFiltros(): void {
    this.busca.setValue('', { emitEvent: false });
    this.status.set('');
    this.modalidadeId.set('');
    this.somenteInadimplentes.set(false);
    this.aoFiltrar();
  }

  planosDo(aluno: AlunoDto): string {
    const ativas = aluno.matriculas.filter((m) => m.status === 'ATIVA');
    if (ativas.length === 0) return 'sem matrícula ativa';
    return ativas.map((m) => m.plano.nome).join(', ');
  }

  async novoAluno(): Promise<void> {
    const ref = this.dialog.open(FormAlunoDialog, { autoFocus: 'first-tabbable' });
    const resultado = await firstValueFrom(ref.afterClosed());
    if (!resultado) return;

    if (resultado.senhaProvisoria) {
      this.dialog.open(SenhaProvisoriaDialog, {
        data: { email: resultado.aluno.email, senha: resultado.senhaProvisoria },
      });
    }
    await this.carregar();
  }

  async editar(aluno: AlunoDto, evento: Event): Promise<void> {
    evento.stopPropagation();
    const ref = this.dialog.open(FormAlunoDialog, { data: { aluno } });
    if (await firstValueFrom(ref.afterClosed())) await this.carregar();
  }

  async criarAcesso(aluno: AlunoDto, evento: Event): Promise<void> {
    evento.stopPropagation();
    if (!aluno.email) {
      this.aviso.erro(null, 'Cadastre um e-mail para o aluno antes de criar o acesso.');
      return;
    }
    try {
      const resultado = await firstValueFrom(this.api.criarAcesso(aluno.id, aluno.email));
      this.dialog.open(SenhaProvisoriaDialog, {
        data: { email: resultado.email, senha: resultado.senhaProvisoria },
      });
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível criar o acesso.');
    }
  }

  async redefinirSenha(aluno: AlunoDto, evento: Event): Promise<void> {
    evento.stopPropagation();
    try {
      const resultado = await firstValueFrom(this.api.redefinirSenha(aluno.id));
      this.dialog.open(SenhaProvisoriaDialog, {
        data: { email: resultado.email, senha: resultado.senhaProvisoria },
      });
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível redefinir a senha.');
    }
  }

  async inativar(aluno: AlunoDto, evento: Event): Promise<void> {
    evento.stopPropagation();
    const ref = this.dialog.open(ConfirmacaoDialog, {
      data: {
        titulo: `Inativar ${aluno.nome}?`,
        mensagem:
          'As matrículas ativas são canceladas e o acesso é bloqueado. O histórico financeiro é preservado.',
        confirmar: 'Inativar',
        destrutivo: true,
        icone: 'person_off',
      },
    });

    if (!(await firstValueFrom(ref.afterClosed()))) return;

    try {
      await firstValueFrom(this.api.remover(aluno.id));
      this.aviso.sucesso('Aluno inativado.');
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível inativar o aluno.');
    }
  }
}
