import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** Mostra a senha provisória uma única vez, para a recepção repassar ao aluno. */
@Component({
  selector: 'app-senha-provisoria',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title><mat-icon>key</mat-icon> Acesso criado</h2>

    <mat-dialog-content>
      <p class="aviso">
        Anote agora — esta senha não é exibida outra vez. O aluno vai trocá-la no primeiro acesso.
      </p>

      <div class="credencial">
        <span class="credencial__rotulo">E-mail</span>
        <code>{{ dados.email }}</code>
      </div>

      <div class="credencial">
        <span class="credencial__rotulo">Senha provisória</span>
        <code class="credencial__senha">{{ dados.senha }}</code>
      </div>

      <button matButton="outlined" (click)="copiar()">
        <mat-icon>{{ copiado() ? 'check' : 'content_copy' }}</mat-icon>
        {{ copiado() ? 'Copiado!' : 'Copiar credenciais' }}
      </button>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton="filled" mat-dialog-close>Entendi</button>
    </mat-dialog-actions>
  `,
  styleUrl: './senha-provisoria.dialog.scss',
})
export class SenhaProvisoriaDialog {
  readonly dados = inject<{ email: string; senha: string }>(MAT_DIALOG_DATA);
  readonly copiado = signal(false);

  async copiar(): Promise<void> {
    const texto = `E-mail: ${this.dados.email}\nSenha: ${this.dados.senha}`;
    try {
      await navigator.clipboard.writeText(texto);
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2500);
    } catch {
      // Sem permissão de área de transferência: o usuário copia manualmente.
    }
  }
}
