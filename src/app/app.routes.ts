import { Routes } from '@angular/router';
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
  { path: 'me', component: Placeholder, data: { key: 'nav.me' } },
  { path: 'auth/callback', loadComponent: () => import('./pages/auth-callback').then((m) => m.AuthCallback) },
  { path: 'dev/ui', loadComponent: () => import('./pages/ui-showcase').then((m) => m.UiShowcase) },
  { path: '**', redirectTo: '' },
];
