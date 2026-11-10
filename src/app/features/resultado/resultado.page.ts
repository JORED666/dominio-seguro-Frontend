import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ETIQUETA_NIVEL, Hallazgo, Severidad, mensajeError } from '../../core/modelos';
import { DominiosStore } from '../../data/dominios.store';
import { ETIQUETA_SEVERIDAD, ORDEN_SEVERIDAD } from '../../domain/severidad';
import { AroPuntaje } from '../../shared/ui/aro-puntaje/aro-puntaje';
import { crearAnimacion } from '../../shared/utils/animacion';

const ORDEN_CATEGORIAS = ['TLS', 'Reputación', 'Exposición', 'Subdominios'];
const MENSAJE_NIVEL = {
  bueno: 'La configuración de seguridad es sólida. Revisa los puntos informativos para mantenerla así.',
  mejoras: 'Hay aspectos que conviene corregir pronto para reducir el riesgo.',
  critico: 'Hay problemas graves que requieren atención inmediata.',
};

// Nombres de servicios conocidos, para que los puertos se entiendan sin ser técnico
const PUERTOS: Record<number, string> = {
  21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'Correo', 53: 'DNS', 80: 'HTTP', 110: 'POP3', 143: 'IMAP',
  443: 'HTTPS', 445: 'Archivos', 993: 'IMAPS', 995: 'POP3S', 1433: 'SQL Server', 3306: 'MySQL',
  3389: 'Escritorio remoto', 5432: 'PostgreSQL', 5900: 'VNC', 6379: 'Redis', 8080: 'HTTP alterno',
  8443: 'HTTPS alterno', 27017: 'MongoDB',
};
// Servicios que normalmente no deberían estar abiertos a todo Internet
const SENSIBLES = new Set([21, 23, 445, 1433, 3306, 3389, 5432, 5900, 6379, 27017]);

type FiltroHallazgos = 'todos' | 'corregir' | 'info';

interface Grupo {
  categoria: string;
  items: Hallazgo[];
  peor: Severidad;
  problemas: number;
}

@Component({
  selector: 'app-resultado',
  imports: [AroPuntaje, RouterLink, DatePipe],
  templateUrl: './resultado.page.html',
  styleUrl: './resultado.page.css',
})
export class Resultado {
  private ruta = inject(ActivatedRoute);
  private store = inject(DominiosStore);

  etiqueta = ETIQUETA_NIVEL;
  sev = ETIQUETA_SEVERIDAD;
  mensaje = MENSAJE_NIVEL;
  id = this.ruta.snapshot.paramMap.get('id') ?? '';

  filtros: { valor: FiltroHallazgos; texto: string }[] = [
    { valor: 'todos', texto: 'Todos' },
    { valor: 'corregir', texto: 'Por corregir' },
    { valor: 'info', texto: 'Informativos' },
  ];

  dominio = computed(() => this.store.dominios().find((d) => d.id === this.id) ?? null);
  historial = computed(() => this.store.historialDe(this.id));
  cargando = signal(true);
  analizando = signal(false);
  error = signal('');
  filtro = signal<FiltroHallazgos>('todos');

  // Animación de entrada del puntaje y las barras
  private anim = crearAnimacion(1100);
  k = this.anim.k;

  ultimo = computed(() => this.historial()[0] ?? null);
  puntajeAnimado = computed(() => Math.round((this.ultimo()?.puntaje ?? 0) * this.k()));

  delta = computed(() => {
    const h = this.historial();
    return h.length > 1 ? h[0].puntaje - h[1].puntaje : null;
  });

  conteo = computed(() => {
    const todos = this.ultimo()?.hallazgos ?? [];
    const info = todos.filter((h) => h.severidad === 'info').length;
    return { todos: todos.length, problemas: todos.length - info, info };
  });

  graves = computed(() => (this.ultimo()?.hallazgos ?? []).filter((h) => h.severidad === 'critica' || h.severidad === 'alta').length);

  // El hallazgo más grave que no sea informativo, con su recomendación
  primerPaso = computed(() => {
    const lista = (this.ultimo()?.hallazgos ?? []).filter((h) => h.severidad !== 'info');
    return [...lista].sort((a, b) => ORDEN_SEVERIDAD[a.severidad] - ORDEN_SEVERIDAD[b.severidad])[0] ?? null;
  });

