import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { firstValueFrom } from 'rxjs';
import { DIAS_SEMANA } from '@almativa/shared';
import { AlunoAreaApi, type AulaComCheckin } from '../../core/api/aluno-area.api';
import { AvisoService } from '../../core/ui/aviso.service';
import { EstadoVazio } from '../../shared/estado-vazio/estado-vazio';

interface DiaAgenda {
  iso: string;
  rotulo: string;
  ehHoje: boolean;
  aulas: AulaComCheckin[];
}

@Component({
  selector: 'app-agenda-aluno',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressBarModule, EstadoVazio],
  templateUrl: './agenda-aluno.html',
  styleUrl: './agenda-aluno.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaAluno {
  private readonly api = inject(AlunoAreaApi);
  private readonly aviso = inject(AvisoService);

  readonly inicioSemana = signal(segundaDaSemana(new Date()));
  readonly carregando = signal(false);
  readonly processandoAulaId = signal<string | null>(null);
  readonly aulas = signal<AulaComCheckin[]>([]);

  readonly fimSemana = computed(() => somarDias(this.inicioSemana(), 6));

  readonly dias = computed<DiaAgenda[]>(() => {
    const hojeIso = paraIso(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const data = somarDias(this.inicioSemana(), i);
      const iso = paraIso(data);
      const aulas = this.aulas()
        .filter((a) => a.inicioEm.slice(0, 10) === iso)
        .sort((a, b) => a.inicioEm.localeCompare(b.inicioEm));
      return {
        iso,
        rotulo: `${DIAS_SEMANA[data.getDay()].longo}, ${data.getDate()}/${data.getMonth() + 1}`,
        ehHoje: iso === hojeIso,
        aulas,
      };
    }).filter((dia) => dia.aulas.length > 0);
  });

  readonly minhasVagas = computed(
    () => this.aulas().filter((a) => a.meuCheckin?.status === 'CONFIRMADO').length,
  );

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      this.aulas.set(
        await firstValueFrom(
          this.api.agenda(paraIso(this.inicioSemana()), paraIso(this.fimSemana())),
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

  /** Passou da hora de entrar? A API também valida, isto é só a UI. */
  jaPassou(aula: AulaComCheckin): boolean {
    return new Date(aula.inicioEm).getTime() + 15 * 60_000 < Date.now();
  }

  podeEntrar(aula: AulaComCheckin): boolean {
    return aula.status === 'AGENDADA' && !this.jaPassou(aula) && !aula.meuCheckin;
  }

  rotuloVaga(aula: AulaComCheckin): string {
    if (aula.status === 'CANCELADA') return 'Aula cancelada';
    if (aula.meuCheckin?.status === 'CONFIRMADO') return 'Sua vaga está garantida';
    if (aula.meuCheckin?.status === 'LISTA_ESPERA') {
      return `Lista de espera · ${aula.meuCheckin.posicaoFila}º da fila`;
    }
    if (this.jaPassou(aula)) return 'Prazo de check-in encerrado';
    if (aula.vagasDisponiveis === 0) return 'Turma cheia — entra na lista de espera';
    return `${aula.vagasDisponiveis} vaga(s) disponível(is)`;
  }

  async fazerCheckin(aula: AulaComCheckin): Promise<void> {
    this.processandoAulaId.set(aula.id);
    try {
      const checkin = await firstValueFrom(this.api.fazerCheckin(aula.id));
      this.aviso.sucesso(
        checkin.status === 'CONFIRMADO'
          ? 'Vaga garantida! Te esperamos.'
          : `Turma cheia — você é o ${checkin.posicaoFila}º da lista de espera.`,
      );
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível fazer o check-in.');
    } finally {
      this.processandoAulaId.set(null);
    }
  }

  async cancelarCheckin(aula: AulaComCheckin): Promise<void> {
    this.processandoAulaId.set(aula.id);
    try {
      await firstValueFrom(this.api.cancelarCheckin(aula.id));
      this.aviso.info('Check-in cancelado. A vaga foi liberada.');
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível cancelar o check-in.');
    } finally {
      this.processandoAulaId.set(null);
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
