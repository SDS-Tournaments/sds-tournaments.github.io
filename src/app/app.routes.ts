import { Routes } from '@angular/router';
import { staffGuard } from './auth';
import { Home } from './pages/home';
import { Placeholder } from './pages/placeholder';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'standings', component: Placeholder, data: { key: 'nav.standings' } },
  { path: 'stages', component: Placeholder, data: { key: 'nav.stages' } },
  { path: 'pilots', component: Placeholder, data: { key: 'nav.pilots' } },
  { path: 'teams', component: Placeholder, data: { key: 'nav.teams' } },
  { path: 'archive', component: Placeholder, data: { key: 'nav.archive' } },
  { path: 'rules', component: Placeholder, data: { key: 'nav.rules' } },
  { path: 'me', loadComponent: () => import('./pages/me').then((m) => m.Me) },
  { path: 'auth/callback', loadComponent: () => import('./pages/auth-callback').then((m) => m.AuthCallback) },
  {
    path: 'admin',
    canActivate: [staffGuard],
    loadComponent: () => import('./admin/shell').then((m) => m.AdminShell),
    children: [
      { path: '', redirectTo: 'seasons', pathMatch: 'full' },
      { path: 'seasons', loadComponent: () => import('./admin/seasons').then((m) => m.AdminSeasons) },
      { path: 'seasons/:id', loadComponent: () => import('./admin/season').then((m) => m.AdminSeason) },
      { path: 'stages/:id', loadComponent: () => import('./admin/stage').then((m) => m.AdminStage) },
      { path: 'teams', loadComponent: () => import('./admin/teams').then((m) => m.AdminTeams) },
    ],
  },
  // Пульты — на всю ширину, без бокового меню админки
  { path: 'judge/:id', canActivate: [staffGuard], loadComponent: () => import('./admin/judge').then((m) => m.AdminJudge) },
  { path: 'dev/ui', loadComponent: () => import('./pages/ui-showcase').then((m) => m.UiShowcase) },
  { path: '**', redirectTo: '' },
];
