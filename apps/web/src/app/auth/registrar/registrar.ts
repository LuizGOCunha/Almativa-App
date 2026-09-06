import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Role } from '@almativa/shared';
import { AuthService } from '../../core/auth/auth.service';
import { mensagemDeErro } from '../../core/ui/aviso.service';
import { LogoAlmativa } from '../../shared/logo/logo';

@Component({
  selector: 'app-registrar',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    LogoAlmativa,
  ],
  templateUrl: './registrar.html',
  styleUrl: './registrar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Registrar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly enviando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly mostrarSenha = signal(false);

  readonly opcoesPerfil = [
    { valor: Role.ADMIN, label: 'Administrador' },
    { valor: Role.ALUNO, label: 'Aluno' },
  ];

  readonly form = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    senha: ['', [Validators.required, Validators.minLength(8)]],
    role: [Role.ALUNO as Role, Validators.required],
  });

  async registrar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.erro.set(null);

    try {
      const { email, nome, senha, role } = this.form.getRawValue();
      await this.auth.registrar(email, nome, senha, role);
      await this.router.navigateByUrl(this.auth.rotaInicial());
    } catch (erro) {
      this.erro.set(mensagemDeErro(erro, 'Não foi possível registrar o usuário.'));
    } finally {
      this.enviando.set(false);
    }
  }

  obterErroNome(): string | null {
    const controle = this.form.controls.nome;
    if (!controle.touched || !controle.invalid) return null;
    if (controle.errors?.['required']) return 'Nome é obrigatório.';
    if (controle.errors?.['minlength']) return 'Nome precisa ter ao menos 2 caracteres.';
    if (controle.errors?.['maxlength']) return 'Nome não pode ter mais de 120 caracteres.';
    return 'Nome inválido.';
  }

  obterErroSenha(): string | null {
    const controle = this.form.controls.senha;
    if (!controle.touched || !controle.invalid) return null;
    if (controle.errors?.['required']) return 'Senha é obrigatória.';
    if (controle.errors?.['minlength']) return 'Senha precisa ter ao menos 8 caracteres.';
    return 'Senha inválida.';
  }
}
