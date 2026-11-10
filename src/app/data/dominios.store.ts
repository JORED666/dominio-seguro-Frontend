import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { DominiosService } from '../core/dominios.service';
import { Analisis, Dominio } from '../core/modelos';

/**
 * Estado compartido de los dominios y sus historiales de análisis.
 * Las páginas leen estas señales y llaman a los métodos de carga; ninguna
 * necesita hablar con la API ni repetir el forkJoin de historiales.
 */
@Injectable({ providedIn: 'root' })
export class DominiosStore {
  private api = inject(DominiosService);

  private _dominios = signal<Dominio[]>([]);
  private _historiales = signal<Record<string, Analisis[]>>({});

  readonly dominios = this._dominios.asReadonly();
  readonly historiales = this._historiales.asReadonly();

  // Último análisis ejecutado (incluye certificado y subdominios, que no se guardan en la BD)
  readonly ultimoResultado = this.api.ultimoResultado;

  // Historial de un dominio, del análisis más nuevo al más viejo
  historialDe(id: string): Analisis[] {
    return this._historiales()[id] ?? [];
  }

  // Trae solo la lista de dominios
  cargarLista(): Observable<Dominio[]> {
    return this.api.listar().pipe(tap((lista) => this._dominios.set(lista)));
  }

  // Trae el historial de los dominios que ya tienen análisis (si uno falla, queda vacío)
  cargarHistoriales(lista: Dominio[]): Observable<void> {
    const con = lista.filter((d) => d.nivel);
    if (!con.length) {
      this._historiales.set({});
      return of(undefined);
    }
    return forkJoin(con.map((d) => this.api.historial(d.id).pipe(catchError(() => of([] as Analisis[]))))).pipe(
      tap((res) => {
        const mapa: Record<string, Analisis[]> = {};
        con.forEach((d, i) => (mapa[d.id] = res[i]));
        this._historiales.set(mapa);
      }),
      map(() => undefined),
    );
  }

  // Lista + historiales
  cargarTodo(): Observable<Dominio[]> {
    return this.cargarLista().pipe(switchMap((lista) => this.cargarHistoriales(lista).pipe(map(() => lista))));
  }

  // Lista + historial de un solo dominio (pantalla de detalle). Si la API falla, el error llega al llamador.
  cargarDominio(id: string): Observable<void> {
    return forkJoin({ lista: this.api.listar(), hist: this.api.historial(id) }).pipe(
      tap(({ lista, hist }) => {
        this._dominios.set(lista);
        this._historiales.update((m) => ({ ...m, [id]: hist }));
      }),
      map(() => undefined),
    );
  }

  crear(nombre: string) {
    return this.api.crear(nombre);
  }

  analizar(id: string) {
    return this.api.analizar(id);
  }
}
