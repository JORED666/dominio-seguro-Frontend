import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { mensajeError } from '../../core/modelos';
import { DominiosStore } from '../../data/dominios.store';
import { DATOS_DE_EJEMPLO, ORDEN_RIESGO, Similar, simularSimilares } from '../../domain/similares';
import { crearAnimacion } from '../../shared/utils/animacion';
import { guardarLista, leerLista } from '../../shared/utils/almacen';
import { SimilarCard } from './componentes/similar-card/similar-card';

type Filtro = 'todos' | 'alto' | 'registrados' | 'libres';
const CLAVE_REVISADOS = 'ds-similares-revisados';

@Component({
  selector: 'app-similares',
  imports: [RouterLink, SimilarCard],
  templateUrl: './similares.page.html',
  styleUrl: './similares.page.css',
})
export class Similares {
  private store = inject(DominiosStore);

  readonly esEjemplo = DATOS_DE_EJEMPLO;
  filtros: { valor: Filtro; texto: string }[] = [
    { valor: 'todos', texto: 'Todos' },
    { valor: 'alto', texto: 'Riesgo alto' },
    { valor: 'registrados', texto: 'Ya registrados' },
    { valor: 'libres', texto: 'Disponibles' },
  ];

  cargando = signal(true);
  error = signal('');
  vigilados = signal<{ id: string; nombre: string }[]>([]);
  similares = signal<Similar[]>([]);

  filtro = signal<Filtro>('todos');
  dominioSel = signal('');
  revisados = signal<string[]>(leerLista(CLAVE_REVISADOS));
  verRevisados = signal(false);

  private anim = crearAnimacion(900);
  k = this.anim.k;

  private delDominio = computed(() => {
    const d = this.dominioSel();
    return this.similares().filter((s) => !d || s.dominioId === d);
  });

  private visibles = computed(() => {
    const rev = this.revisados();
    const ver = this.verRevisados();
    return this.delDominio().filter((s) => rev.includes(s.id) === ver);
  });

  cuentas = computed(() => {
    const l = this.delDominio().filter((s) => !this.revisados().includes(s.id));
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
      .sort((a, b) => ORDEN_RIESGO[a.riesgo] - ORDEN_RIESGO[b.riesgo] || b.detectadoEn - a.detectadoEn);
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
    this.guardar([...this.revisados(), id]);
  }

  restaurar(id: string) {
    const resto = this.revisados().filter((x) => x !== id);
    this.guardar(resto);
    if (!resto.length) this.verRevisados.set(false);
  }

  private guardar(lista: string[]) {
    this.revisados.set(lista);
    guardarLista(CLAVE_REVISADOS, lista);
  }

  private cargar() {
    this.store.cargarLista().subscribe({
      next: (lista) => {
        this.vigilados.set(lista.map((d) => ({ id: d.id, nombre: d.nombreDominio })));
        this.similares.set(simularSimilares(lista));
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
