import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import {
  competenciaLegivel,
  formatarMoeda,
  paraCentavos,
  type MensalidadeDto,
  type MetodoPagamento,
} from '@almativa/shared';
import { FinanceiroApi } from '../../core/api/financeiro.api';
import { AvisoService } from '../../core/ui/aviso.service';
import { METODOS_PAGAMENTO, ROTULO_METODO } from '../../core/ui/rotulos';

export interface DadosRegistrarPagamento {
  mensalidade: MensalidadeDto;
}

@Component({
  selector: 'app-registrar-pagamento',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Registrar pagamento</h2>

    <mat-dialog-content>
      <div class="resumo">
        <div>
          <span>Aluno</span>
          <strong>{{ mensalidade.aluno?.nome ?? '—' }}</strong>
        </div>
        <div>
          <span>Competência</span>
          <strong>{{ competenciaFormatada }}</strong>
        </div>
        <div>
          <span>Saldo em aberto</span>
          <strong class="destaque">{{ saldoFormatado() }}</strong>
        </div>
      </div>

      <form [formGroup]="form" class="form" novalidate>
        <mat-form-field>
          <mat-label>Valor recebido</mat-label>
          <input matInput formControlName="valor" inputmode="decimal" />
          <span matTextPrefix>R$&nbsp;</span>
          @if (form.controls.valor.touched && form.controls.valor.invalid) {
            <mat-error>Informe um valor maior que zero.</mat-error>
          }
        </mat-form-field>

        <mat-form-field>
          <mat-label>Forma de pagamento</mat-label>
          <mat-select formControlName="metodo">
            @for (m of metodos; track m) {
              <mat-option [value]="m">{{ rotulos[m] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field>
          <mat-label>Data do pagamento</mat-label>
          <input matInput [matDatepicker]="dp" formControlName="pagoEm" />
          <mat-datepicker-toggle matIconSuffix [for]="dp" />
          <mat-datepicker #dp />
        </mat-form-field>

        <mat-form-field>
          <mat-label>Referência (opcional)</mat-label>
          <input matInput formControlName="referenciaExterna" placeholder="ID da transação, NSU…" />
        </mat-form-field>

        <mat-form-field class="col-2">
          <mat-label>Observação (opcional)</mat-label>
          <input matInput formControlName="observacao" />
        </mat-form-field>
      </form>

      @if (pagamentoParcial()) {
        <p class="parcial">
          Este valor é menor que o saldo. A mensalidade continua em aberto com
          {{ restanteFormatado() }} a receber.
        </p>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>Cancelar</button>
      <button matButton="filled" (click)="salvar()" [disabled]="salvando()">
        @if (salvando()) {
          <mat-spinner diameter="18" />
          Registrando…
        } @else {
          Confirmar recebimento
        }
      </button>
    </mat-dialog-actions>
  `,
  styleUrl: './registrar-pagamento.dialog.scss',
})
export class RegistrarPagamentoDialog {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(FinanceiroApi);
  private readonly aviso = inject(AvisoService);

  readonly ref = inject<MatDialogRef<RegistrarPagamentoDialog, MensalidadeDto>>(MatDialogRef);
  private readonly dados = inject<DadosRegistrarPagamento>(MAT_DIALOG_DATA);

  readonly mensalidade = this.dados.mensalidade;
  readonly metodos = METODOS_PAGAMENTO;
  readonly rotulos = ROTULO_METODO;
  readonly salvando = signal(false);

  readonly competenciaFormatada = competenciaLegivel(this.mensalidade.competencia);

  /** Saldo = valor da mensalidade menos o que já foi pago. */
  private readonly saldoCentavos =
    this.mensalidade.valorCentavos -
    this.mensalidade.pagamentos.reduce((soma, p) => soma + p.valorCentavos, 0);

  readonly form = this.fb.nonNullable.group({
    valor: [(this.saldoCentavos / 100).toFixed(2).replace('.', ','), [Validators.required]],
    metodo: ['PIX' as MetodoPagamento, Validators.required],
    pagoEm: [new Date() as Date | null, Validators.required],
    referenciaExterna: [''],
    observacao: [''],
  });

  private readonly valorDigitado = signal(this.saldoCentavos);

  constructor() {
    this.form.controls.valor.valueChanges.subscribe((valor) => {
      this.valorDigitado.set(paraCentavos(valor));
    });
  }

  saldoFormatado(): string {
    return formatarMoeda(this.saldoCentavos);
  }

  pagamentoParcial = computed(
    () => this.valorDigitado() > 0 && this.valorDigitado() < this.saldoCentavos,
  );

  restanteFormatado = computed(() => formatarMoeda(this.saldoCentavos - this.valorDigitado()));

  async salvar(): Promise<void> {
    const centavos = paraCentavos(this.form.controls.valor.value);

    if (centavos <= 0) {
      this.form.controls.valor.setErrors({ min: true });
      this.form.markAllAsTouched();
      return;
    }
    if (centavos > this.saldoCentavos) {
      this.aviso.erro(null, `O valor excede o saldo em aberto (${this.saldoFormatado()}).`);
      return;
    }

    const v = this.form.getRawValue();
    this.salvando.set(true);

    try {
      const atualizada = await firstValueFrom(
        this.api.registrarPagamento(this.mensalidade.id, {
          valorCentavos: centavos,
          metodo: v.metodo,
          pagoEm: v.pagoEm ? isoDe(v.pagoEm) : undefined,
          referenciaExterna: v.referenciaExterna.trim() || null,
          observacao: v.observacao.trim() || null,
        }),
      );
      this.aviso.sucesso(
        atualizada.status === 'PAGA' ? 'Mensalidade quitada.' : 'Pagamento parcial registrado.',
      );
      this.ref.close(atualizada);
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível registrar o pagamento.');
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
