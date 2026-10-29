import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';
import { staffGuard } from './auth';
import { Home } from './pages/home';

/** публичная страница — подгрузить заранее (preload.ts) */
const P = { preload: true };

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'standings', data: P, title: 'Зачёт сезона', loadComponent: () => import('./pages/standings').then((m) => m.Standings) },
  { path: 'stages', data: P, title: 'Этапы сезона', loadComponent: () => import('./pages/stages').then((m) => m.Stages) },
  { path: 'stages/:id', data: P, loadComponent: () => import('./pages/stage').then((m) => m.StagePage) },
  { path: 'pilots', data: P, title: 'Пилоты', loadComponent: () => import('./pages/pilots').then((m) => m.Pilots) },
  { path: 'pilots/:steamId', data: P, loadComponent: () => import('./pages/pilot').then((m) => m.PilotPage) },
  { path: 'teams', data: P, title: 'Команды', loadComponent: () => import('./pages/teams').then((m) => m.Teams) },
  { path: 'teams/:id', data: P, loadComponent: () => import('./pages/team').then((m) => m.TeamPage) },
  { path: 'archive', data: P, title: 'Архив сезонов', loadComponent: () => import('./pages/archive').then((m) => m.Archive) },
  { path: 'rules', data: P, title: 'Регламент', loadComponent: () => import('./pages/rules').then((m) => m.Rules) },
  { path: 'me', data: P, title: 'Личный кабинет', loadComponent: () => import('./pages/me').then((m) => m.Me) },
  { path: 'auth/callback', loadComponent: () => import('./pages/auth-callback').then((m) => m.AuthCallback) },
  { path: 'auth/steam', loadComponent: () => import('./pages/auth-callback').then((m) => m.SteamReturn) },
  {
    path: 'admin',
    title: 'Админка',
    canActivate: [staffGuard],
    loadComponent: () => import('./admin/shell').then((m) => m.AdminShell),
    children: [
      { path: '', redirectTo: 'seasons', pathMatch: 'full' },
      { path: 'seasons', loadComponent: () => import('./admin/seasons').then((m) => m.AdminSeasons) },
      { path: 'seasons/:id', loadComponent: () => import('./admin/season').then((m) => m.AdminSeason) },
      { path: 'stages/:id', loadComponent: () => import('./admin/stage').then((m) => m.AdminStage) },
      { path: 'teams', loadComponent: () => import('./admin/teams').then((m) => m.AdminTeams) },
      { path: 'protests', loadComponent: () => import('./admin/protests').then((m) => m.AdminProtests) },
      { path: 'discord', loadComponent: () => import('./admin/discord').then((m) => m.AdminDiscord) },
      { path: 'settings', loadComponent: () => import('./admin/settings').then((m) => m.AdminSettings) },
      { path: 'sponsors', loadComponent: () => import('./admin/sponsors').then((m) => m.AdminSponsors) },
      { path: 'pilots', loadComponent: () => import('./admin/pilots').then((m) => m.AdminPilots) },
    ],
  },
  // Пульты — на всю ширину, без бокового меню админки
  { path: 'judge/:id', canActivate: [staffGuard], loadComponent: () => import('./admin/judge').then((m) => m.AdminJudge) },
  { path: 'commentator/:id', canActivate: [staffGuard], title: 'Пульт комментатора', loadComponent: () => import('./commentator/commentator').then((m) => m.Commentator) },
  { path: 'broadcast', canActivate: [staffGuard], loadComponent: () => import('./overlay/broadcast').then((m) => m.Broadcast) },
  // Плашки для OBS — публичная страница без шапки и подвала
  { path: 'overlay', loadComponent: () => import('./overlay/overlay').then((m) => m.Overlay) },
  // UI kit — только в локальной разработке; на опубликованном сайте адрес ведёт на главную
  { path: 'dev/ui', canMatch: [() => isDevMode()], loadComponent: () => import('./pages/ui-showcase').then((m) => m.UiShowcase) },
  // главная в коллаборации с Attack Shark — по прямой ссылке, в меню нет
  { path: 'attack-shark', loadComponent: () => import('./pages/shark').then((m) => m.SharkHome) },
  { path: '**', redirectTo: '' },
];
