import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import type { PlaylistDto } from '@almativa/shared';

/** Subconjunto da IFrame Player API que usamos aqui. */
interface PlayerYT {
  loadVideoById(opcoes: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  destroy(): void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (elemento: HTMLElement, opcoes: Record<string, unknown>) => PlayerYT;
      PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiCarregando: Promise<void> | null = null;

/** Carrega a IFrame API uma única vez por página. */
function carregarApiYoutube(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();

  apiCarregando ??= new Promise<void>((resolver, rejeitar) => {
    const anterior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      anterior?.();
      resolver();
    };

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => rejeitar(new Error('Falha ao carregar a API do YouTube.'));
    document.head.appendChild(script);
  });

  return apiCarregando;
}

/**
 * Player de playlist do YouTube para a tela da sala.
 * Em `somenteAudio` o iframe fica oculto — serve só como fonte de som.
 */
@Component({
  selector: 'app-player-youtube',
  imports: [MatButtonModule, MatIconModule, MatSliderModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './player-youtube.html',
  styleUrl: './player-youtube.scss',
})
export class PlayerYoutube {
  readonly playlist = input.required<PlaylistDto>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly hospedeiro = viewChild.required<ElementRef<HTMLDivElement>>('hospedeiro');

  private player: PlayerYT | null = null;

  readonly pronto = signal(false);
  readonly tocando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly indice = signal(0);
  readonly volume = signal(40);
  readonly mudo = signal(false);

  readonly itens = computed(() => this.playlist().itens);
  readonly itemAtual = computed(() => this.itens()[this.indice()] ?? null);
  readonly somenteAudio = computed(() => this.playlist().somenteAudio);

  constructor() {
    // Trocar de playlist recarrega o primeiro vídeo.
    effect(() => {
      const p = this.playlist();
      this.volume.set(p.volumePadrao);
      this.indice.set(0);
      if (this.pronto()) this.carregarAtual();
    });

    effect(() => {
      const elemento = this.hospedeiro().nativeElement;
      if (this.player) return;
      void this.montar(elemento);
    });

    this.destroyRef.onDestroy(() => this.player?.destroy());
  }

  private async montar(elemento: HTMLElement): Promise<void> {
    try {
      await carregarApiYoutube();
      const YT = window.YT;
      if (!YT) throw new Error('API do YouTube indisponível.');

      const primeiro = this.itens()[0];
      this.player = new YT.Player(elemento, {
        videoId: primeiro?.videoId ?? '',
        playerVars: {
          autoplay: 0,
          controls: this.somenteAudio() ? 0 : 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            this.pronto.set(true);
            this.player?.setVolume(this.volume());
          },
          onStateChange: (evento: { data: number }) => {
            this.tocando.set(evento.data === YT.PlayerState.PLAYING);
            if (evento.data === YT.PlayerState.ENDED) this.proximo(true);
          },
          onError: () => this.erro.set('Não foi possível tocar este vídeo.'),
        },
      });
    } catch (erro) {
      this.erro.set(erro instanceof Error ? erro.message : 'Falha ao iniciar o player.');
    }
  }

  private carregarAtual(autoplay = true): void {
    const item = this.itemAtual();
    if (!item || !this.player) return;

    this.erro.set(null);
    this.player.loadVideoById({
      videoId: item.videoId,
      startSeconds: item.inicioEm ?? 0,
    });
    if (!autoplay) this.player.pauseVideo();
  }

  alternar(): void {
    if (!this.player) return;
    if (this.tocando()) {
      this.player.pauseVideo();
    } else {
      this.player.playVideo();
    }
  }

  proximo(automatico = false): void {
    const total = this.itens().length;
    if (total === 0) return;

    const proximo = this.indice() + 1;
    // Ao fim da lista, volta ao início (a aula continua).
    this.indice.set(proximo >= total ? 0 : proximo);
    this.carregarAtual(automatico || this.tocando());
  }

  anterior(): void {
    const total = this.itens().length;
    if (total === 0) return;
    this.indice.set(this.indice() === 0 ? total - 1 : this.indice() - 1);
    this.carregarAtual(this.tocando());
  }

  irPara(indice: number): void {
    this.indice.set(indice);
    this.carregarAtual(true);
  }

  aoMudarVolume(valor: number): void {
    this.volume.set(valor);
    this.player?.setVolume(valor);
    if (valor > 0 && this.mudo()) this.alternarMudo();
  }

  alternarMudo(): void {
    if (!this.player) return;
    if (this.mudo()) {
      this.player.unMute();
      this.mudo.set(false);
    } else {
      this.player.mute();
      this.mudo.set(true);
    }
  }
}
