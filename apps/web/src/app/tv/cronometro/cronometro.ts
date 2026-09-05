import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { formatarCronometro, type IntervaloTimer, type TimerPresetDto } from '@almativa/shared';

interface Etapa {
  round: number;
  indice: number;
  intervalo: IntervaloTimer;
}

/**
 * Cronômetro de aula. Executa a sequência de intervalos do preset pelos
 * rounds configurados, com bipe na virada e nos últimos segundos.
 *
 * A contagem usa o relógio do sistema (não acumula erro de setInterval) e
 * o áudio é sintetizado via Web Audio — sem arquivo externo.
 */
@Component({
  selector: 'app-cronometro',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cronometro.html',
  styleUrl: './cronometro.scss',
})
export class Cronometro {
  readonly preset = input.required<TimerPresetDto>();
  /** Modo compacto para caber ao lado do player. */
  readonly compacto = input(false);

  private readonly destroyRef = inject(DestroyRef);

  private intervalo: ReturnType<typeof setInterval> | null = null;
  private fimDaEtapaEm = 0;
  private audio: AudioContext | null = null;
  private ultimoBipe = -1;

  readonly rodando = signal(false);
  readonly indiceEtapa = signal(0);
  readonly restanteMs = signal(0);
  readonly concluido = signal(false);

  /** Sequência linear de todas as etapas (rounds × intervalos). */
  readonly etapas = computed<Etapa[]>(() => {
    const p = this.preset();
    const lista: Etapa[] = [];
    for (let round = 1; round <= p.rounds; round++) {
      p.intervalos.forEach((intervalo, indice) => lista.push({ round, indice, intervalo }));
    }
    return lista;
  });

  readonly etapaAtual = computed(() => this.etapas()[this.indiceEtapa()] ?? null);
  readonly proximaEtapa = computed(() => this.etapas()[this.indiceEtapa() + 1] ?? null);

  readonly restanteSegundos = computed(() => Math.ceil(this.restanteMs() / 1000));
  readonly mostrador = computed(() => formatarCronometro(this.restanteSegundos()));

  readonly totalEtapas = computed(() => this.etapas().length);

  /** Progresso da etapa atual, 0–100. */
  readonly progresso = computed(() => {
    const etapa = this.etapaAtual();
    if (!etapa) return 100;
    const total = etapa.intervalo.duracaoSegundos * 1000;
    return total > 0 ? Math.min(100, ((total - this.restanteMs()) / total) * 100) : 0;
  });

  readonly tipoAtual = computed(() => this.etapaAtual()?.intervalo.tipo ?? 'PREPARO');
  readonly rotuloAtual = computed(() => this.etapaAtual()?.intervalo.rotulo ?? '—');
  readonly roundAtual = computed(() => this.etapaAtual()?.round ?? 1);

  /** Últimos segundos do intervalo: usado para destacar o mostrador. */
  readonly emContagemFinal = computed(
    () => this.rodando() && this.restanteSegundos() <= this.preset().segundosAviso,
  );

  constructor() {
    // Trocar de preset reinicia o cronômetro.
    effect(() => {
      this.preset();
      this.parar();
      this.reiniciar();
    });

    this.destroyRef.onDestroy(() => {
      this.limparIntervalo();
      void this.audio?.close();
    });
  }

  /* ------------------------------ Controles ----------------------------- */

  alternar(): void {
    this.rodando() ? this.pausar() : this.iniciar();
  }

  iniciar(): void {
    if (this.concluido()) this.reiniciar();

    const etapa = this.etapaAtual();
    if (!etapa) return;

    void this.garantirAudio();
    this.fimDaEtapaEm = Date.now() + this.restanteMs();
    this.rodando.set(true);
    this.ultimoBipe = -1;

    this.limparIntervalo();
    // 100ms mantém o mostrador fluido sem pesar na TV.
    this.intervalo = setInterval(() => this.tique(), 100);
  }

  pausar(): void {
    this.rodando.set(false);
    this.limparIntervalo();
  }

  parar(): void {
    this.pausar();
    this.concluido.set(false);
  }

  reiniciar(): void {
    this.pausar();
    this.indiceEtapa.set(0);
    this.concluido.set(false);
    this.restanteMs.set((this.etapas()[0]?.intervalo.duracaoSegundos ?? 0) * 1000);
  }

  pular(passos: number): void {
    const destino = this.indiceEtapa() + passos;
    if (destino < 0 || destino >= this.totalEtapas()) return;

    this.irPara(destino);
    if (this.rodando()) {
      this.fimDaEtapaEm = Date.now() + this.restanteMs();
    }
  }

  private irPara(indice: number): void {
    this.indiceEtapa.set(indice);
    this.restanteMs.set((this.etapas()[indice]?.intervalo.duracaoSegundos ?? 0) * 1000);
    this.ultimoBipe = -1;
  }

  /* ------------------------------- Motor -------------------------------- */

  private tique(): void {
    const restante = Math.max(0, this.fimDaEtapaEm - Date.now());
    this.restanteMs.set(restante);

    const segundos = Math.ceil(restante / 1000);
    const aviso = this.preset().segundosAviso;

    // Bipe curto nos últimos segundos, uma vez por segundo.
    if (aviso > 0 && segundos > 0 && segundos <= aviso && segundos !== this.ultimoBipe) {
      this.ultimoBipe = segundos;
      this.bipe(660, 0.08);
    }

    if (restante > 0) return;

    const proximo = this.indiceEtapa() + 1;
    if (proximo >= this.totalEtapas()) {
      this.pausar();
      this.concluido.set(true);
      this.bipe(440, 0.5);
      return;
    }

    this.irPara(proximo);
    this.fimDaEtapaEm = Date.now() + this.restanteMs();
    this.bipe(880, 0.18);
  }

  private limparIntervalo(): void {
    if (this.intervalo !== null) {
      clearInterval(this.intervalo);
      this.intervalo = null;
    }
  }

  /* -------------------------------- Áudio -------------------------------- */

  /** O navegador só libera áudio depois de um gesto do usuário. */
  private async garantirAudio(): Promise<void> {
    if (!this.preset().avisoSonoro) return;
    try {
      this.audio ??= new AudioContext();
      if (this.audio.state === 'suspended') await this.audio.resume();
    } catch {
      this.audio = null;
    }
  }

  private bipe(frequencia: number, duracao: number): void {
    if (!this.preset().avisoSonoro || !this.audio) return;
    try {
      const oscilador = this.audio.createOscillator();
      const ganho = this.audio.createGain();
      oscilador.type = 'sine';
      oscilador.frequency.value = frequencia;
      // Envelope curto evita o "clique" no fim da nota.
      ganho.gain.setValueAtTime(0.0001, this.audio.currentTime);
      ganho.gain.exponentialRampToValueAtTime(0.25, this.audio.currentTime + 0.01);
      ganho.gain.exponentialRampToValueAtTime(0.0001, this.audio.currentTime + duracao);
      oscilador.connect(ganho).connect(this.audio.destination);
      oscilador.start();
      oscilador.stop(this.audio.currentTime + duracao);
    } catch {
      // Áudio indisponível: o cronômetro segue mudo.
    }
  }
}
