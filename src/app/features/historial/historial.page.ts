import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ETIQUETA_NIVEL, Nivel, mensajeError } from '../../core/modelos';
import { DominiosStore } from '../../data/dominios.store';
import { DIA_MS, Punto, Registro, armarSeries, cambioPromedio, coloresDe, etiquetaDia, registrosDe, yDe } from '../../domain/tendencia';
import { crearAnimacion } from '../../shared/utils/animacion';

type Rango = '7' | '30' | 'todo';
type FiltroNivel = 'todos' | Nivel;

// Lo que muestra el globo al pasar el cursor: el puntaje de cada dominio en esa fecha
interface Hover {
  x: number;
  fecha: number;
  filas: { color: string; dominio: string; punto: Punto }[];
}

interface DominioLeyenda {
  id: string;
  nombre: string;
  color: string;
}

const PASO_LISTA = 10;

@Component({
  selector: 'app-historial',
  imports: [RouterLink, DatePipe],
  templateUrl: './historial.page.html',
  styleUrl: './historial.page.css',
})
export class Historial {
  private store = inject(DominiosStore);

  etiqueta = ETIQUETA_NIVEL;
  readonly PASO = PASO_LISTA;
  readonly niveles = [100, 80, 50, 0];
  yDe = yDe;

  rangos: { valor: Rango; texto: string }[] = [
    { valor: '7', texto: '7 días' },
    { valor: '30', texto: '30 días' },
    { valor: 'todo', texto: 'Todo' },
  ];
  filtrosNivel: { valor: FiltroNivel; texto: string }[] = [
    { valor: 'todos', texto: 'Todos' },
    { valor: 'critico', texto: 'Crítico' },
    { valor: 'mejoras', texto: 'Necesita mejoras' },
    { valor: 'bueno', texto: 'Bueno' },
  ];

  cargando = signal(true);
  error = signal('');
  leyenda = signal<DominioLeyenda[]>([]);
  hayDominios = signal(false);
  todos = signal<Registro[]>([]);

  ocultos = signal<string[]>([]);
  rango = signal<Rango>('todo');
  nivel = signal<FiltroNivel>('todos');
  mostrar = signal(PASO_LISTA);
  hover = signal<Hover | null>(null);

  // Animación de entrada de los números
  private anim = crearAnimacion(1000);
  k = this.anim.k;

  // Dominios visibles + rango: lo que dibuja la gráfica
  base = computed(() => {
    const r = this.rango();
    const desde = r === 'todo' ? 0 : Date.now() - Number(r) * DIA_MS;
    const ocultos = this.ocultos();
    return this.todos().filter((x) => !ocultos.includes(x.dominioId) && x.fecha >= desde);
  });

  // Además, el filtro de estado: lo que muestran las métricas y la lista
  filtrados = computed(() => {
    const n = this.nivel();
    return n === 'todos' ? this.base() : this.base().filter((x) => x.nivel === n);
  });

  promedio = computed(() => {
    const l = this.filtrados();
    return l.length ? Math.round(l.reduce((a, x) => a + x.puntaje, 0) / l.length) : null;
  });

  mejora = computed(() => {
    const l = this.filtrados().filter((x) => (x.delta ?? 0) > 0);
    return l.length ? l.reduce((m, x) => (x.delta! > m.delta! ? x : m)) : null;
  });

  caida = computed(() => {
    const l = this.filtrados().filter((x) => (x.delta ?? 0) < 0);
    return l.length ? l.reduce((m, x) => (x.delta! < m.delta! ? x : m)) : null;
  });

  // Eje de tiempo de la gráfica
  private ventana = computed(() => {
    const b = this.base();
    const fin = Date.now();
    const ini = this.rango() === 'todo' ? Math.min(...b.map((x) => x.fecha), fin) : fin - Number(this.rango()) * DIA_MS;
    return { ini, span: Math.max(fin - ini, DIA_MS) };
  });

  private xDe = (t: number): number => {
    const v = this.ventana();
    return 30 + ((t - v.ini) / v.span) * 940;
  };

  series = computed(() => armarSeries(this.base(), this.xDe));
  tendenciaGlobal = computed(() => cambioPromedio(this.series()));

  ticks = computed(() => {
    const v = this.ventana();
    const fmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });
    return [0, 1, 2, 3, 4].map((i) => ({ x: 30 + (i / 4) * 940, texto: fmt.format(v.ini + (v.span * i) / 4) }));
  });

  // Lista agrupada por día, del más reciente al más antiguo
  private ordenados = computed(() => [...this.filtrados()].sort((a, b) => b.fecha - a.fecha));

  restantes = computed(() => Math.max(0, this.ordenados().length - this.mostrar()));

  grupos = computed(() => {
    const grupos: { etiqueta: string; items: Registro[] }[] = [];
    for (const r of this.ordenados().slice(0, this.mostrar())) {
      const et = etiquetaDia(r.fecha);
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.etiqueta === et) ultimo.items.push(r);
      else grupos.push({ etiqueta: et, items: [r] });
    }
    return grupos;
  });

  constructor() {
    this.cargar();
  }

  n(v: number): number {
    return this.anim.n(v);
  }

  fechaLarga(ms: number): string {
    return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(ms);
  }

  alternar(id: string) {
    this.ocultos.update((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
    this.hover.set(null);
  }

  // Al pasar el cursor: el último puntaje conocido de cada dominio hasta esa fecha
  mover(e: PointerEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (!r.width) return;
    const x = Math.min(970, Math.max(30, ((e.clientX - r.left) / r.width) * 1000));
    const v = this.ventana();
    const fecha = v.ini + ((x - 30) / 940) * v.span;
    const filas: Hover['filas'] = [];
    for (const s of this.series()) {
      let previo: Punto | null = null;
      for (const p of s.puntos) if (p.reg.fecha <= fecha) previo = p;
      if (previo) filas.push({ color: s.color, dominio: s.dominio, punto: previo });
    }
    filas.sort((a, b) => b.punto.reg.puntaje - a.punto.reg.puntaje);
    this.hover.set(filas.length ? { x, fecha, filas } : null);
  }

  private cargar() {
    this.store.cargarLista().subscribe({
      next: (lista) => {
        const colores = coloresDe(lista);
        const con = lista.filter((d) => d.nivel);
        // La leyenda de la gráfica solo incluye dominios que ya tienen análisis
        this.leyenda.set(con.map((d) => ({ id: d.id, nombre: d.nombreDominio, color: colores.get(d.id)! })));
        this.hayDominios.set(lista.length > 0);
        if (!con.length) {
          this.cargando.set(false);
          return;
        }
        this.store.cargarHistoriales(lista).subscribe(() => {
          this.todos.set(registrosDe(lista, (id) => this.store.historialDe(id)));
          this.cargando.set(false);
          this.anim.iniciar();
        });
      },
      error: (e) => {
        this.error.set(mensajeError(e));
        this.cargando.set(false);
      },
    });
  }
}
