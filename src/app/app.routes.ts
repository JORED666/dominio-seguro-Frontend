import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dominios' },
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
  { path: '**', redirectTo: 'dominios' },
];
