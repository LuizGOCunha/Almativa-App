import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { firstValueFrom } from 'rxjs';
import type { AlunoDto } from '@almativa/shared';
import { AlunoAreaApi } from '../../core/api/aluno-area.api';
import { AuthService } from '../../core/auth/auth.service';
import { AvisoService } from '../../core/ui/aviso.service';
import { ROTULO_STATUS_MATRICULA } from '../../core/ui/rotulos';
import { Selo } from '../../shared/selo/selo';
import { MoedaPipe } from '../../core/pipes/formato.pipes';

@Component({
  selector: 'app-perfil-aluno',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    Selo,
    MoedaPipe,
  ],
  templateUrl: './perfil-aluno.html',
  styleUrl: './perfil-aluno.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerfilAluno {
  private readonly api = inject(AlunoAreaApi);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly aviso = inject(AvisoService);

  readonly rotulosMatricula = ROTULO_STATUS_MATRICULA;

  readonly aluno = signal<AlunoDto | null>(null);
  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly trocandoSenha = signal(false);
  readonly mostrarTrocaSenha = signal(false);

  /** Só os campos que o próprio aluno pode alterar — nome e CPF ficam com a recepção. */
  readonly form = this.fb.nonNullable.group({
    telefone: [''],
    cep: [''],
    logradouro: [''],
    numero: [''],
    complemento: [''],
    bairro: [''],
    cidade: [''],
    uf: [''],
    contatoEmergenciaNome: [''],
    contatoEmergenciaTelefone: [''],
    observacoesMedicas: [''],
    objetivos: [''],
  });

  readonly formSenha = this.fb.nonNullable.group({
    senhaAtual: ['', [Validators.required, Validators.minLength(6)]],
    novaSenha: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      const aluno = await firstValueFrom(this.api.perfil());
      this.aluno.set(aluno);
      this.form.patchValue({
        telefone: aluno.telefone ?? '',
        cep: aluno.cep ?? '',
        logradouro: aluno.logradouro ?? '',
        numero: aluno.numero ?? '',
        complemento: aluno.complemento ?? '',
        bairro: aluno.bairro ?? '',
        cidade: aluno.cidade ?? '',
        uf: aluno.uf ?? '',
        contatoEmergenciaNome: aluno.contatoEmergenciaNome ?? '',
        contatoEmergenciaTelefone: aluno.contatoEmergenciaTelefone ?? '',
        observacoesMedicas: aluno.observacoesMedicas ?? '',
        objetivos: aluno.objetivos ?? '',
      });
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível carregar seus dados.');
    } finally {
      this.carregando.set(false);
    }
  }

  async salvar(): Promise<void> {
    this.salvando.set(true);
    try {
      const valores = this.form.getRawValue();
      const payload = Object.fromEntries(
        Object.entries(valores).map(([chave, valor]) => [chave, valor.trim() || null]),
      );
      this.aluno.set(await firstValueFrom(this.api.atualizarPerfil(payload)));
      this.aviso.sucesso('Dados atualizados.');
      this.form.markAsPristine();
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível salvar seus dados.');
    } finally {
      this.salvando.set(false);
    }
  }

  async trocarSenha(): Promise<void> {
    if (this.formSenha.invalid) {
      this.formSenha.markAllAsTouched();
      return;
    }

    this.trocandoSenha.set(true);
    try {
      const { senhaAtual, novaSenha } = this.formSenha.getRawValue();
      await this.auth.trocarSenha(senhaAtual, novaSenha);
      this.aviso.sucesso('Senha alterada. Suas outras sessões foram encerradas.');
      this.formSenha.reset();
      this.mostrarTrocaSenha.set(false);
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível alterar a senha.');
    } finally {
      this.trocandoSenha.set(false);
    }
  }
}
