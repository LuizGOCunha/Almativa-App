import { Routes } from '@angular/router';
import { Role } from '@almativa/shared';
import { guardaAutenticado, guardaPerfil, guardaVisitante } from './core/auth/auth.guard';

export const routes: Routes = [
  // ---------------------------------------------------------------- Publico
  {
    path: '',
    loadComponent: () =>
      import('./layouts/publico-layout/publico-layout').then((m) => m.PublicoLayout),
    children: [
      {
        path: '',
        title: 'Almativa — Pilates, Jiu-Jitsu e Fisioterapia',
        loadComponent: () => import('./publico/home/home').then((m) => m.Home),
      },
      {
        path: 'modalidades',
        title: 'Modalidades — Almativa',
        loadComponent: () =>
          import('./publico/modalidades/modalidades').then((m) => m.Modalidades),
      },
      {
        path: 'horarios',
        title: 'Horários — Almativa',
        loadComponent: () => import('./publico/horarios/horarios').then((m) => m.Horarios),
      },
      {
        path: 'planos',
        title: 'Planos — Almativa',
        loadComponent: () => import('./publico/planos/planos').then((m) => m.Planos),
      },
      {
        path: 'contato',
        title: 'Contato — Almativa',
        loadComponent: () => import('./publico/contato/contato').then((m) => m.Contato),
      },
    ],
  },

  // ------------------------------------------------------------------ Login
  {
    path: 'entrar',
    title: 'Entrar — Almativa',
    canActivate: [guardaVisitante],
    loadComponent: () => import('./auth/entrar/entrar').then((m) => m.Entrar),
  },
  {
    path: 'tv/parear',
    title: 'Parear tela da sala — Almativa',
    loadComponent: () => import('./auth/parear-tv/parear-tv').then((m) => m.PareaTv),
  },

  // ------------------------------------------------------------------ Admin
  {
    path: 'admin',
    canActivate: [guardaAutenticado, guardaPerfil(Role.ADMIN)],
    loadComponent: () => import('./layouts/admin-layout/admin-layout').then((m) => m.AdminLayout),
    loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },

  // ------------------------------------------------------------------ Aluno
  {
    path: 'aluno',
    canActivate: [guardaAutenticado, guardaPerfil(Role.ALUNO)],
    loadComponent: () => import('./layouts/aluno-layout/aluno-layout').then((m) => m.AlunoLayout),
    loadChildren: () => import('./aluno/aluno.routes').then((m) => m.ALUNO_ROUTES),
  },

  // ------------------------------------------------- Tela da sala (perfil AULA)
  {
    path: 'tv',
    title: 'Sala — Almativa',
    canActivate: [guardaAutenticado, guardaPerfil(Role.AULA, Role.ADMIN)],
    loadComponent: () => import('./tv/painel-sala/painel-sala').then((m) => m.PainelSala),
  },

  { path: '**', redirectTo: '' },
];
