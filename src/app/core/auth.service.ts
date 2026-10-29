import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { API_URL } from './api';

interface Sesion {
  token: string;
  usuario: { id: string; nombre: string; correo: string };
}

const CLAVE = 'ds_sesion';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private sesion = signal<Sesion | null>(this.leer());
  readonly usuario = computed(() => this.sesion()?.usuario ?? null);
  readonly autenticado = computed(() => this.sesion() !== null);

  get token(): string | null {
    return this.sesion()?.token ?? null;
  }

  login(correo: string, password: string) {
    return this.http
      .post<Sesion>(`${API_URL}/auth/login`, { correo, password })
      .pipe(tap((s) => this.guardar(s)));
  }

  registro(nombre: string, correo: string, password: string) {
    return this.http
      .post<Sesion>(`${API_URL}/auth/registro`, { nombre, correo, password })
      .pipe(tap((s) => this.guardar(s)));
  }

  cerrarSesion() {
    this.sesion.set(null);
    sessionStorage.removeItem(CLAVE);
    this.router.navigate(['/login']);
  }

  // sessionStorage: la sesión se borra al cerrar la pestaña
  private guardar(s: Sesion) {
    this.sesion.set(s);
    sessionStorage.setItem(CLAVE, JSON.stringify(s));
  }

  private leer(): Sesion | null {
    try {
      return JSON.parse(sessionStorage.getItem(CLAVE) ?? 'null');
    } catch {
      return null;
    }
  }
}
