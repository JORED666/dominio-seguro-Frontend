import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Analisis, Dominio, ETIQUETA_NIVEL, Hallazgo, Nivel, mensajeError } from '../../core/modelos';
import { DominiosStore } from '../../data/dominios.store';
import { ETIQUETA_SEVERIDAD, ORDEN_SEVERIDAD } from '../../domain/severidad';
import { AroPuntaje } from '../../shared/ui/aro-puntaje/aro-puntaje';
import { crearAnimacion } from '../../shared/utils/animacion';
import { fechaCorta, hace } from '../../shared/utils/fechas';

type Filtro = 'todos' | Nivel | 'sin';

// Datos que se calculan a partir del historial de cada dominio
interface Info {
  serie: number[]; // puntajes, del más viejo al más reciente (máx. 8)
  delta: number | null; // diferencia contra el análisis anterior
  hace: string; // "hace 3 días"
  principal: Hallazgo | null; // hallazgo más grave del último análisis
  relevantes: number; // hallazgos que no son informativos
  trazo: string; // línea de la mini gráfica
  area: string; // relleno bajo la línea
  yUlt: number; // posición vertical (%) del último punto
}


// Medidas de la mini gráfica (viewBox)
const GW = 160;
const GH = 52;
const GP = 4;

@Component({
  selector: 'app-dominios',
  imports: [AroPuntaje, FormsModule, RouterLink],
  templateUrl: './dominios.page.html',
  styleUrl: './dominios.page.css',
})
export class Dominios {
  private store = inject(DominiosStore);
  private router = inject(Router);

  etiqueta = ETIQUETA_NIVEL;
  etiqSev = ETIQUETA_SEVERIDAD;
  filtros: { valor: Filtro; texto: string }[] = [
    { valor: 'todos', texto: 'Todos' },
    { valor: 'bueno', texto: 'Bueno' },
    { valor: 'mejoras', texto: 'Necesita mejoras' },
    { valor: 'critico', texto: 'Crítico' },
    { valor: 'sin', texto: 'Sin analizar' },
  ];

  dominios = this.store.dominios;
  info = signal<Record<string, Info>>({});
  extrasListos = signal(false);
  cargando = signal(true);
  agregando = signal(false);
  analizando = signal<string | null>(null);
  error = signal('');
  mostrarForm = signal(false);
  filtro = signal<Filtro>('todos');
  busqueda = signal('');
  nuevo = '';

  // Animación de entrada de números y aros (solo la primera vez que llegan los datos)
  private anim = crearAnimacion(1000);
  k = this.anim.k;
  private yaAnimado = false;

  conteo = computed(() => {
    const l = this.dominios();
    return {
      todos: l.length,
      bueno: l.filter((d) => d.nivel === 'bueno').length,
      mejoras: l.filter((d) => d.nivel === 'mejoras').length,
      critico: l.filter((d) => d.nivel === 'critico').length,
      sin: l.filter((d) => !d.nivel).length,
    };
  });

  promedio = computed(() => {
    const p = this.dominios()
      .map((d) => d.ultimoPuntaje)
      .filter((x): x is number => x !== null);
    return p.length ? Math.round(p.reduce((a, b) => a + b, 0) / p.length) : null;
  });

  visibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const f = this.filtro();
    return this.dominios().filter((d) => {
      const coincide = !q || d.nombreDominio.toLowerCase().includes(q);
      const estado = f === 'todos' || (f === 'sin' ? !d.nivel : d.nivel === f);
      return coincide && estado;
    });
  });

  constructor() {
    this.cargar();
  }

  // Número animado: sube de 0 al valor real durante la entrada
  n(v: number | null): string | number {
    return v === null ? '--' : Math.round(v * this.k());
  }

  fecha(iso: string) {
    return fechaCorta(iso);
  }

  private animarEntrada() {
    if (this.yaAnimado) return;
    this.yaAnimado = true;
    this.anim.iniciar();
  }

  // Tendencia, último análisis y problema principal, a partir del historial de cada dominio
  private armarInfo(h: Analisis[]): Info {
    const serie = h
      .slice(0, 8)
      .map((a) => a.puntaje)
      .reverse();
    const relevantes = (h[0].hallazgos ?? []).filter((x) => x.severidad !== 'info');
    const principal = [...relevantes].sort((a, b) => ORDEN_SEVERIDAD[a.severidad] - ORDEN_SEVERIDAD[b.severidad])[0] ?? null;

    const xs = serie.map((_, i) => GP + (i * (GW - 2 * GP)) / Math.max(1, serie.length - 1));
    const ys = serie.map((v) => GH - GP - (Math.min(100, Math.max(0, v)) / 100) * (GH - 2 * GP));
    const trazo = serie.length > 1 ? 'M' + xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' L') : '';
    const area = trazo ? `${trazo} L${xs[xs.length - 1].toFixed(1)},${GH - GP} L${xs[0].toFixed(1)},${GH - GP} Z` : '';

    return {
      serie,
      delta: h.length > 1 ? h[0].puntaje - h[1].puntaje : null,
      hace: hace(h[0].fecha),
      principal,
      relevantes: relevantes.length,
      trazo,
      area,
      yUlt: (ys[ys.length - 1] / GH) * 100,
    };
  }

  private cargarExtras(lista: Dominio[]) {
    this.store.cargarHistoriales(lista).subscribe(() => {
      const mapa: Record<string, Info> = {};
      lista.forEach((d) => {
        const h = this.store.historialDe(d.id);
        if (h.length) mapa[d.id] = this.armarInfo(h);
      });
      this.info.set(mapa);
      this.extrasListos.set(true);
    });
  }

  cargar() {
    this.store.cargarLista().subscribe({
      next: (lista) => {
        this.cargando.set(false);
        this.animarEntrada();
        this.cargarExtras(lista);
      },
      error: (e) => {
        this.error.set(mensajeError(e));
        this.cargando.set(false);
      },
    });
  }

  agregar() {
    const nombre = this.nuevo.trim().toLowerCase();
    if (!nombre) return;
    this.agregando.set(true);
    this.error.set('');
    this.store.crear(nombre).subscribe({
      next: () => {
        this.nuevo = '';
        this.agregando.set(false);
        this.mostrarForm.set(false);
        this.cargar();
      },
      error: (e) => {
        this.error.set(mensajeError(e));
        this.agregando.set(false);
      },
    });
  }

  analizar(d: Dominio) {
    this.analizando.set(d.id);
    this.error.set('');
    this.store.analizar(d.id).subscribe({
      next: () => {
        this.analizando.set(null);
        this.router.navigate(['/dominios', d.id]);
      },
      error: (e) => {
        this.error.set(mensajeError(e));
        this.analizando.set(null);
      },
    });
  }
}
