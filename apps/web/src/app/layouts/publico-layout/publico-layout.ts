import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { LogoAlmativa } from '../../shared/logo/logo';
import { AuthService } from '../../core/auth/auth.service';

interface ItemMenu {
  rota: string;
  rotulo: string;
}

@Component({
  selector: 'app-publico-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    LogoAlmativa,
  ],
  templateUrl: './publico-layout.html',
  styleUrl: './publico-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicoLayout {
  private readonly auth = inject(AuthService);

  readonly menuAberto = signal(false);
  readonly autenticado = this.auth.autenticado;
  readonly anoAtual = new Date().getFullYear();

  readonly itens: ItemMenu[] = [
    { rota: '/modalidades', rotulo: 'Modalidades' },
    { rota: '/horarios', rotulo: 'Horários' },
    { rota: '/planos', rotulo: 'Planos' },
    { rota: '/contato', rotulo: 'Contato' },
  ];

  rotaDaArea(): string {
    return this.auth.rotaInicial();
  }

  alternarMenu(): void {
    this.menuAberto.update((v) => !v);
  }

  fecharMenu(): void {
    this.menuAberto.set(false);
  }
}
