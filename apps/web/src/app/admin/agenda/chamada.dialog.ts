import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import type { StatusFrequencia } from '@almativa/shared';
import { AulasApi, type AulaDetalheDto } from '../../core/api/aulas.api';
import { AvisoService } from '../../core/ui/aviso.service';
import { IniciaisPipe } from '../../core/pipes/formato.pipes';

export interface DadosChamada {
  aulaId: string;
}

interface LinhaChamada {
  alunoId: string;
  alunoNome: string;
  status: StatusFrequencia | null;
  listaEspera: boolean;
}

/**
 * Chamada da aula: parte dos check-ins (quem reservou vaga) e confirma quem
 * de fato compareceu. Salvar fecha a aula como REALIZADA.
 */
@Component({
  selector: 'app-chamada',
  imports: [
    DatePipe,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    MatProgressBarModule,
    MatTooltipModule,
    IniciaisPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chamada.dialog.html',
  styleUrl: './chamada.dialog.scss',
})
export class ChamadaDialog {
  private readonly api = inject(AulasApi);
  private readonly aviso = inject(AvisoService);

  readonly ref = inject<MatDialogRef<ChamadaDialog, boolean>>(MatDialogRef);
  private readonly dados = inject<DadosChamada>(MAT_DIALOG_DATA);

  readonly aula = signal<AulaDetalheDto | null>(null);
  readonly linhas = signal<LinhaChamada[]>([]);
  readonly carregando = signal(true);
  readonly salvando = signal(false);

  readonly presentes = computed(() => this.linhas().filter((l) => l.status === 'PRESENTE').length);
  readonly semMarcar = computed(() => this.linhas().filter((l) => l.status === null).length);

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      const aula = await firstValueFrom(this.api.obter(this.dados.aulaId));
      this.aula.set(aula);

      const porAluno = new Map(aula.listaFrequencia.map((f) => [f.alunoId, f.status]));

      // Ordem: confirmados primeiro, lista de espera depois.
      this.linhas.set(
        aula.listaCheckins.map((c) => ({
          alunoId: c.alunoId,
          alunoNome: c.alunoNome,
          status: porAluno.get(c.alunoId) ?? null,
          listaEspera: c.status === 'LISTA_ESPERA',
        })),
      );
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível carregar a chamada.');
      this.ref.close(false);
    } finally {
      this.carregando.set(false);
    }
  }

  marcar(alunoId: string, status: StatusFrequencia): void {
    this.linhas.update((linhas) =>
      linhas.map((l) => (l.alunoId === alunoId ? { ...l, status } : l)),
    );
  }

  marcarTodos(status: StatusFrequencia): void {
    this.linhas.update((linhas) => linhas.map((l) => ({ ...l, status })));
  }

  async salvar(finalizar: boolean): Promise<void> {
    const registros = this.linhas()
      .filter((l) => l.status !== null)
      .map((l) => ({ alunoId: l.alunoId, status: l.status!, observacao: null }));

    if (registros.length === 0) {
      this.aviso.erro(null, 'Marque ao menos um aluno antes de salvar.');
      return;
    }

    this.salvando.set(true);
    try {
      const r = await firstValueFrom(
        this.api.fecharChamada(this.dados.aulaId, registros, finalizar),
      );
      this.aviso.sucesso(
        finalizar
          ? `Chamada fechada: ${r.presentes} presente(s) de ${r.registrados}.`
          : `${r.registrados} presença(s) salva(s).`,
      );
      this.ref.close(true);
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível salvar a chamada.');
    } finally {
      this.salvando.set(false);
    }
  }
}
