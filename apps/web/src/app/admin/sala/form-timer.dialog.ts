import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, of } from 'rxjs';
import {
  formatarCronometro,
  type IntervaloTimer,
  type ModalidadeDto,
  type TimerPresetDto,
} from '@almativa/shared';
import { TvApi } from '../../core/api/tv.api';
import { CatalogoApi } from '../../core/api/catalogo.api';
import { AvisoService } from '../../core/ui/aviso.service';

export interface DadosFormTimer {
  timer?: TimerPresetDto;
}

/**
 * Editor de preset de cronômetro. Um preset é uma sequência de intervalos
 * (trabalho, descanso…) repetida N rounds — a tela da sala só executa.
 */
@Component({
  selector: 'app-form-timer',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './form-timer.dialog.html',
  styleUrl: './form-timer.dialog.scss',
})
export class FormTimerDialog {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(TvApi);
  private readonly catalogo = inject(CatalogoApi);
  private readonly aviso = inject(AvisoService);

  readonly ref = inject<MatDialogRef<FormTimerDialog, boolean>>(MatDialogRef);
  readonly dados = inject<DadosFormTimer>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  readonly editando = Boolean(this.dados.timer);
  readonly salvando = signal(false);

  readonly tipos = [
    { valor: 'PREPARO', rotulo: 'Preparação' },
    { valor: 'TRABALHO', rotulo: 'Trabalho' },
    { valor: 'DESCANSO', rotulo: 'Descanso' },
    { valor: 'TRANSICAO', rotulo: 'Transição' },
  ];

  readonly modalidades = toSignal(
    this.catalogo.modalidades(true).pipe(catchError(() => of([] as ModalidadeDto[]))),
    { initialValue: [] as ModalidadeDto[] },
  );

  readonly form = this.fb.nonNullable.group({
    nome: [this.dados.timer?.nome ?? '', [Validators.required, Validators.minLength(2)]],
    descricao: [this.dados.timer?.descricao ?? ''],
    modalidadeId: [this.dados.timer?.modalidade?.id ?? ''],
    rounds: [this.dados.timer?.rounds ?? 1, [Validators.required, Validators.min(1)]],
    avisoSonoro: [this.dados.timer?.avisoSonoro ?? true],
    segundosAviso: [this.dados.timer?.segundosAviso ?? 10],
    intervalos: this.fb.array(
      (
        this.dados.timer?.intervalos ?? [
          { tipo: 'TRABALHO', rotulo: 'Trabalho', duracaoSegundos: 45 },
          { tipo: 'DESCANSO', rotulo: 'Descanso', duracaoSegundos: 15 },
        ]
      ).map((i) => this.criarIntervalo(i as IntervaloTimer)),
    ),
  });

  /** Dispara o recálculo do total a cada mudança do formulário. */
  private readonly valores = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  readonly duracaoTotal = computed(() => {
    this.valores();
    const rounds = this.form.controls.rounds.value || 1;
    const ciclo = this.intervalos.controls.reduce(
      (total, grupo) => total + (grupo.controls.duracaoSegundos.value || 0),
      0,
    );
    return formatarCronometro(ciclo * rounds);
  });

  get intervalos(): FormArray<ReturnType<FormTimerDialog['criarIntervalo']>> {
    return this.form.controls.intervalos;
  }

  private criarIntervalo(valor?: IntervaloTimer) {
    return this.fb.nonNullable.group({
      tipo: [valor?.tipo ?? 'TRABALHO', Validators.required],
      rotulo: [valor?.rotulo ?? 'Trabalho', Validators.required],
      duracaoSegundos: [valor?.duracaoSegundos ?? 30, [Validators.required, Validators.min(1)]],
    });
  }

  adicionarIntervalo(): void {
    this.intervalos.push(this.criarIntervalo());
  }

  removerIntervalo(indice: number): void {
    if (this.intervalos.length <= 1) {
      this.aviso.erro(null, 'O timer precisa de pelo menos um intervalo.');
      return;
    }
    this.intervalos.removeAt(indice);
  }

  async salvar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const payload = {
      nome: v.nome,
      descricao: v.descricao.trim() || null,
      modalidadeId: v.modalidadeId || null,
      rounds: v.rounds,
      intervalos: v.intervalos,
      avisoSonoro: v.avisoSonoro,
      segundosAviso: v.segundosAviso,
    };

    this.salvando.set(true);
    try {
      if (this.editando) {
        await firstValueFrom(this.api.atualizarTimer(this.dados.timer!.id, payload));
        this.aviso.sucesso('Timer atualizado.');
      } else {
        await firstValueFrom(this.api.criarTimer(payload));
        this.aviso.sucesso('Timer criado.');
      }
      this.ref.close(true);
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível salvar o timer.');
    } finally {
      this.salvando.set(false);
    }
  }
}
