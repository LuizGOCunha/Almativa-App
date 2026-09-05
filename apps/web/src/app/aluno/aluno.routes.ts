import { Routes } from '@angular/router';

export const ALUNO_ROUTES: Routes = [
  {
    path: '',
    title: 'Início — Almativa',
    loadComponent: () => import('./inicio/inicio').then((m) => m.Inicio),
  },
  {
    path: 'agenda',
    title: 'Agenda — Almativa',
    loadComponent: () => import('./agenda-aluno/agenda-aluno').then((m) => m.AgendaAluno),
  },
  {
    path: 'frequencia',
    title: 'Minha frequência — Almativa',
    loadComponent: () =>
      import('./frequencia-aluno/frequencia-aluno').then((m) => m.FrequenciaAluno),
  },
  {
    path: 'mensalidades',
    title: 'Mensalidades — Almativa',
    loadComponent: () =>
      import('./mensalidades-aluno/mensalidades-aluno').then((m) => m.MensalidadesAluno),
  },
  {
    path: 'notificacoes',
    title: 'Avisos — Almativa',
    loadComponent: () =>
      import('./notificacoes-aluno/notificacoes-aluno').then((m) => m.NotificacoesAluno),
  },
  {
    path: 'perfil',
    title: 'Meus dados — Almativa',
    loadComponent: () => import('./perfil-aluno/perfil-aluno').then((m) => m.PerfilAluno),
  },
  { path: '**', redirectTo: '' },
];
