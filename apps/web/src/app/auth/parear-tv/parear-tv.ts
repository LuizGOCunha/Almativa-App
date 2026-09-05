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

/**
 * Tela usada uma única vez em cada TV/tablet da sala. O token de pareamento
 * é gerado pelo admin e fica guardado no dispositivo.
 */
@Component({
  selector: 'app-parear-tv',
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
  templateUrl: './parear-tv.html',
  styleUrl: './parear-tv.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PareaTv {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly enviando = signal(false);
  readonly erro = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    token: ['', [Validators.required, Validators.minLength(20)]],
  });

  async parear(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.erro.set(null);

    try {
      await this.auth.entrarComoTv(this.form.getRawValue().token.trim());
      await this.router.navigate(['/tv']);
    } catch (erro) {
      this.erro.set(mensagemDeErro(erro, 'Token inválido ou expirado.'));
    } finally {
      this.enviando.set(false);
    }
  }
}
