import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, of } from 'rxjs';
import type { ModalidadeDto } from '@almativa/shared';
import { PublicoApi, type ConfiguracoesSite } from '../../core/api/publico.api';
import { AvisoService } from '../../core/ui/aviso.service';

@Component({
  selector: 'app-contato',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './contato.html',
  styleUrl: './contato.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Contato {
  private readonly api = inject(PublicoApi);
  private readonly fb = inject(FormBuilder);
  private readonly aviso = inject(AvisoService);

  readonly modalidades = toSignal(
    this.api.modalidades().pipe(catchError(() => of([] as ModalidadeDto[]))),
    { initialValue: [] as ModalidadeDto[] },
  );
  readonly config = toSignal(
    this.api.configuracoes().pipe(catchError(() => of({} as ConfiguracoesSite))),
    { initialValue: {} as ConfiguracoesSite },
  );

  readonly enviando = signal(false);
  readonly enviado = signal(false);

  readonly form = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    telefone: ['', [Validators.required, Validators.minLength(10)]],
    modalidadeInteresse: [''],
    mensagem: ['', [Validators.required, Validators.minLength(5)]],
  });

  async enviar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    try {
      const valores = this.form.getRawValue();
      await firstValueFrom(
        this.api.enviarContato({
          ...valores,
          modalidadeInteresse: valores.modalidadeInteresse || null,
        }),
      );
      this.enviado.set(true);
      this.form.reset();
    } catch (erro) {
      this.aviso.erro(erro, 'Não conseguimos enviar sua mensagem.');
    } finally {
      this.enviando.set(false);
    }
  }

  novaMensagem(): void {
    this.enviado.set(false);
  }
}
