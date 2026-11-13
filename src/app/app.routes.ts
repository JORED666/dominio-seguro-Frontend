import { Routes } from '@angular/router';
import { authGuard, invitadoGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [invitadoGuard],
    loadComponent: () => import('./features/landing/landing.page').then((m) => m.Landing),
  },
  { path: 'login', loadComponent: () => import('./features/login/login.page').then((m) => m.Login) },
  {
    path: 'registro',
    loadComponent: () => import('./features/registro/registro.page').then((m) => m.Registro),
  },
  {
    path: 'dominios',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dominios/dominios.page').then((m) => m.Dominios),
  },
  {
    path: 'dominios/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/resultado/resultado.page').then((m) => m.Resultado),
  },
  {
    path: 'historial',
    canActivate: [authGuard],
    loadComponent: () => import('./features/historial/historial.page').then((m) => m.Historial),
  },
  {
    path: 'historial',
    canActivate: [authGuard],
    loadComponent: () => import('./features/historial/historial.page').then((m) => m.Historial),
  },
  {
    path: 'alertas',
    canActivate: [authGuard],
    loadComponent: () => import('./features/alertas/alertas.page').then((m) => m.Alertas),
  },
  {
    path: 'similares',
    canActivate: [authGuard],
    loadComponent: () => import('./features/similares/similares.page').then((m) => m.Similares),
  },
  { path: '**', redirectTo: '' },
];