  // Hallazgos agrupados por categoría (las más graves primero) y filtrados por el chip activo
  grupos = computed<Grupo[]>(() => {
    const f = this.filtro();
    const mapa = new Map<string, Hallazgo[]>();
    for (const h of this.ultimo()?.hallazgos ?? []) {
      if (f === 'corregir' && h.severidad === 'info') continue;
      if (f === 'info' && h.severidad !== 'info') continue;
      mapa.set(h.categoria, [...(mapa.get(h.categoria) ?? []), h]);
    }
    const rango = (c: string) => {
      const i = ORDEN_CATEGORIAS.indexOf(c);
      return i === -1 ? ORDEN_CATEGORIAS.length : i;
    };
    return [...mapa.entries()]
      .map(([categoria, lista]) => {
        const items = [...lista].sort((a, b) => ORDEN_SEVERIDAD[a.severidad] - ORDEN_SEVERIDAD[b.severidad]);
        return {
          categoria,
          items,
          peor: items[0].severidad,
          problemas: items.filter((h) => h.severidad !== 'info').length,
        };
      })
      .sort((a, b) => ORDEN_SEVERIDAD[a.peor] - ORDEN_SEVERIDAD[b.peor] || rango(a.categoria) - rango(b.categoria));
  });

  // Últimos 8 análisis, del más antiguo al más reciente, para las barras de tendencia
  tendencia = computed(() => this.historial().slice(0, 8).reverse());

  // Últimos 6 análisis con su diferencia contra el anterior
  filasHistorial = computed(() => {
    const h = this.historial();
    return h.slice(0, 6).map((a, i) => ({ a, d: h[i + 1] ? a.puntaje - h[i + 1].puntaje : null }));
  });

  // Certificado, red y subdominios solo existen si el análisis se acaba de ejecutar
  detalle = computed(() => {
    const r = this.store.ultimoResultado();
    return r && r.dominioId === this.id ? r : null;
  });

  constructor() {
    this.cargar();
  }

  cuentaFiltro(f: FiltroHallazgos): number {
    const c = this.conteo();
    return f === 'todos' ? c.todos : f === 'corregir' ? c.problemas : c.info;
  }

  nombrePuerto(p: number): string {
    return PUERTOS[p] ?? '';
  }

  esSensible(p: number): boolean {
    return SENSIBLES.has(p);
  }

  tonoRiesgo(r: number): 'verde' | 'ambar' | 'rojo' {
    return r >= 60 ? 'rojo' : r >= 30 ? 'ambar' : 'verde';
  }

  tonoDias(dias: number | null, autorizado: boolean): 'verde' | 'ambar' | 'rojo' {
    if (dias === null) return autorizado ? 'verde' : 'rojo';
    if (dias < 0 || !autorizado) return 'rojo';
    return dias < 30 ? 'ambar' : 'verde';
  }

  textoDias(dias: number | null): string {
    if (dias === null) return 'Vigencia desconocida';
    const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
    if (dias < 0) {
      const a = -dias;
      return a > 365 ? `Venció hace ${plural(Math.floor(a / 365), 'año', 'años')}` : `Venció hace ${plural(a, 'día', 'días')}`;
    }
    return dias === 0 ? 'Vence hoy' : `Vence en ${plural(dias, 'día', 'días')}`;
  }

  private animarEntrada() {
    this.anim.iniciar();
  }

  cargar() {
    this.store.cargarDominio(this.id).subscribe({
      next: () => {
        this.cargando.set(false);
        this.animarEntrada();
      },
      error: (e) => {
        this.error.set(mensajeError(e));
        this.cargando.set(false);
      },
    });
  }

  reanalizar() {
    this.analizando.set(true);
    this.error.set('');
    this.store.analizar(this.id).subscribe({
      next: () => {
        this.analizando.set(false);
        this.cargar();
      },
      error: (e) => {
        this.error.set(mensajeError(e));
        this.analizando.set(false);
      },
    });
  }
}
