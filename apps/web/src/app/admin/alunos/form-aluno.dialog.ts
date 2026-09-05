import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { cpfValido, type AlunoDto } from '@almativa/shared';
import { AlunosApi } from '../../core/api/alunos.api';
import { AvisoService } from '../../core/ui/aviso.service';

export interface DadosFormAluno {
  aluno?: AlunoDto;
}

export interface ResultadoFormAluno {
  aluno: AlunoDto;
  senhaProvisoria?: string;
}

/** Valida o CPF só quando algo foi digitado — o campo é opcional. */
function validadorCpf(controle: { value: string | null }): Record<string, boolean> | null {
  const valor = (controle.value ?? '').trim();
  if (!valor) return null;
  return cpfValido(valor) ? null : { cpf: true };
}

@Component({
  selector: 'app-form-aluno',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatIconModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './form-aluno.dialog.html',
  styleUrl: './form-aluno.dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormAlunoDialog {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AlunosApi);
  private readonly aviso = inject(AvisoService);

  readonly ref = inject<MatDialogRef<FormAlunoDialog, ResultadoFormAluno>>(MatDialogRef);
  readonly dados = inject<DadosFormAluno>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  readonly editando = Boolean(this.dados.aluno);
  readonly salvando = signal(false);

  readonly form = this.fb.nonNullable.group({
    nome: [this.dados.aluno?.nome ?? '', [Validators.required, Validators.minLength(3)]],
    email: [this.dados.aluno?.email ?? '', [Validators.email]],
    telefone: [this.dados.aluno?.telefone ?? ''],
    cpf: [this.dados.aluno?.cpf ?? '', [validadorCpf]],
    dataNascimento: [
      this.dados.aluno?.dataNascimento ? new Date(`${this.dados.aluno.dataNascimento}T12:00:00`) : null as Date | null,
    ],
    status: [this.dados.aluno?.status ?? 'ATIVO'],
    cidade: [this.dados.aluno?.cidade ?? ''],
    uf: [this.dados.aluno?.uf ?? ''],
    cep: [this.dados.aluno?.cep ?? ''],
    logradouro: [this.dados.aluno?.logradouro ?? ''],
    numero: [this.dados.aluno?.numero ?? ''],
    bairro: [this.dados.aluno?.bairro ?? ''],
    contatoEmergenciaNome: [this.dados.aluno?.contatoEmergenciaNome ?? ''],
    contatoEmergenciaTelefone: [this.dados.aluno?.contatoEmergenciaTelefone ?? ''],
    observacoesMedicas: [this.dados.aluno?.observacoesMedicas ?? ''],
    objetivos: [this.dados.aluno?.objetivos ?? ''],
    criarAcesso: [false],
  });

  /** Envia apenas o que foi preenchido; strings vazias viram null. */
  private montarPayload(): Record<string, unknown> {
    const v = this.form.getRawValue();
    const texto = (valor: string) => (valor.trim() === '' ? null : valor.trim());

    return {
      nome: v.nome.trim(),
      email: texto(v.email),
      telefone: texto(v.telefone),
      cpf: texto(v.cpf),
      dataNascimento: v.dataNascimento ? isoDe(v.dataNascimento) : null,
      status: v.status,
      cidade: texto(v.cidade),
      uf: texto(v.uf)?.toUpperCase() ?? null,
      cep: texto(v.cep),
      logradouro: texto(v.logradouro),
      numero: texto(v.numero),
      bairro: texto(v.bairro),
      contatoEmergenciaNome: texto(v.contatoEmergenciaNome),
      contatoEmergenciaTelefone: texto(v.contatoEmergenciaTelefone),
      observacoesMedicas: texto(v.observacoesMedicas),
      objetivos: texto(v.objetivos),
    };
  }

  async salvar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.montarPayload();

    if (!this.editando && this.form.getRawValue().criarAcesso && !payload['email']) {
      this.aviso.erro(null, 'Para criar o acesso do aluno é preciso informar um e-mail.');
      return;
    }

    this.salvando.set(true);
    try {
      if (this.editando) {
        const aluno = await firstValueFrom(this.api.atualizar(this.dados.aluno!.id, payload));
        this.aviso.sucesso('Cadastro atualizado.');
        this.ref.close({ aluno });
      } else {
        const resultado = await firstValueFrom(
          this.api.criar({ ...payload, criarAcesso: this.form.getRawValue().criarAcesso }),
        );
        this.aviso.sucesso('Aluno cadastrado.');
        this.ref.close(resultado);
      }
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível salvar o cadastro.');
    } finally {
      this.salvando.set(false);
    }
  }
}

function isoDe(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(
    data.getDate(),
  ).padStart(2, '0')}`;
}
