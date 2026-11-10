import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { DominiosApi } from '../../core/api/dominios.api';
import { Analisis, ETIQUETA_NIVEL, Nivel, mensajeError } from '../../core/modelos';

type Rango = '7' | '30' | 'todo';
type FiltroNivel = 'todos' | Nivel;

// Un análisis de cualquiera de los dominios, listo para mostrarse
interface Registro {
  id: string;
  dominioId: string;
  dominio: string;
  color: string;
  fecha: number; // milisegundos
  puntaje: number;
  nivel: Nivel;
  delta: number | null; // contra el análisis anterior del mismo dominio
  graves: number;
  porCorregir: number;
  duracionMs: number;
}

interface Punto {
  reg: Registro;
  x: number; // 0 a 1000 (coordenadas del SVG)
  y: number; // 0 a 100
}

interface Serie {
  dominioId: string;
  dominio: string;
  color: string;
  d: string;
  puntos: Punto[];
}

interface DominioLeyenda {
  id: string;
  nombre: string;
  color: string;
}

// Colores para distinguir dominios en la gráfica (distintos de los de severidad)
const COLORES = ['#8e99f5', '#38bdf8', '#c084fc', '#f472b6', '#2dd4bf', '#fb923c', '#a3e635'];
const DIA = 864e5;
const PASO_LISTA = 10;

// Posición vertical (0 a 100) de un puntaje, con un poco de margen arriba y abajo
const yDe = (v: number) => 96 - v * 0.92;

@Component({
  selector: 'app-historial',
  imports: [RouterLink, DatePipe],
  templateUrl: './historial.page.html',
  styleUrl: './historial.page.css',
})
export class Historial {
  private servicio = inject(DominiosApi);
  private destruir = inject(DestroyRef);

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
  hover = signal<{ p: Punto; color: string } | null>(null);

  // Progreso (0 a 1) de la animación de los números
  k = signal(0);
  private raf = 0;
  private reducir = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Dominios visibles + rango: lo que dibuja la gráfica
  base = computed(() => {
    const r = this.rango();
    const desde = r === 'todo' ? 0 : Date.now() - Number(r) * DIA;
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
    const ini = this.rango() === 'todo' ? Math.min(...b.map((x) => x.fecha), fin) : fin - Number(this.rango()) * DIA;
    return { ini, span: Math.max(fin - ini, DIA) };
  });

  private xDe(t: number): number {
    const v = this.ventana();
    return 30 + ((t - v.ini) / v.span) * 940;
  }

  series = computed<Serie[]>(() => {
    const por = new Map<string, Registro[]>();
    for (const r of this.base()) por.set(r.dominioId, [...(por.get(r.dominioId) ?? []), r]);
    return [...por.values()].map((lista) => {
      const ord = [...lista].sort((a, b) => a.fecha - b.fecha);
      const puntos = ord.map((reg) => ({ reg, x: this.xDe(reg.fecha), y: yDe(reg.puntaje) }));
      const d = puntos.length > 1 ? 'M' + puntos.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L') : '';
      return { dominioId: ord[0].dominioId, dominio: ord[0].dominio, color: ord[0].color, d, puntos };
    });
  });

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
      const et = this.etiquetaDia(r.fecha);
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.etiqueta === et) ultimo.items.push(r);
      else grupos.push({ etiqueta: et, items: [r] });
    }
    return grupos;
  });

  constructor() {
    this.destruir.onDestroy(() => cancelAnimationFrame(this.raf));
    this.cargar();
  }

  n(v: number): number {
    return Math.round(v * this.k());
  }

  alternar(id: string) {
    this.ocultos.update((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
    this.hover.set(null);
  }

  // Punto más cercano al cursor (en píxeles) dentro de la gráfica
  mover(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    let mejor: { p: Punto; color: string } | null = null;
    let dmin = Infinity;
    for (const s of this.series()) {
      for (const p of s.puntos) {
        const dx = r.left + (p.x / 1000) * r.width - e.clientX;
        const dy = r.top + (p.y / 100) * r.height - e.clientY;
        const d = dx * dx + dy * dy;
        if (d < dmin) {
          dmin = d;
          mejor = { p, color: s.color };
        }
      }
    }
    this.hover.set(mejor && dmin < 70 * 70 ? mejor : null);
  }

  private etiquetaDia(ms: number): string {
    const inicio = (t: number) => new Date(new Date(t).setHours(0, 0, 0, 0)).getTime();
    const diff = Math.round((inicio(Date.now()) - inicio(ms)) / DIA);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Ayer';
    const mismoAnio = new Date(ms).getFullYear() === new Date().getFullYear();
    return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', ...(mismoAnio ? {} : { year: 'numeric' }) }).format(ms);
  }

  private animarEntrada() {
    cancelAnimationFrame(this.raf);
    if (this.reducir) {
      this.k.set(1);
      return;
    }
    const t0 = performance.now();
    const paso = (t: number) => {
      const x = Math.min(1, (t - t0) / 1000);
      this.k.set(1 - Math.pow(1 - x, 3));
      if (x < 1) this.raf = requestAnimationFrame(paso);
    };
    this.raf = requestAnimationFrame(paso);
  }

  private cargar() {
    this.servicio.listar().subscribe({
      next: (lista) => {
        const colores = new Map(lista.map((d, i) => [d.id, COLORES[i % COLORES.length]]));
        const con = lista.filter((d) => d.nivel);
        // La leyenda de la gráfica solo incluye dominios que ya tienen análisis
        this.leyenda.set(con.map((d) => ({ id: d.id, nombre: d.nombreDominio, color: colores.get(d.id)! })));
        this.hayDominios.set(lista.length > 0);
        if (!con.length) {
          this.cargando.set(false);
          return;
        }
        forkJoin(con.map((d) => this.servicio.historial(d.id).pipe(catchError(() => of([] as Analisis[]))))).subscribe((res) => {
          const regs: Registro[] = [];
          con.forEach((d, i) => {
            // El historial llega del más nuevo al más viejo: el "anterior" de cada uno es el siguiente
            const h = res[i];
            h.forEach((a, j) => {
              const hall = a.hallazgos ?? [];
              regs.push({
                id: a.id,
                dominioId: d.id,
                dominio: d.nombreDominio,
                color: colores.get(d.id)!,
                fecha: new Date(a.fecha).getTime(),
                puntaje: a.puntaje,
                nivel: a.nivel,
                delta: h[j + 1] ? a.puntaje - h[j + 1].puntaje : null,
                graves: hall.filter((x) => x.severidad === 'critica' || x.severidad === 'alta').length,
                porCorregir: hall.filter((x) => x.severidad !== 'info').length,
                duracionMs: a.duracionMs,
              });
            });
          });
          this.todos.set(regs);
          this.cargando.set(false);
          this.animarEntrada();
        });
      },
      error: (e) => {
        this.error.set(mensajeError(e));
        this.cargando.set(false);
      },
    });
  }
}
