import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../core/auth/auth.service';
import { LogoAlmativa } from '../../shared/logo/logo';
import { IniciaisPipe } from '../../core/pipes/formato.pipes';

export interface ItemNavegacao {
  rota: string;
  rotulo: string;
  icone: string;
  /** Rotas-filhas também marcam o item como ativo. */
  exato?: boolean;
  /** Nome do contador exposto por `contadores()`. */
  contador?: string;
}

/**
 * Casca das áreas logadas: barra lateral em telas largas, gaveta no mobile.
 * Admin e aluno compartilham este componente e só trocam os itens do menu.
 */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatBadgeModule,
    MatDividerModule,
    LogoAlmativa,
    IniciaisPipe,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  readonly itens = input.required<ItemNavegacao[]>();
  readonly areaRotulo = input('Painel');
  readonly contadores = input<Record<string, number>>({});

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly usuario = this.auth.usuario;
  readonly primeiroNome = this.auth.primeiroNome;
  readonly gavetaAberta = signal(false);

  alternarGaveta(): void {
    this.gavetaAberta.update((v) => !v);
  }

  fecharGaveta(): void {
    this.gavetaAberta.set(false);
  }

  contadorDe(nome: string | undefined): number {
    return nome ? (this.contadores()[nome] ?? 0) : 0;
  }

  async sair(): Promise<void> {
    await this.auth.sair();
  }

  irParaSite(): void {
    void this.router.navigate(['/']);
  }
}
