import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, of } from 'rxjs';
import { formatarMoeda, type MatriculaDto, type PlanoDto } from '@almativa/shared';
import { AlunosApi } from '../../core/api/alunos.api';
import { CatalogoApi } from '../../core/api/catalogo.api';
import { AvisoService } from '../../core/ui/aviso.service';

export interface DadosFormMatricula {
  alunoId: string;
}

@Component({
  selector: 'app-form-matricula',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Nova matrícula</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="form" novalidate>
        <mat-form-field class="col-2">
          <mat-label>Plano</mat-label>
          <mat-select formControlName="planoId">
            @for (p of planos(); track p.id) {
              <mat-option [value]="p.id">
                {{ p.nome }} — {{ rotuloValor(p) }}
              </mat-option>
            }
          </mat-select>
          @if (form.controls.planoId.touched && form.controls.planoId.invalid) {
            <mat-error>Escolha o plano.</mat-error>
          }
        </mat-form-field>

        <mat-form-field>
          <mat-label>Início</mat-label>
          <input matInput [matDatepicker]="dpInicio" formControlName="dataInicio" />
          <mat-datepicker-toggle matIconSuffix [for]="dpInicio" />
          <mat-datepicker #dpInicio />
        </mat-form-field>

        <mat-form-field>
          <mat-label>Dia do vencimento</mat-label>
          <mat-select formControlName="diaVencimento">
            @for (dia of diasVencimento; track dia) {
              <mat-option [value]="dia">dia {{ dia }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field class="col-2">
          <mat-label>Observação (opcional)</mat-label>
          <input matInput formControlName="observacao" />
        </mat-form-field>

        <div class="col-2 opcao">
          <mat-slide-toggle formControlName="gerarPrimeiraMensalidade">
            Gerar a mensalidade da competência atual
          </mat-slide-toggle>
          @if (planoSelecionado(); as p) {
            <p>
              Será criada uma cobrança de <strong>{{ rotuloValor(p) }}</strong> vencendo no dia
              {{ form.controls.diaVencimento.value }}.
            </p>
          }
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>Cancelar</button>
      <button matButton="filled" (click)="salvar()" [disabled]="salvando()">
        @if (salvando()) {
          <mat-spinner diameter="18" />
          Salvando…
        } @else {
          Criar matrícula
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      min-width: min(520px, 84vw);
    }
    .form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 16px;
      padding-top: 6px;
    }
    .col-2 {
      grid-column: 1 / -1;
    }
    mat-form-field {
      width: 100%;
    }
    .opcao {
      padding: 14px 16px;
      border-radius: var(--alm-raio-sm);
      background: var(--mat-sys-surface-container-low);
      border: 1px solid var(--mat-sys-outline-variant);

      p {
        margin: 8px 0 0;
        font-size: 0.8125rem;
        color: var(--mat-sys-on-surface-variant);
      }
    }
    @media (max-width: 599px) {
      .form {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class FormMatriculaDialog {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AlunosApi);
  private readonly catalogo = inject(CatalogoApi);
  private readonly aviso = inject(AvisoService);

  readonly ref = inject<MatDialogRef<FormMatriculaDialog, MatriculaDto>>(MatDialogRef);
  readonly dados = inject<DadosFormMatricula>(MAT_DIALOG_DATA);

  readonly diasVencimento = [5, 10, 15, 20, 25, 28];
  readonly salvando = signal(false);

  readonly planos = toSignal(this.catalogo.planos(true).pipe(catchError(() => of([] as PlanoDto[]))), {
    initialValue: [] as PlanoDto[],
  });

  readonly form = this.fb.nonNullable.group({
    planoId: ['', Validators.required],
    dataInicio: [new Date() as Date | null, Validators.required],
    diaVencimento: [10, Validators.required],
    observacao: [''],
    gerarPrimeiraMensalidade: [true],
  });

  readonly planoSelecionado = computed(() => {
    const id = this.formPlanoId();
    return this.planos().find((p) => p.id === id) ?? null;
  });

  private readonly formPlanoId = toSignal(this.form.controls.planoId.valueChanges, {
    initialValue: '',
  });

  rotuloValor(plano: PlanoDto): string {
    const sufixo =
      plano.periodicidade === 'MENSAL'
        ? '/mês'
        : plano.periodicidade === 'TRIMESTRAL'
          ? '/trimestre'
          : plano.periodicidade === 'SEMESTRAL'
            ? '/semestre'
            : '/ano';
    return `${formatarMoeda(plano.valorCentavos)}${sufixo}`;
  }

  async salvar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    this.salvando.set(true);

    try {
      const matricula = await firstValueFrom(
        this.api.criarMatricula(this.dados.alunoId, {
          planoId: v.planoId,
          dataInicio: isoDe(v.dataInicio!),
          dataFim: null,
          diaVencimento: v.diaVencimento,
          status: 'ATIVA',
          observacao: v.observacao.trim() || null,
          gerarPrimeiraMensalidade: v.gerarPrimeiraMensalidade,
        }),
      );
      this.aviso.sucesso('Matrícula criada.');
      this.ref.close(matricula);
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível criar a matrícula.');
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
