import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import {
  StatusCheckin,
  StatusFrequencia,
  type PainelAulaDto,
  type PlaylistDto,
  type TimerPresetDto,
} from '@almativa/shared';
import { TvApi } from '../../core/api/tv.api';
import { AulasApi } from '../../core/api/aulas.api';
import { AuthService } from '../../core/auth/auth.service';
import { AvisoService } from '../../core/ui/aviso.service';
import { environment } from '../../../environments/environment';
import { Cronometro } from '../cronometro/cronometro';
import { PlayerYoutube } from '../player/player-youtube';
import { IniciaisPipe } from '../../core/pipes/formato.pipes';

/**
 * Tela que roda na TV da sala (perfil AULA).
 * Mostra a aula corrente, a lista de quem fez check-in — com toque para
 * confirmar presença — e traz o cronômetro e a playlist do YouTube.
 */
@Component({
  selector: 'app-painel-sala',
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTooltipModule,
    Cronometro,
    PlayerYoutube,
    IniciaisPipe,
  ],
  templateUrl: './painel-sala.html',
  styleUrl: './painel-sala.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PainelSala {
  private readonly api = inject(TvApi);
  private readonly aulasApi = inject(AulasApi);
  private readonly auth = inject(AuthService);
  private readonly aviso = inject(AvisoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly painel = signal<PainelAulaDto | null>(null);
  readonly carregando = signal(true);
  readonly agora = signal(new Date());
  readonly telaCheia = signal(false);

  readonly timerSelecionadoId = signal<string | null>(null);
  readonly playlistSelecionadaId = signal<string | null>(null);
  readonly mostrarPlayer = signal(true);

  /** Marcados localmente para dar retorno imediato antes do próximo polling. */
  private readonly presencasLocais = signal<Set<string>>(new Set());

  readonly timers = computed(() => this.painel()?.timersSugeridos ?? []);
  readonly playlists = computed(() => this.painel()?.playlistsSugeridas ?? []);

  readonly timerAtivo = computed<TimerPresetDto | null>(() => {
    const lista = this.timers();
    if (lista.length === 0) return null;
    return lista.find((t) => t.id === this.timerSelecionadoId()) ?? lista[0];
  });

  readonly playlistAtiva = computed<PlaylistDto | null>(() => {
    const lista = this.playlists();
    if (lista.length === 0) return null;
    return lista.find((p) => p.id === this.playlistSelecionadaId()) ?? lista[0];
  });

  readonly aula = computed(() => this.painel()?.aulaAtual ?? null);
  readonly proxima = computed(() => this.painel()?.proximaAula ?? null);

  /** Confirmados e lista de espera, já com a presença resolvida. */
  readonly listaChamada = computed(() => {
    const p = this.painel();
    if (!p) return [];

    const presentes = new Set(
      p.presentes.filter((f) => f.status === StatusFrequencia.PRESENTE).map((f) => f.alunoId),
    );
    const locais = this.presencasLocais();

    return p.checkins
      .filter((c) => c.status !== StatusCheckin.CANCELADO)
      .map((c) => ({
        alunoId: c.alunoId,
        alunoNome: c.alunoNome,
        listaEspera: c.status === StatusCheckin.LISTA_ESPERA,
        presente: presentes.has(c.alunoId) || locais.has(c.alunoId),
      }));
  });

  readonly totalPresentes = computed(() => this.listaChamada().filter((l) => l.presente).length);

  constructor() {
    void this.carregar();

    const polling = setInterval(() => void this.carregar(true), environment.intervaloPainelTv);
    const relogio = setInterval(() => this.agora.set(new Date()), 1000);

    this.destroyRef.onDestroy(() => {
      clearInterval(polling);
      clearInterval(relogio);
    });
  }

  async carregar(silencioso = false): Promise<void> {
    if (!silencioso) this.carregando.set(true);
    try {
      const painel = await firstValueFrom(this.api.painel());
      this.painel.set(painel);
      // O servidor já reconhece as presenças: limpa o otimismo local.
      this.presencasLocais.set(new Set());
    } catch (erro) {
      if (!silencioso) this.aviso.erro(erro, 'Não foi possível carregar o painel da sala.');
    } finally {
      this.carregando.set(false);
    }
  }

  /** Toque no nome confirma a presença direto da TV. */
  async confirmarPresenca(alunoId: string, presenteAgora: boolean): Promise<void> {
    const aula = this.aula();
    if (!aula || presenteAgora) return;

    this.presencasLocais.update((atual) => new Set(atual).add(alunoId));

    try {
      await firstValueFrom(
        this.aulasApi.registrarPresenca(aula.id, alunoId, StatusFrequencia.PRESENTE, 'TELA_AULA'),
      );
    } catch (erro) {
      this.presencasLocais.update((atual) => {
        const copia = new Set(atual);
        copia.delete(alunoId);
        return copia;
      });
      this.aviso.erro(erro, 'Não foi possível confirmar a presença.');
    }
  }

  async alternarTelaCheia(): Promise<void> {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        this.telaCheia.set(false);
      } else {
        await document.documentElement.requestFullscreen();
        this.telaCheia.set(true);
      }
    } catch {
      // Navegador pode bloquear: apenas ignora.
    }
  }

  async sair(): Promise<void> {
    await this.auth.sair();
  }
}
