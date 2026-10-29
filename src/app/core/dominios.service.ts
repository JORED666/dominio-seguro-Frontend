import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { API_URL } from './api';
import { Analisis, Dominio, ResultadoAnalisis } from './modelos';

@Injectable({ providedIn: 'root' })
export class DominiosService {
  private http = inject(HttpClient);

  // Último análisis ejecutado (incluye certificado y subdominios, que no se guardan en la BD)
  readonly ultimoResultado = signal<ResultadoAnalisis | null>(null);

  listar() {
    return this.http.get<Dominio[]>(`${API_URL}/dominios`);
  }

  crear(nombre: string) {
    return this.http.post<Dominio>(`${API_URL}/dominios`, { nombre });
  }

  analizar(id: string) {
    return this.http
      .post<ResultadoAnalisis>(`${API_URL}/dominios/${id}/analizar`, {})
      .pipe(tap((r) => this.ultimoResultado.set(r)));
  }

  historial(id: string) {
    return this.http.get<Analisis[]>(`${API_URL}/dominios/${id}/analisis`);
  }
}
