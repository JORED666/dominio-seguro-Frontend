import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { API_URL } from './api-url';
import { Analisis, Dominio, ResultadoAnalisis, Verificacion } from '../modelos';
import { SimilarApi } from '../../domain/similares';

@Injectable({ providedIn: 'root' })
export class DominiosApi {
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

  verificacion(id: string) {
    return this.http.get<Verificacion>(`${API_URL}/dominios/${id}/verificacion`);
  }

  verificar(id: string) {
    return this.http.post<Verificacion>(`${API_URL}/dominios/${id}/verificar`, {});
  }

  historial(id: string) {
    return this.http.get<Analisis[]>(`${API_URL}/dominios/${id}/analisis`);
  }

  similares(id: string) {
    return this.http.get<SimilarApi[]>(`${API_URL}/dominios/${id}/similares`);
  }

  marcarSimilar(id: string, similarId: string, cambios: { propio?: boolean; revisado?: boolean }) {
    return this.http.patch<SimilarApi>(`${API_URL}/dominios/${id}/similares/${similarId}`, cambios);
  }
}
