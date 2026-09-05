import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/auth/auth.service';
import { mensagemDeErro } from '../../core/ui/aviso.service';
import { LogoAlmativa } from '../../shared/logo/logo';

@Component({
  selector: 'app-entrar',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    LogoAlmativa,
  ],
  templateUrl: './entrar.html',
  styleUrl: './entrar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Entrar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly enviando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly mostrarSenha = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    senha: ['', [Validators.required, Validators.minLength(6)]],
  });

  async entrar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.erro.set(null);

    try {
      const { email, senha } = this.form.getRawValue();
      await this.auth.entrar(email, senha);

      const retorno = new URLSearchParams(location.search).get('retorno');
      await this.router.navigateByUrl(retorno ?? this.auth.rotaInicial());
    } catch (erro) {
      this.erro.set(mensagemDeErro(erro, 'Não foi possível entrar.'));
    } finally {
      this.enviando.set(false);
    }
  }
}
