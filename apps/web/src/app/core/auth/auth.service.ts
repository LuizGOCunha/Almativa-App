import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Role, type SessaoDto, type UsuarioDto } from '@almativa/shared';
import { environment } from '../../../environments/environment';
import {
  CHAVE_ACCESS,
  CHAVE_REFRESH,
  CHAVE_TOKEN_TV,
  CHAVE_USUARIO,
  ROTA_INICIAL,
} from './sessao.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly base = `${environment.apiUrl}/auth`;

  private readonly _usuario = signal<UsuarioDto | null>(lerUsuarioSalvo());
  private readonly _carregando = signal(false);

  readonly usuario = this._usuario.asReadonly();
  readonly carregando = this._carregando.asReadonly();
  readonly autenticado = computed(() => this._usuario() !== null);
  readonly ehAdmin = computed(() => this._usuario()?.role === Role.ADMIN);
  readonly ehAluno = computed(() => this._usuario()?.role === Role.ALUNO);
  readonly ehTv = computed(() => this._usuario()?.role === Role.AULA);
  readonly primeiroNome = computed(() => this._usuario()?.nome.split(' ')[0] ?? '');

  get accessToken(): string | null {
    return localStorage.getItem(CHAVE_ACCESS);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(CHAVE_REFRESH);
  }

  async entrar(email: string, senha: string): Promise<UsuarioDto> {
    this._carregando.set(true);
    try {
      const sessao = await firstValueFrom(
        this.http.post<SessaoDto>(`${this.base}/login`, { email, senha }),
      );
      this.guardarSessao(sessao);
      return sessao.usuario;
    } finally {
      this._carregando.set(false);
    }
  }

  async registrar(
    email: string,
    nome: string,
    senha: string,
    role: Role,
  ): Promise<UsuarioDto> {
    this._carregando.set(true);
    try {
      const sessao = await firstValueFrom(
        this.http.post<SessaoDto>(`${this.base}/registrar`, { email, nome, senha, role }),
      );
      this.guardarSessao(sessao);
      return sessao.usuario;
    } finally {
      this._carregando.set(false);
    }
  }

  /** Pareia a tela da sala usando o token gerado pelo admin. */
  async entrarComoTv(token: string): Promise<UsuarioDto> {
    const sessao = await firstValueFrom(
      this.http.post<SessaoDto>(`${this.base}/dispositivos/parear`, { token }),
    );
    this.guardarSessao(sessao);
    localStorage.setItem(CHAVE_TOKEN_TV, token);
    return sessao.usuario;
  }

  /** Reconecta a TV automaticamente quando o access token expira. */
  async reconectarTv(): Promise<boolean> {
    const token = localStorage.getItem(CHAVE_TOKEN_TV);
    if (!token) return false;
    try {
      await this.entrarComoTv(token);
      return true;
    } catch {
      return false;
    }
  }

  async renovar(): Promise<string | null> {
    const refreshToken = this.refreshToken;
    if (!refreshToken) return null;

    const sessao = await firstValueFrom(
      this.http.post<SessaoDto>(`${this.base}/refresh`, { refreshToken }),
    );
    this.guardarSessao(sessao);
    return sessao.accessToken;
  }

  async recarregarPerfil(): Promise<void> {
    if (!this.accessToken) return;
    try {
      const usuario = await firstValueFrom(this.http.get<UsuarioDto>(`${this.base}/me`));
      this._usuario.set(usuario);
      localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
    } catch {
      this.limparSessao();
    }
  }

  async trocarSenha(senhaAtual: string, novaSenha: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.base}/trocar-senha`, { senhaAtual, novaSenha }));
    await this.recarregarPerfil();
  }

  async sair(redirecionar = true): Promise<void> {
    const refreshToken = this.refreshToken;
    try {
      if (this.accessToken) {
        await firstValueFrom(this.http.post(`${this.base}/logout`, { refreshToken }));
      }
    } catch {
      // Mesmo se a API falhar, a sessao local precisa cair.
    }
    this.limparSessao();
    if (redirecionar) void this.router.navigate(['/entrar']);
  }

  rotaInicial(): string {
    const usuario = this._usuario();
    return usuario ? ROTA_INICIAL[usuario.role] : '/';
  }

  private guardarSessao(sessao: SessaoDto): void {
    localStorage.setItem(CHAVE_ACCESS, sessao.accessToken);
    if (sessao.refreshToken) localStorage.setItem(CHAVE_REFRESH, sessao.refreshToken);
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(sessao.usuario));
    this._usuario.set(sessao.usuario);
  }

  limparSessao(): void {
    localStorage.removeItem(CHAVE_ACCESS);
    localStorage.removeItem(CHAVE_REFRESH);
    localStorage.removeItem(CHAVE_USUARIO);
    this._usuario.set(null);
  }
}

function lerUsuarioSalvo(): UsuarioDto | null {
  try {
    const bruto = localStorage.getItem(CHAVE_USUARIO);
    return bruto ? (JSON.parse(bruto) as UsuarioDto) : null;
  } catch {
    return null;
  }
}
