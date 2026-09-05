import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, of } from 'rxjs';
import type { ModalidadeDto } from '@almativa/shared';
import { AulasApi, type LinhaRelatorioFrequencia } from '../../core/api/aulas.api';
import { CatalogoApi } from '../../core/api/catalogo.api';
import { AvisoService } from '../../core/ui/aviso.service';
import { EstadoVazio } from '../../shared/estado-vazio/estado-vazio';
import { IniciaisPipe, QuandoPipe } from '../../core/pipes/formato.pipes';

/**
 * Relatório de frequência por aluno no período. Serve tanto para acompanhar
 * quem está sumido quanto para justificar reposições.
 */
@Component({
  selector: 'app-frequencia',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDatepickerModule,
    MatTableModule,
    MatProgressBarModule,
    EstadoVazio,
    IniciaisPipe,
    QuandoPipe,
  ],
  templateUrl: './frequencia.html',
  styleUrl: './frequencia.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Frequencia {
  private readonly api = inject(AulasApi);
  private readonly catalogo = inject(CatalogoApi);
  private readonly aviso = inject(AvisoService);

  readonly colunas = ['aluno', 'presencas', 'faltas', 'aproveitamento', 'ultima'];

  readonly de = signal(somarDias(new Date(), -30));
  readonly ate = signal(new Date());
  readonly modalidadeSlug = signal('');
  readonly ordenacao = signal<'aproveitamento' | 'presencas' | 'sumidos'>('presencas');

  readonly carregando = signal(false);
  readonly linhas = signal<LinhaRelatorioFrequencia[]>([]);

  readonly modalidades = toSignal(
    this.catalogo.modalidades(true).pipe(catchError(() => of([] as ModalidadeDto[]))),
    { initialValue: [] as ModalidadeDto[] },
  );

  readonly resumo = computed(() => {
    const lista = this.linhas();
    const presencas = lista.reduce((t, l) => t + l.presencas, 0);
    const aulas = lista.reduce((t, l) => t + l.totalAulas, 0);
    return {
      alunos: lista.length,
      presencas,
      aproveitamento: aulas > 0 ? Math.round((presencas / aulas) * 100) : 0,
      // "Sumidos": tiveram registro no período mas com aproveitamento baixo.
      emRisco: lista.filter((l) => l.totalAulas >= 3 && l.aproveitamento < 50).length,
    };
  });

  readonly listaOrdenada = computed(() => {
    const lista = [...this.linhas()];
    switch (this.ordenacao()) {
      case 'aproveitamento':
        return lista.sort((a, b) => b.aproveitamento - a.aproveitamento);
      case 'sumidos':
        return lista.sort((a, b) => a.aproveitamento - b.aproveitamento);
      default:
        return lista.sort((a, b) => b.presencas - a.presencas);
    }
  });

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      this.linhas.set(
        await firstValueFrom(
          this.api.relatorioFrequencia({
            de: paraIso(this.de()),
            ate: paraIso(this.ate()),
            modalidadeSlug: this.modalidadeSlug() || undefined,
          }),
        ),
      );
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível carregar o relatório.');
    } finally {
      this.carregando.set(false);
    }
  }

  periodoRapido(dias: number): void {
    this.de.set(somarDias(new Date(), -dias));
    this.ate.set(new Date());
    void this.carregar();
  }

  classeAproveitamento(valor: number): string {
    if (valor >= 75) return 'bom';
    if (valor >= 50) return 'medio';
    return 'baixo';
  }

  /** Exporta o relatório visível em CSV para abrir na planilha. */
  exportarCsv(): void {
    const cabecalho = ['Aluno', 'Presenças', 'Faltas', 'Justificadas', 'Total', 'Aproveitamento (%)', 'Última aula'];
    const linhas = this.listaOrdenada().map((l) => [
      l.alunoNome,
      l.presencas,
      l.ausencias,
      l.justificadas,
      l.totalAulas,
      l.aproveitamento,
      l.ultimaAula ? new Date(l.ultimaAula).toLocaleDateString('pt-BR') : '',
    ]);

    const csv = [cabecalho, ...linhas]
      .map((linha) => linha.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(';'))
      .join('\n');

    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `frequencia-${paraIso(this.de())}-a-${paraIso(this.ate())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

function somarDias(data: Date, dias: number): Date {
  const resultado = new Date(data);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}

function paraIso(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(
    data.getDate(),
  ).padStart(2, '0')}`;
}
