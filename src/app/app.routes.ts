import { Routes } from '@angular/router';
import { authGuard, invitadoGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [invitadoGuard],
    loadComponent: () => import('./pages/landing/landing').then((m) => m.Landing),
  },
  { path: 'login', loadComponent: () => import('./pages/login/login').then((m) => m.Login) },
  {
    path: 'registro',
    loadComponent: () => import('./pages/registro/registro').then((m) => m.Registro),
  },
  {
    path: 'dominios',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dominios/dominios').then((m) => m.Dominios),
  },
  {
    path: 'dominios/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/resultado/resultado').then((m) => m.Resultado),
  },
  { path: '**', redirectTo: '' },
];
