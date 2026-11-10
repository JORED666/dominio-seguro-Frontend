import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DominiosService } from '../../core/dominios.service';
import { Dominio, ETIQUETA_NIVEL, Nivel, mensajeError } from '../../core/modelos';

type Filtro = 'todos' | Nivel | 'sin';

@Component({
  selector: 'app-dominios',
  imports: [FormsModule, RouterLink],
  template: `
    <header class="encabezado">
      <div>
        <p class="etiqueta-panel"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" /></svg> PANEL DE CONTROL</p>
        <h1>Mis dominios</h1>
        <p class="sub">Estado de seguridad de los sitios que vigilas</p>
      </div>
      <button class="btn-agregar" type="button" (click)="mostrarForm.set(!mostrarForm())">
        {{ mostrarForm() ? 'Cerrar' : '＋ Agregar dominio' }}
      </button>
    </header>

    @if (mostrarForm()) {
      <section class="panel">
        <form class="fila-agregar" (ngSubmit)="agregar()">
          <input
            class="campo"
            type="text"
            name="nombre"
            [(ngModel)]="nuevo"
            placeholder="ejemplo.com"
            aria-label="Nombre del dominio"
            required
          />
          <button class="btn" type="submit" [disabled]="agregando()">
            {{ agregando() ? 'Agregando…' : 'Agregar' }}
          </button>
        </form>
      </section>
    }

    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }

    <section class="resumen-cards">
      <article class="stat">
        <div class="stat-top"><span class="stat-titulo">Dominios vigilados</span><span class="stat-icono"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" /></svg></span></div>
        <strong class="stat-valor">{{ conteo().todos }}</strong>
      </article>
      <article class="stat">
        <div class="stat-top"><span class="stat-titulo">Puntaje promedio</span><span class="stat-icono"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M4 17a8 8 0 1116 0" /><path d="M12 17l4-5" stroke-linecap="round" /></svg></span></div>
        <strong class="stat-valor">
          {{ promedio() ?? '—' }}<small> / 100</small>
        </strong>
        <div class="barra-prom"><span [style.width.%]="promedio() ?? 0"></span></div>
      </article>
      <article class="stat">
        <div class="stat-top"><span class="stat-titulo">Dominios críticos</span><span class="stat-icono rojo"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" /><path d="M12 8v4M12 15v.5" stroke-linecap="round" /></svg></span></div>
        <strong class="stat-valor" [class.rojo]="conteo().critico > 0">{{ conteo().critico }}</strong>
      </article>
      <article class="stat">
        <div class="stat-top"><span class="stat-titulo">Sin analizar</span><span class="stat-icono ambar"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" stroke-linecap="round" /></svg></span></div>
        <strong class="stat-valor" [class.ambar]="conteo().sin > 0">{{ conteo().sin }}</strong>
      </article>
    </section>

    <section class="filtros">
      <label class="buscar-caja">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" stroke-linecap="round" /></svg>
        <input
          class="buscar"
          type="search"
          name="buscar"
          placeholder="Buscar dominio por nombre…"
          aria-label="Buscar dominio"
          [ngModel]="busqueda()"
          (ngModelChange)="busqueda.set($event)"
        />
      </label>
      <div class="chips" role="group" aria-label="Filtrar por estado">
        @for (f of filtros; track f.valor) {
          <button
            type="button"
            class="chip"
            [class.activo]="filtro() === f.valor"
            (click)="filtro.set(f.valor)"
          >
            {{ f.texto }} ({{ conteo()[f.valor] }})
          </button>
        }
      </div>
    </section>

    @if (analizando()) {
      <p class="aviso">Analizando el dominio… puede tardar hasta 30 segundos.</p>
    }

    @if (cargando()) {
      <p class="sub">Cargando…</p>
    } @else if (dominios().length === 0) {
      <section class="vacio">
        <h2>Aún no tienes dominios</h2>
        <p class="sub">Agrega el primero con el botón de arriba para empezar a vigilarlo.</p>
      </section>
    } @else if (visibles().length === 0) {
      <p class="sub">Ningún dominio coincide con la búsqueda o el filtro.</p>
    } @else {
      <section class="rejilla">
        @for (d of visibles(); track d.id) {
          <article class="dominio">
            <div class="dom-cab">
              <span class="dom-icono"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" /></svg></span>
              <h2 class="dom-nombre">{{ d.nombreDominio }}</h2>
            </div>

            <div class="dom-cuerpo">
              <div class="aro" [attr.data-nivel]="d.nivel ?? 'sin'" [style.--p]="d.ultimoPuntaje ?? 0">
                <span class="aro-num">{{ d.ultimoPuntaje ?? '--' }}</span>
                <span class="aro-txt">{{ d.nivel ? 'PUNTOS' : 'SIN DATOS' }}</span>
              </div>

              <div class="dom-info">
                @if (d.nivel) {
                  <span class="badge" [attr.data-nivel]="d.nivel">{{ etiqueta[d.nivel] }}</span>
                } @else {
                  <span class="badge" data-nivel="sin">Sin analizar</span>
                }
                <p class="fecha">Agregado el {{ fecha(d.creadoEn) }}</p>
                @if (d.nivel) {
                  <div class="escala" aria-hidden="true"><span class="marca" [style.left.%]="d.ultimoPuntaje"></span></div>
                  <div class="escala-leyenda" aria-hidden="true"><span>Crítico</span><span>Mejoras</span><span>Bueno</span></div>
                }
                @if (!d.nivel) {
                  <p class="pista">Haz el primer análisis para revisar su certificado y subdominios.</p>
                }
              </div>
            </div>

            <footer class="dom-pie">
              @if (d.nivel) {
                <a class="btn-sec" [routerLink]="['/dominios', d.id]"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg> Ver detalle</a>
              } @else {
                <span></span>
              }
              <button
                class="btn-prim"
                type="button"
                [disabled]="analizando() !== null"
                (click)="analizar(d)"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" stroke-linecap="round" /></svg>
                {{ analizando() === d.id ? 'Analizando…' : d.nivel ? 'Analizar ahora' : 'Primer análisis' }}
              </button>
            </footer>
          </article>
        }
      </section>
    }
  `,
  styles: `
    :host { display: block; }

    .encabezado { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
    .etiqueta-panel { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; color: var(--acento-claro); font-size: 12px; font-weight: 600; letter-spacing: 0.08em; }
    .encabezado h1 { font-size: 2.6rem; line-height: 1.1; margin: 0; }
    .encabezado .sub { margin: 6px 0 0; }

    .btn-agregar {
      height: 46px; padding: 0 24px; border: 0; border-radius: 999px; cursor: pointer;
      background: var(--acento); color: #fff; font: inherit; font-weight: 600;
      box-shadow: 0 8px 24px rgba(91, 108, 248, 0.4);
    }
    .btn-agregar:hover { filter: brightness(1.08); }

    .panel { background: var(--tarjeta); border: 1px solid var(--borde); border-radius: 20px; padding: 16px; margin-bottom: 20px; }
    .fila-agregar { display: flex; gap: 12px; }
    .campo {
      flex: 1; height: 46px; padding: 0 20px; background: #384250; color: var(--texto);
      border: 1px solid transparent; border-radius: 999px; font: inherit;
    }
    .campo::placeholder { color: #b4bdca; }
    .campo:focus { outline: 3px solid rgba(91, 108, 248, 0.55); outline-offset: 1px; }

    .resumen-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
    .stat { background: var(--tarjeta); border: 1px solid var(--borde); border-radius: 22px; padding: 18px 22px; display: flex; flex-direction: column; gap: 12px; }
    .stat-top { display: flex; align-items: center; justify-content: space-between; }
    .stat-icono { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 50%; background: #2a3160; color: var(--acento-claro); }
    .stat-icono.rojo { background: rgba(239, 68, 68, 0.15); color: var(--rojo); }
    .stat-icono.ambar { background: rgba(245, 158, 11, 0.15); color: var(--ambar); }
    .stat-titulo { color: var(--suave); font-size: 13px; }
    .stat-valor { font-family: var(--fuente-titulo); font-size: 2.5rem; line-height: 1; color: var(--titulo); }
    .stat-valor small { font-family: var(--fuente); font-size: 13px; color: var(--suave); font-weight: 400; }
    .stat-valor.rojo { color: var(--rojo); }
    .stat-valor.ambar { color: var(--ambar); }
    .barra-prom { height: 6px; border-radius: 999px; background: var(--borde); overflow: hidden; }
    .barra-prom span { display: block; height: 100%; background: var(--acento); border-radius: 999px; }

    .filtros { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; background: var(--tarjeta); border: 1px solid var(--borde); border-radius: 20px; padding: 12px 16px; margin-bottom: 16px; }
    .buscar-caja {
      flex: 1 1 280px; max-width: 440px; height: 44px; display: flex; flex-direction: row; align-items: center; gap: 10px; font-size: 14px;
      padding: 0 18px; background: var(--fondo); color: var(--suave);
      border: 1px solid var(--borde); border-radius: 999px;
    }
    .buscar-caja:focus-within { outline: 3px solid rgba(91, 108, 248, 0.55); outline-offset: 1px; }
    .buscar { flex: 1; min-width: 0; height: 100%; padding: 0; background: transparent; color: var(--texto); border: 0; font: inherit; outline: 0; }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .chip {
      padding: 7px 14px; border-radius: 999px; cursor: pointer; font: inherit; font-size: 13px;
      background: transparent; color: var(--suave); border: 1px solid var(--borde);
    }
    .chip:hover { color: var(--texto); }
    .chip.activo { background: var(--acento); border-color: var(--acento); color: #fff; }

    .rejilla { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .dominio { background: var(--tarjeta); border: 1px solid var(--borde); border-radius: 26px; padding: 22px; display: flex; flex-direction: column; gap: 16px; }
    .dom-cab { display: flex; align-items: center; gap: 14px; }
    .dom-icono { width: 44px; height: 44px; flex: none; display: grid; place-items: center; border-radius: 14px; background: #1b2040; border: 1px solid var(--borde); color: var(--acento-claro); }
    .dom-nombre { margin: 0; font-size: 1.3rem; word-break: break-all; }
    .dom-cuerpo { display: flex; align-items: center; gap: 24px; background: var(--fondo); border: 1px solid var(--borde); border-radius: 18px; padding: 16px 22px; }

    .aro {
      --c: var(--borde);
      flex: none; position: relative; width: 96px; height: 96px; border-radius: 50%;
      display: grid; place-content: center; text-align: center;
      background: conic-gradient(var(--c) calc(var(--p) * 1%), #2a3042 0);
    }
    .aro::before { content: ''; position: absolute; inset: 8px; border-radius: 50%; background: var(--fondo); }
    .aro[data-nivel='bueno'] { --c: var(--verde); }
    .aro[data-nivel='mejoras'] { --c: var(--ambar); }
    .aro[data-nivel='critico'] { --c: var(--rojo); }
    .aro-num, .aro-txt { position: relative; }
    .aro-num { font-family: var(--fuente-titulo); font-size: 1.7rem; font-weight: 600; line-height: 1; color: var(--titulo); }
    .aro[data-nivel='bueno'] .aro-num { color: var(--verde); }
    .aro[data-nivel='mejoras'] .aro-num { color: var(--ambar); }
    .aro[data-nivel='critico'] .aro-num { color: var(--rojo); }
    .aro-txt { font-size: 9px; letter-spacing: 0.08em; color: var(--suave); margin-top: 3px; }

    .dom-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
    .escala { position: relative; width: 100%; height: 8px; margin-top: 6px; border-radius: 999px; overflow: visible;
      background: linear-gradient(90deg, var(--rojo) 0 50%, var(--ambar) 50% 80%, var(--verde) 80% 100%); opacity: 0.85; }
    .marca { position: absolute; top: 50%; width: 16px; height: 16px; margin-left: -8px; transform: translateY(-50%);
      border-radius: 50%; background: #fff; border: 3px solid var(--fondo); box-shadow: 0 0 0 1px var(--borde); }
    .escala-leyenda { display: flex; width: 100%; font-size: 11px; color: var(--suave); }
    .escala-leyenda span:nth-child(1) { width: 50%; }
    .escala-leyenda span:nth-child(2) { width: 30%; }
    .fecha { margin: 0; color: var(--suave); font-size: 13px; }
    .pista { margin: 0; color: var(--acento-claro); font-size: 13px; }

    .dom-pie { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-top: 4px; border-top: 1px solid var(--borde); padding-top: 16px; }
    .btn-prim, .btn-sec {
      height: 40px; padding: 0 20px; border-radius: 999px; cursor: pointer; font: inherit; font-weight: 600; font-size: 14px;
      display: inline-flex; align-items: center; gap: 8px; text-decoration: none;
    }
    .btn-prim { background: var(--acento); color: #fff; border: 0; box-shadow: 0 6px 18px rgba(91, 108, 248, 0.35); }
    .btn-prim:hover:not(:disabled) { filter: brightness(1.1); }
    .btn-prim:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-sec { background: transparent; color: var(--texto); border: 1px solid var(--borde); }
    .btn-sec:hover { border-color: var(--acento-claro); }

    .vacio { text-align: center; padding: 48px 16px; background: var(--tarjeta); border: 1px dashed var(--borde); border-radius: 24px; }

    @media (max-width: 900px) {
      .resumen-cards { grid-template-columns: repeat(2, 1fr); }
      .rejilla { grid-template-columns: 1fr; }
    }
    @media (max-width: 520px) {
      .encabezado h1 { font-size: 1.9rem; }
      .fila-agregar { flex-direction: column; }
      .dom-cuerpo { flex-direction: column; text-align: center; }
      .dom-info { align-items: center; }
    }
  `,
})
export class Dominios {
  private servicio = inject(DominiosService);
  private router = inject(Router);

  etiqueta = ETIQUETA_NIVEL;
  filtros: { valor: Filtro; texto: string }[] = [
    { valor: 'todos', texto: 'Todos' },
    { valor: 'bueno', texto: 'Bueno' },
    { valor: 'mejoras', texto: 'Necesita mejoras' },
    { valor: 'critico', texto: 'Crítico' },
    { valor: 'sin', texto: 'Sin analizar' },
  ];

  dominios = signal<Dominio[]>([]);
  cargando = signal(true);
  agregando = signal(false);
  analizando = signal<string | null>(null);
  error = signal('');
  mostrarForm = signal(false);
  filtro = signal<Filtro>('todos');
  busqueda = signal('');
  nuevo = '';

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

  fecha(iso: string) {
    return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  cargar() {
    this.servicio.listar().subscribe({
      next: (lista) => {
        this.dominios.set(lista);
        this.cargando.set(false);
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
    this.servicio.crear(nombre).subscribe({
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
    this.servicio.analizar(d.id).subscribe({
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
