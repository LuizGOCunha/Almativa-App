import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface DadosConfirmacao {
  titulo: string;
  mensagem: string;
  confirmar?: string;
  cancelar?: string;
  destrutivo?: boolean;
  icone?: string;
}

@Component({
  selector: 'app-confirmacao',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      <mat-icon [class.destrutivo]="dados.destrutivo">{{ dados.icone ?? 'help' }}</mat-icon>
      {{ dados.titulo }}
    </h2>
    <mat-dialog-content>
      <p>{{ dados.mensagem }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton (click)="ref.close(false)">{{ dados.cancelar ?? 'Cancelar' }}</button>
      <button
        matButton="filled"
        [color]="dados.destrutivo ? 'warn' : 'primary'"
        (click)="ref.close(true)"
      >
        {{ dados.confirmar ?? 'Confirmar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    h2 {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    mat-icon.destrutivo {
      color: var(--alm-erro);
    }
    p {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      line-height: 1.6;
    }
  `,
})
export class ConfirmacaoDialog {
  readonly ref = inject<MatDialogRef<ConfirmacaoDialog, boolean>>(MatDialogRef);
  readonly dados = inject<DadosConfirmacao>(MAT_DIALOG_DATA);
}
