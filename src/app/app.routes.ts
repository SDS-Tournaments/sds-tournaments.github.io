import { Routes } from '@angular/router';
import { staffGuard } from './auth';
import { Home } from './pages/home';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'standings', loadComponent: () => import('./pages/standings').then((m) => m.Standings) },
  { path: 'stages', loadComponent: () => import('./pages/stages').then((m) => m.Stages) },
  { path: 'stages/:id', loadComponent: () => import('./pages/stage').then((m) => m.StagePage) },
  { path: 'pilots', loadComponent: () => import('./pages/pilots').then((m) => m.Pilots) },
  { path: 'pilots/:steamId', loadComponent: () => import('./pages/pilot').then((m) => m.PilotPage) },
  { path: 'teams', loadComponent: () => import('./pages/teams').then((m) => m.Teams) },
  { path: 'teams/:id', loadComponent: () => import('./pages/team').then((m) => m.TeamPage) },
  { path: 'archive', loadComponent: () => import('./pages/archive').then((m) => m.Archive) },
  { path: 'rules', loadComponent: () => import('./pages/rules').then((m) => m.Rules) },
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
      { path: 'protests', loadComponent: () => import('./admin/protests').then((m) => m.AdminProtests) },
      { path: 'settings', loadComponent: () => import('./admin/settings').then((m) => m.AdminSettings) },
      { path: 'sponsors', loadComponent: () => import('./admin/sponsors').then((m) => m.AdminSponsors) },
      { path: 'pilots', loadComponent: () => import('./admin/pilots').then((m) => m.AdminPilots) },
    ],
  },
  // Пульты — на всю ширину, без бокового меню админки
  { path: 'judge/:id', canActivate: [staffGuard], loadComponent: () => import('./admin/judge').then((m) => m.AdminJudge) },
  { path: 'broadcast', canActivate: [staffGuard], loadComponent: () => import('./overlay/broadcast').then((m) => m.Broadcast) },
  // Плашки для OBS — публичная страница без шапки и подвала
  { path: 'overlay', loadComponent: () => import('./overlay/overlay').then((m) => m.Overlay) },
  { path: 'dev/ui', loadComponent: () => import('./pages/ui-showcase').then((m) => m.UiShowcase) },
  { path: '**', redirectTo: '' },
];
