import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, of } from 'rxjs';
import {
  extrairVideoIdYoutube,
  formatarCronometro,
  type ModalidadeDto,
  type PlaylistDto,
  type TimerPresetDto,
} from '@almativa/shared';
import { TvApi, type DispositivoDto } from '../../core/api/tv.api';
import { CatalogoApi } from '../../core/api/catalogo.api';
import { AvisoService } from '../../core/ui/aviso.service';
import { ConfirmacaoDialog } from '../../core/ui/confirmacao.dialog';
import { EstadoVazio } from '../../shared/estado-vazio/estado-vazio';
import { SenhaProvisoriaDialog } from '../alunos/senha-provisoria.dialog';
import { FormTimerDialog } from './form-timer.dialog';

/** Configuração da tela que roda na TV da sala: timers, playlists e pareamento. */
@Component({
  selector: 'app-sala',
  imports: [
    DatePipe,
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatProgressBarModule,
    EstadoVazio,
  ],
  templateUrl: './sala.html',
  styleUrl: './sala.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sala {
  private readonly api = inject(TvApi);
  private readonly catalogo = inject(CatalogoApi);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly aviso = inject(AvisoService);

  readonly timers = signal<TimerPresetDto[]>([]);
  readonly playlists = signal<PlaylistDto[]>([]);
  readonly dispositivos = signal<DispositivoDto[]>([]);
  readonly carregando = signal(false);

  readonly modalidades = toSignal(
    this.catalogo.modalidades(true).pipe(catchError(() => of([] as ModalidadeDto[]))),
    { initialValue: [] as ModalidadeDto[] },
  );

  /** Formulário rápido de playlist: cola o link do YouTube e pronto. */
  readonly formPlaylist = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.minLength(2)]],
    modalidadeId: [''],
    videos: ['', Validators.required],
    somenteAudio: [true],
    volumePadrao: [40],
  });

  readonly formDispositivo = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.minLength(2)]],
    sala: [''],
  });

  constructor() {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      const [timers, playlists, dispositivos] = await Promise.all([
        firstValueFrom(this.api.timers({ todos: true })),
        firstValueFrom(this.api.playlists({ todas: true })),
        firstValueFrom(this.api.dispositivos()),
      ]);
      this.timers.set(timers);
      this.playlists.set(playlists);
      this.dispositivos.set(dispositivos);
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível carregar as configurações da sala.');
    } finally {
      this.carregando.set(false);
    }
  }

  duracao(segundos: number): string {
    return formatarCronometro(segundos);
  }

  /* -------------------------------- Timers ------------------------------ */

  async editarTimer(timer?: TimerPresetDto): Promise<void> {
    const ref = this.dialog.open(FormTimerDialog, { data: { timer } });
    if (await firstValueFrom(ref.afterClosed())) await this.carregar();
  }

  async removerTimer(timer: TimerPresetDto): Promise<void> {
    const ref = this.dialog.open(ConfirmacaoDialog, {
      data: {
        titulo: `Excluir "${timer.nome}"?`,
        mensagem: 'O preset some da tela da sala. Isso não pode ser desfeito.',
        confirmar: 'Excluir',
        destrutivo: true,
        icone: 'timer_off',
      },
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;

    try {
      await firstValueFrom(this.api.removerTimer(timer.id));
      this.aviso.sucesso('Timer removido.');
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro);
    }
  }

  /* ------------------------------ Playlists ----------------------------- */

  async criarPlaylist(): Promise<void> {
    if (this.formPlaylist.invalid) {
      this.formPlaylist.markAllAsTouched();
      return;
    }

    const v = this.formPlaylist.getRawValue();

    // Uma linha por vídeo: "titulo | link" ou só o link.
    const itens = v.videos
      .split('\n')
      .map((linha) => linha.trim())
      .filter(Boolean)
      .map((linha) => {
        const [parte1, parte2] = linha.split('|').map((p) => p.trim());
        const bruto = parte2 ?? parte1;
        const titulo = parte2 ? parte1 : 'Vídeo do YouTube';
        return { videoId: bruto, titulo, duracaoSegundos: null, inicioEm: null };
      })
      .filter((item) => extrairVideoIdYoutube(item.videoId) !== null);

    if (itens.length === 0) {
      this.aviso.erro(null, 'Nenhum link válido do YouTube foi reconhecido.');
      return;
    }

    try {
      await firstValueFrom(
        this.api.criarPlaylist({
          nome: v.nome,
          descricao: null,
          modalidadeId: v.modalidadeId || null,
          itens,
          somenteAudio: v.somenteAudio,
          volumePadrao: v.volumePadrao,
          embaralhar: false,
        }),
      );
      this.aviso.sucesso(`Playlist criada com ${itens.length} vídeo(s).`);
      this.formPlaylist.reset({ somenteAudio: true, volumePadrao: 40, modalidadeId: '' });
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível criar a playlist.');
    }
  }

  async removerPlaylist(playlist: PlaylistDto): Promise<void> {
    const ref = this.dialog.open(ConfirmacaoDialog, {
      data: {
        titulo: `Excluir "${playlist.nome}"?`,
        mensagem: 'A playlist deixa de aparecer na tela da sala.',
        confirmar: 'Excluir',
        destrutivo: true,
        icone: 'playlist_remove',
      },
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;

    try {
      await firstValueFrom(this.api.removerPlaylist(playlist.id));
      this.aviso.sucesso('Playlist removida.');
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro);
    }
  }

  /* ----------------------------- Dispositivos --------------------------- */

  async criarDispositivo(): Promise<void> {
    if (this.formDispositivo.invalid) {
      this.formDispositivo.markAllAsTouched();
      return;
    }

    const v = this.formDispositivo.getRawValue();
    try {
      const r = await firstValueFrom(this.api.criarDispositivo(v.nome, v.sala || null));
      // Reaproveita o diálogo de credenciais: o token só aparece uma vez.
      this.dialog.open(SenhaProvisoriaDialog, {
        data: { email: r.nomeDispositivo, senha: r.token },
      });
      this.formDispositivo.reset();
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro, 'Não foi possível cadastrar o dispositivo.');
    }
  }

  async revogarDispositivo(dispositivo: DispositivoDto): Promise<void> {
    const ref = this.dialog.open(ConfirmacaoDialog, {
      data: {
        titulo: `Revogar "${dispositivo.nome}"?`,
        mensagem: 'A TV perde o acesso imediatamente e precisará ser pareada de novo.',
        confirmar: 'Revogar',
        destrutivo: true,
        icone: 'cast_warning',
      },
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;

    try {
      await firstValueFrom(this.api.revogarDispositivo(dispositivo.id));
      this.aviso.sucesso('Dispositivo revogado.');
      await this.carregar();
    } catch (erro) {
      this.aviso.erro(erro);
    }
  }
}
