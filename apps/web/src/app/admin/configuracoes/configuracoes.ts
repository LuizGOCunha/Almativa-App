import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import {
  DIAS_SEMANA,
  paraCentavos,
  type InstrutorDto,
  type ModalidadeDto,
  type PlanoDto,
  type TurmaDto,
} from '@almativa/shared';
import { CatalogoApi } from '../../core/api/catalogo.api';
import { AvisoService } from '../../core/ui/aviso.service';
import { ConfirmacaoDialog } from '../../core/ui/confirmacao.dialog';
import { EstadoVazio } from '../../shared/estado-vazio/estado-vazio';
import { DiaSemanaPipe, MoedaPipe } from '../../core/pipes/formato.pipes';

/**
 * Catálogo da academia: modalidades, planos, turmas e instrutores.
 * Cada aba tem um formulário lateral que serve para criar e editar.
 */
@Component({
  selector: 'app-configuracoes',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatProgressBarModule,
    EstadoVazio,
    DiaSemanaPipe,
    MoedaPipe,
  ],
  templateUrl: './configuracoes.html',
  styleUrl: './configuracoes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Configuracoes {
  private readonly api = inject(CatalogoApi);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly aviso = inject(AvisoService);

  readonly dias = DIAS_SEMANA;
  readonly carregando = signal(false);

  readonly modalidades = signal<ModalidadeDto[]>([]);
  readonly planos = signal<PlanoDto[]>([]);
  readonly turmas = signal<TurmaDto[]>([]);
  readonly instrutores = signal<InstrutorDto[]>([]);

  /** id em edição por aba; null = criando. */
  readonly editandoModalidade = signal<string | null>(null);
  readonly editandoPlano = signal<string | null>(null);
  readonly editandoTurma = signal<string | null>(null);
  readonly editandoInstrutor = signal<string | null>(null);

  readonly formModalidade = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.minLength(2)]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    descricao: [''],
    cor: ['#1E4D3B', [Validators.required, Validators.pattern(/^#[0-9a-fA-F]{6}$/)]],
    icone: [''],
    ativo: [true],
  });

  readonly formPlano = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.minLength(2)]],
    modalidadeId: [''],
    valor: ['', Validators.required],
    periodicidade: ['MENSAL'],
    aulasPorSemana: [null as number | null],
    diaVencimentoPadrao: [10],
    descricao: [''],
    ativo: [true],
  });

  readonly formTurma = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.minLength(2)]],
    modalidadeId: ['', Validators.required],
    instrutorId: [''],
    diaSemana: [1, Validators.required],
    horaInicio: ['07:00', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
    horaFim: ['08:00', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
    capacidade: [12, [Validators.required, Validators.min(1)]],
    sala: [''],
    nivel: [''],
    ativo: [true],
  });

  readonly formInstrutor = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', Validators.email],
    telefone: [''],
    registroProfissional: [''],
    bio: [''],
    modalidadeIds: [[] as string[]],
    ativo: [true],
  });

  /** Turmas agrupadas por dia, para a grade não virar uma lista solta. */
  readonly turmasPorDia = computed(() =>
    this.dias
      .map((dia) => ({
        ...dia,
        turmas: this.turmas()
          .filter((t) => t.diaSemana === dia.valor)
          .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
      }))
      .filter((d) => d.turmas.length > 0),
  );

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      const [modalidades, planos, turmas, instrutores] = await Promise.all([
        firstValueFrom(this.api.modalidades()),
        firstValueFrom(this.api.planos()),
        firstValueFrom(this.api.turmas()),
        firstValueFrom(this.api.instrutores()),
      ]);
      this.modalidades.set(modalidades);
      this.planos.set(planos);
      this.turmas.set(turmas);
      this.instrutores.set(instrutores);
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível carregar o catálogo.');
    } finally {
      this.carregando.set(false);
    }
  }

  private async confirmar(titulo: string, mensagem: string): Promise<boolean> {
    const ref = this.dialog.open(ConfirmacaoDialog, {
      data: { titulo, mensagem, confirmar: 'Confirmar', destrutivo: true },
    });
    return Boolean(await firstValueFrom(ref.afterClosed()));
  }

  /* ----------------------------- Modalidades ---------------------------- */

  /** Sugere o slug a partir do nome enquanto o admin digita. */
  sugerirSlug(): void {
    if (this.editandoModalidade()) return;
    const slug = this.formModalidade.controls.nome.value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    this.formModalidade.controls.slug.setValue(slug);
  }

  editarModalidade(m: ModalidadeDto): void {
    this.editandoModalidade.set(m.id);
    this.formModalidade.setValue({
      nome: m.nome,
      slug: m.slug,
      descricao: m.descricao ?? '',
      cor: m.cor,
      icone: m.icone ?? '',
      ativo: m.ativo,
    });
  }

  cancelarModalidade(): void {
    this.editandoModalidade.set(null);
    this.formModalidade.reset({ cor: '#1E4D3B', ativo: true });
  }

  async salvarModalidade(): Promise<void> {
    if (this.formModalidade.invalid) {
      this.formModalidade.markAllAsTouched();
      return;
    }

    const v = this.formModalidade.getRawValue();
    const payload = {
      nome: v.nome,
      slug: v.slug,
      descricao: v.descricao.trim() || null,
      cor: v.cor,
      icone: v.icone.trim() || null,
      ativo: v.ativo,
    };

    try {
      const id = this.editandoModalidade();
      if (id) {
        await firstValueFrom(this.api.atualizarModalidade(id, payload));
      } else {
        await firstValueFrom(this.api.criarModalidade(payload));
      }
      this.aviso.sucesso(id ? 'Modalidade atualizada.' : 'Modalidade criada.');
      this.cancelarModalidade();
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível salvar a modalidade.');
    }
  }

  async removerModalidade(m: ModalidadeDto): Promise<void> {
    if (!(await this.confirmar(`Excluir ${m.nome}?`, 'Só é possível excluir modalidades sem turmas.')))
      return;

    try {
      await firstValueFrom(this.api.removerModalidade(m.id));
      this.aviso.sucesso('Modalidade excluída.');
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro);
    }
  }

  /* -------------------------------- Planos ------------------------------ */

  editarPlano(p: PlanoDto): void {
    this.editandoPlano.set(p.id);
    this.formPlano.setValue({
      nome: p.nome,
      modalidadeId: p.modalidade?.id ?? '',
      valor: (p.valorCentavos / 100).toFixed(2).replace('.', ','),
      periodicidade: p.periodicidade,
      aulasPorSemana: p.aulasPorSemana,
      diaVencimentoPadrao: p.diaVencimentoPadrao,
      descricao: p.descricao ?? '',
      ativo: p.ativo,
    });
  }

  cancelarPlano(): void {
    this.editandoPlano.set(null);
    this.formPlano.reset({ periodicidade: 'MENSAL', diaVencimentoPadrao: 10, ativo: true });
  }

  async salvarPlano(): Promise<void> {
    if (this.formPlano.invalid) {
      this.formPlano.markAllAsTouched();
      return;
    }

    const v = this.formPlano.getRawValue();
    const centavos = paraCentavos(v.valor);
    if (centavos <= 0) {
      this.aviso.erro(null, 'Informe um valor maior que zero.');
      return;
    }

    const payload = {
      nome: v.nome,
      modalidadeId: v.modalidadeId || null,
      valorCentavos: centavos,
      periodicidade: v.periodicidade,
      aulasPorSemana: v.aulasPorSemana,
      diaVencimentoPadrao: v.diaVencimentoPadrao,
      descricao: v.descricao.trim() || null,
      ativo: v.ativo,
    };

    try {
      const id = this.editandoPlano();
      if (id) {
        await firstValueFrom(this.api.atualizarPlano(id, payload));
      } else {
        await firstValueFrom(this.api.criarPlano(payload));
      }
      this.aviso.sucesso(id ? 'Plano atualizado.' : 'Plano criado.');
      this.cancelarPlano();
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível salvar o plano.');
    }
  }

  async removerPlano(p: PlanoDto): Promise<void> {
    if (
      !(await this.confirmar(
        `Desativar ${p.nome}?`,
        'O plano deixa de aparecer para novas matrículas. As matrículas atuais continuam.',
      ))
    )
      return;

    try {
      await firstValueFrom(this.api.removerPlano(p.id));
      this.aviso.sucesso('Plano desativado.');
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro);
    }
  }

  /* -------------------------------- Turmas ------------------------------ */

  editarTurma(t: TurmaDto): void {
    this.editandoTurma.set(t.id);
    this.formTurma.setValue({
      nome: t.nome,
      modalidadeId: t.modalidade.id,
      instrutorId: t.instrutor?.id ?? '',
      diaSemana: t.diaSemana,
      horaInicio: t.horaInicio,
      horaFim: t.horaFim,
      capacidade: t.capacidade,
      sala: t.sala ?? '',
      nivel: t.nivel ?? '',
      ativo: t.ativo,
    });
  }

  cancelarTurma(): void {
    this.editandoTurma.set(null);
    this.formTurma.reset({
      diaSemana: 1,
      horaInicio: '07:00',
      horaFim: '08:00',
      capacidade: 12,
      ativo: true,
    });
  }

  async salvarTurma(): Promise<void> {
    if (this.formTurma.invalid) {
      this.formTurma.markAllAsTouched();
      return;
    }

    const v = this.formTurma.getRawValue();
    if (v.horaFim <= v.horaInicio) {
      this.aviso.erro(null, 'O horário de término deve ser depois do início.');
      return;
    }

    const payload = {
      nome: v.nome,
      modalidadeId: v.modalidadeId,
      instrutorId: v.instrutorId || null,
      diaSemana: v.diaSemana,
      horaInicio: v.horaInicio,
      horaFim: v.horaFim,
      capacidade: v.capacidade,
      sala: v.sala.trim() || null,
      nivel: v.nivel.trim() || null,
      ativo: v.ativo,
    };

    try {
      const id = this.editandoTurma();
      if (id) {
        await firstValueFrom(this.api.atualizarTurma(id, payload));
      } else {
        await firstValueFrom(this.api.criarTurma(payload));
      }
      this.aviso.sucesso(id ? 'Turma atualizada.' : 'Turma criada.');
      this.cancelarTurma();
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível salvar a turma.');
    }
  }

  async removerTurma(t: TurmaDto): Promise<void> {
    if (
      !(await this.confirmar(
        `Desativar ${t.nome}?`,
        'As aulas futuras ainda não realizadas são canceladas e os alunos com check-in são avisados.',
      ))
    )
      return;

    try {
      await firstValueFrom(this.api.removerTurma(t.id));
      this.aviso.sucesso('Turma desativada.');
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro);
    }
  }

  /* ----------------------------- Instrutores ---------------------------- */

  editarInstrutor(i: InstrutorDto): void {
    this.editandoInstrutor.set(i.id);
    this.formInstrutor.setValue({
      nome: i.nome,
      email: i.email ?? '',
      telefone: i.telefone ?? '',
      registroProfissional: i.registroProfissional ?? '',
      bio: i.bio ?? '',
      modalidadeIds: i.modalidades.map((m) => m.id),
      ativo: i.ativo,
    });
  }

  cancelarInstrutor(): void {
    this.editandoInstrutor.set(null);
    this.formInstrutor.reset({ modalidadeIds: [], ativo: true });
  }

  async salvarInstrutor(): Promise<void> {
    if (this.formInstrutor.invalid) {
      this.formInstrutor.markAllAsTouched();
      return;
    }

    const v = this.formInstrutor.getRawValue();
    const payload = {
      nome: v.nome,
      email: v.email.trim() || null,
      telefone: v.telefone.trim() || null,
      registroProfissional: v.registroProfissional.trim() || null,
      bio: v.bio.trim() || null,
      modalidadeIds: v.modalidadeIds,
      ativo: v.ativo,
    };

    try {
      const id = this.editandoInstrutor();
      if (id) {
        await firstValueFrom(this.api.atualizarInstrutor(id, payload));
      } else {
        await firstValueFrom(this.api.criarInstrutor(payload));
      }
      this.aviso.sucesso(id ? 'Instrutor atualizado.' : 'Instrutor cadastrado.');
      this.cancelarInstrutor();
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível salvar o instrutor.');
    }
  }

  async removerInstrutor(i: InstrutorDto): Promise<void> {
    if (!(await this.confirmar(`Desativar ${i.nome}?`, 'O instrutor deixa de aparecer no site e na grade.')))
      return;

    try {
      await firstValueFrom(this.api.removerInstrutor(i.id));
      this.aviso.sucesso('Instrutor desativado.');
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro);
    }
  }
}
