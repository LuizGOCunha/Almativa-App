import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    title: 'Visão geral — Almativa',
    loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'alunos',
    title: 'Alunos — Almativa',
    loadComponent: () => import('./alunos/lista-alunos/lista-alunos').then((m) => m.ListaAlunos),
  },
  {
    path: 'alunos/:id',
    title: 'Aluno — Almativa',
    loadComponent: () =>
      import('./alunos/detalhe-aluno/detalhe-aluno').then((m) => m.DetalheAluno),
  },
  {
    path: 'agenda',
    title: 'Agenda — Almativa',
    loadComponent: () => import('./agenda/agenda').then((m) => m.Agenda),
  },
  {
    path: 'financeiro',
    title: 'Financeiro — Almativa',
    loadComponent: () => import('./financeiro/financeiro').then((m) => m.Financeiro),
  },
  {
    path: 'renovacoes',
    title: 'Renovações — Almativa',
    loadComponent: () => import('./renovacoes/renovacoes').then((m) => m.Renovacoes),
  },
  {
    path: 'frequencia',
    title: 'Frequência — Almativa',
    loadComponent: () => import('./frequencia/frequencia').then((m) => m.Frequencia),
  },
  {
    path: 'comunicacao',
    title: 'Comunicação — Almativa',
    loadComponent: () => import('./comunicacao/comunicacao').then((m) => m.Comunicacao),
  },
  {
    path: 'sala',
    title: 'Tela da sala — Almativa',
    loadComponent: () => import('./sala/sala').then((m) => m.Sala),
  },
  {
    path: 'configuracoes',
    title: 'Configurações — Almativa',
    loadComponent: () => import('./configuracoes/configuracoes').then((m) => m.Configuracoes),
  },
  { path: '**', redirectTo: '' },
];
