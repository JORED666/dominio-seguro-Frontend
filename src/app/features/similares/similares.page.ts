import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { DominiosApi } from '../../core/api/dominios.api';
import { mensajeError } from '../../core/modelos';
import { DominiosStore } from '../../data/dominios.store';
import { aSimilar, ORDEN_RIESGO, Similar } from '../../domain/similares';
import { crearAnimacion } from '../../shared/utils/animacion';
import { SimilarCard } from './componentes/similar-card/similar-card';

type Filtro = 'todos' | 'alto' | 'registrados' | 'libres';
type Cambios = { propio?: boolean; revisado?: boolean };

// Un similar "apartado" es el que el usuario ya revisó o marcó como suyo
const apartado = (s: Similar) => s.revisado || s.propio;

@Component({
  selector: 'app-similares',
  imports: [RouterLink, SimilarCard],
  templateUrl: './similares.page.html',
  styleUrl: './similares.page.css',
})
export class Similares {
  private store = inject(DominiosStore);
  private api = inject(DominiosApi);

  filtros: { valor: Filtro; texto: string }[] = [
    { valor: 'todos', texto: 'Todos' },
    { valor: 'alto', texto: 'Riesgo alto' },
    { valor: 'registrados', texto: 'Ya registrados' },
    { valor: 'libres', texto: 'Sin registros' },
  ];

  cargando = signal(true);
  error = signal('');
  nota = signal('');
  vigilados = signal<{ id: string; nombre: string }[]>([]);
  similares = signal<Similar[]>([]);

  filtro = signal<Filtro>('todos');
  dominioSel = signal('');
  verRevisados = signal(false);
  revisados = computed(() => this.similares().filter(apartado).map((s) => s.id));

  private anim = crearAnimacion(900);
  k = this.anim.k;

  private delDominio = computed(() => {
    const d = this.dominioSel();
    return this.similares().filter((s) => !d || s.dominioId === d);
  });

  private visibles = computed(() => {
    const ver = this.verRevisados();
    return this.delDominio().filter((s) => apartado(s) === ver);
  });

  cuentas = computed(() => {
    const l = this.delDominio().filter((s) => !apartado(s));
    return {
      encontrados: l.filter((s) => s.estado !== 'libre').length,
      altos: l.filter((s) => s.riesgo === 'alto').length,
      libres: l.filter((s) => s.estado === 'libre').length,
    };
  });

  private coincide(s: Similar, f: Filtro): boolean {
    return f === 'todos' || (f === 'alto' && s.riesgo === 'alto') || (f === 'registrados' && s.estado !== 'libre') || (f === 'libres' && s.estado === 'libre');
  }

  cuentaFiltro(f: Filtro): number {
    return this.visibles().filter((s) => this.coincide(s, f)).length;
  }

  // Agrupados por el dominio que se protege; dentro, lo más riesgoso primero
  grupos = computed(() => {
    const f = this.filtro();
    const lista = this.visibles()
      .filter((s) => this.coincide(s, f))
      .sort((a, b) => ORDEN_RIESGO[a.riesgo] - ORDEN_RIESGO[b.riesgo] || (b.detectadoEn ?? 0) - (a.detectadoEn ?? 0));
    return this.vigilados()
      .map((d) => ({ dominio: d.nombre, items: lista.filter((s) => s.dominioId === d.id) }))
      .filter((g) => g.items.length > 0);
  });

  constructor() {
    this.cargar();
  }

  n(v: number): number {
    return this.anim.n(v);
  }

  revisar(id: string) {
    this.marcar(id, { revisado: true });
  }

  esMio(id: string) {
    this.marcar(id, { propio: true }, 'Listo: dejará de contarse como amenaza en el puntaje desde tu próximo análisis.');
  }

  restaurar(id: string) {
    this.marcar(id, { revisado: false, propio: false });
  }

  private marcar(id: string, cambios: Cambios, nota = '') {
    const s = this.similares().find((x) => x.id === id);
    if (!s) return;
    this.error.set('');
    this.api.marcarSimilar(s.dominioId, id, cambios).subscribe({
      next: (r) => {
        this.similares.update((l) => l.map((x) => (x.id === id ? aSimilar(r, x.original) : x)));
        this.nota.set(nota);
        if (!this.revisados().length) this.verRevisados.set(false);
      },
      error: (e) => this.error.set(mensajeError(e)),
    });
  }

  private cargar() {
    this.store
      .cargarLista()
      .pipe(
        switchMap((lista) => {
          const peticiones = lista.map((d) => this.api.similares(d.id).pipe(map((rs) => rs.map((r) => aSimilar(r, d.nombreDominio)))));
          return (peticiones.length ? forkJoin(peticiones) : of([] as Similar[][])).pipe(map((grupos) => ({ lista, similares: grupos.flat() })));
        }),
      )
      .subscribe({
        next: ({ lista, similares }) => {
          this.vigilados.set(lista.map((d) => ({ id: d.id, nombre: d.nombreDominio })));
          this.similares.set(similares);
          this.cargando.set(false);
          this.anim.iniciar();
        },
        error: (e) => {
          this.error.set(mensajeError(e));
          this.cargando.set(false);
        },
      });
  }
}
