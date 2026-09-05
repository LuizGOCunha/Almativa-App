import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, of } from 'rxjs';
import { DIAS_SEMANA, type AulaDto, type ModalidadeDto } from '@almativa/shared';
import { AulasApi } from '../../core/api/aulas.api';
import { CatalogoApi } from '../../core/api/catalogo.api';
import { AvisoService } from '../../core/ui/aviso.service';
import { ConfirmacaoDialog } from '../../core/ui/confirmacao.dialog';
import { ROTULO_STATUS_AULA } from '../../core/ui/rotulos';
import { Selo } from '../../shared/selo/selo';
import { EstadoVazio } from '../../shared/estado-vazio/estado-vazio';
import { ChamadaDialog } from './chamada.dialog';

interface DiaAgenda {
  data: Date;
  iso: string;
  rotulo: string;
  ehHoje: boolean;
  aulas: AulaDto[];
}

@Component({
  selector: 'app-agenda',
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressBarModule,
    MatMenuModule,
    MatTooltipModule,
    Selo,
    EstadoVazio,
  ],
  templateUrl: './agenda.html',
  styleUrl: './agenda.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Agenda {
  private readonly api = inject(AulasApi);
  private readonly catalogo = inject(CatalogoApi);
  private readonly dialog = inject(MatDialog);
  private readonly aviso = inject(AvisoService);

  readonly rotulos = ROTULO_STATUS_AULA;

  /** Segunda-feira da semana exibida. */
  readonly inicioSemana = signal(segundaDaSemana(new Date()));
  readonly modalidadeId = signal('');
  readonly carregando = signal(false);
  readonly aulas = signal<AulaDto[]>([]);

  readonly modalidades = toSignal(
    this.catalogo.modalidades(true).pipe(catchError(() => of([] as ModalidadeDto[]))),
    { initialValue: [] as ModalidadeDto[] },
  );

  readonly fimSemana = computed(() => somarDias(this.inicioSemana(), 6));

  /** Agrupa as aulas da semana por dia, mantendo os dias vazios visíveis. */
  readonly dias = computed<DiaAgenda[]>(() => {
    const hojeIso = paraIso(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const data = somarDias(this.inicioSemana(), i);
      const iso = paraIso(data);
      return {
        data,
        iso,
        rotulo: DIAS_SEMANA[data.getDay()].curto,
        ehHoje: iso === hojeIso,
        aulas: this.aulas()
          .filter((a) => a.inicioEm.slice(0, 10) === iso)
          .sort((a, b) => a.inicioEm.localeCompare(b.inicioEm)),
      };
    });
  });

  readonly resumoSemana = computed(() => {
    const lista = this.aulas().filter((a) => a.status !== 'CANCELADA');
    const vagas = lista.reduce((t, a) => t + a.capacidade, 0);
    const ocupadas = lista.reduce((t, a) => t + a.checkins, 0);
    return {
      aulas: lista.length,
      checkins: ocupadas,
      presencas: lista.reduce((t, a) => t + a.presentes, 0),
      ocupacao: vagas > 0 ? Math.round((ocupadas / vagas) * 100) : 0,
    };
  });

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      this.aulas.set(
        await firstValueFrom(
          this.api.listar({
            de: paraIso(this.inicioSemana()),
            ate: paraIso(this.fimSemana()),
            modalidadeId: this.modalidadeId() || undefined,
          }),
        ),
      );
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível carregar a agenda.');
    } finally {
      this.carregando.set(false);
    }
  }

  navegar(semanas: number): void {
    this.inicioSemana.set(somarDias(this.inicioSemana(), semanas * 7));
    void this.carregar();
  }

  irParaHoje(): void {
    this.inicioSemana.set(segundaDaSemana(new Date()));
    void this.carregar();
  }

  aoFiltrarModalidade(id: string): void {
    this.modalidadeId.set(id);
    void this.carregar();
  }

  lotacao(aula: AulaDto): number {
    return aula.capacidade > 0 ? Math.round((aula.checkins / aula.capacidade) * 100) : 0;
  }

  /** Materializa as ocorrências das próximas 4 semanas a partir das turmas. */
  async gerarAulas(): Promise<void> {
    const ref = this.dialog.open(ConfirmacaoDialog, {
      data: {
        titulo: 'Gerar aulas das próximas 4 semanas?',
        mensagem:
          'Cria as ocorrências a partir da grade de turmas ativas. Aulas já existentes não são duplicadas.',
        confirmar: 'Gerar',
        icone: 'auto_awesome',
      },
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;

    try {
      const hoje = new Date();
      const r = await firstValueFrom(
        this.api.gerar(paraIso(hoje), paraIso(somarDias(hoje, 28))),
      );
      this.aviso.sucesso(`${r.criadas} aula(s) criada(s), ${r.existentes} já existiam.`);
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível gerar as aulas.');
    }
  }

  async abrirChamada(aula: AulaDto): Promise<void> {
    const ref = this.dialog.open(ChamadaDialog, { data: { aulaId: aula.id } });
    if (await firstValueFrom(ref.afterClosed())) await this.carregar();
  }

  async cancelarAula(aula: AulaDto): Promise<void> {
    const ref = this.dialog.open(ConfirmacaoDialog, {
      data: {
        titulo: 'Cancelar esta aula?',
        mensagem: `Os ${aula.checkins} check-in(s) são liberados e os alunos recebem um aviso na área deles.`,
        confirmar: 'Cancelar aula',
        cancelar: 'Voltar',
        destrutivo: true,
        icone: 'event_busy',
      },
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;

    try {
      const r = await firstValueFrom(this.api.cancelar(aula.id, null));
      this.aviso.sucesso(`Aula cancelada. ${r.checkinsLiberados} aluno(s) avisado(s).`);
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível cancelar a aula.');
    }
  }
}

function segundaDaSemana(data: Date): Date {
  const resultado = new Date(data);
  resultado.setHours(0, 0, 0, 0);
  const dia = resultado.getDay();
  resultado.setDate(resultado.getDate() + (dia === 0 ? -6 : 1 - dia));
  return resultado;
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
