import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { DominiosService } from '../../core/dominios.service';
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
  template: `
    <header class="encabezado ent" style="--i: 0">
      <div>
        <p class="etiqueta-panel">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          REGISTRO DE ACTIVIDAD
        </p>
        <h1>Historial</h1>
        <p class="sub">Todos los análisis de tus dominios y cómo ha cambiado su seguridad</p>
      </div>
      <div class="segmento" role="group" aria-label="Rango de fechas">
        @for (r of rangos; track r.valor) {
          <button type="button" [class.activo]="rango() === r.valor" (click)="rango.set(r.valor)">{{ r.texto }}</button>
        }
      </div>
    </header>

    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }

    @if (cargando()) {
      <p class="sub">Cargando…</p>
    } @else if (!hayDominios()) {
      <section class="panel vacio">
        <h2>Aún no tienes dominios</h2>
        <p class="sub">Agrega uno en <a routerLink="/dominios">Mis dominios</a> y analízalo para empezar a construir su historial.</p>
      </section>
    } @else if (todos().length === 0) {
      <section class="panel vacio">
        <h2>Todavía no hay análisis</h2>
        <p class="sub">Entra a <a routerLink="/dominios">Mis dominios</a> y pulsa <strong>Primer análisis</strong> en alguno de ellos.</p>
      </section>
    } @else {
      <!-- MÉTRICAS -->
      <section class="resumen-cards">
        <article class="stat ent" style="--i: 1">
          <span class="stat-titulo">Análisis realizados</span>
          <strong class="stat-valor">{{ n(filtrados().length) }}</strong>
          <span class="stat-pie">en el rango y filtros elegidos</span>
        </article>
        <article class="stat ent" style="--i: 2">
          <span class="stat-titulo">Puntaje promedio</span>
          <strong class="stat-valor">{{ promedio() === null ? '—' : n(promedio()!) }}<small> / 100</small></strong>
          <span class="stat-pie">de esos análisis</span>
        </article>
        <article class="stat ent" style="--i: 3">
          <span class="stat-titulo">Mayor mejora</span>
          @if (mejora(); as m) {
            <strong class="stat-valor verde">▲ +{{ m.delta }}</strong>
            <span class="stat-pie">{{ m.dominio }}</span>
          } @else {
            <strong class="stat-valor apagado">—</strong>
            <span class="stat-pie">sin mejoras en este periodo</span>
          }
        </article>
        <article class="stat ent" style="--i: 4">
          <span class="stat-titulo">Mayor caída</span>
          @if (caida(); as c) {
            <strong class="stat-valor rojo">▼ −{{ -c.delta! }}</strong>
            <span class="stat-pie">{{ c.dominio }}</span>
          } @else {
            <strong class="stat-valor apagado">—</strong>
            <span class="stat-pie">sin caídas en este periodo</span>
          }
        </article>
      </section>

      <!-- GRÁFICA -->
      <section class="panel ent" style="--i: 5">
        <header class="graf-cab">
          <h2>Evolución del puntaje</h2>
          <div class="leyenda" role="group" aria-label="Dominios en la gráfica">
            @for (d of leyenda(); track d.id) {
              <button type="button" class="ley" [class.off]="ocultos().includes(d.id)" (click)="alternar(d.id)" [attr.aria-pressed]="!ocultos().includes(d.id)">
                <i [style.background]="d.color"></i>{{ d.nombre }}
              </button>
            }
          </div>
        </header>

        @if (base().length === 0) {
          <p class="sub nada">No hay análisis en este rango. Prueba con «Todo».</p>
        } @else {
          <div class="grafica">
            <div class="ejey" aria-hidden="true">
              @for (v of niveles; track v) { <span [style.top.%]="yDe(v)">{{ v }}</span> }
            </div>
            <div class="plot" (pointermove)="mover($event)" (pointerleave)="hover.set(null)">
              <svg class="lienzo" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
                <rect x="0" [attr.y]="yDe(100)" width="1000" [attr.height]="yDe(80) - yDe(100)" fill="rgba(34,197,94,.07)" />
                <rect x="0" [attr.y]="yDe(80)" width="1000" [attr.height]="yDe(50) - yDe(80)" fill="rgba(245,158,11,.07)" />
                <rect x="0" [attr.y]="yDe(50)" width="1000" [attr.height]="yDe(0) - yDe(50)" fill="rgba(239,68,68,.07)" />
                <line x1="0" x2="1000" [attr.y1]="yDe(80)" [attr.y2]="yDe(80)" class="guia" />
                <line x1="0" x2="1000" [attr.y1]="yDe(50)" [attr.y2]="yDe(50)" class="guia" />
                @for (s of series(); track s.dominioId) {
                  <path class="linea" [attr.d]="s.d" [style.stroke]="s.color" />
                }
              </svg>
              @for (s of series(); track s.dominioId) {
                @for (p of s.puntos; track p.reg.id) {
                  <i class="pt" [style.left.%]="p.x / 10" [style.top.%]="p.y" [style.background]="s.color"></i>
                }
              }
              @if (hover(); as h) {
                <span class="vertical" [style.left.%]="h.p.x / 10"></span>
                <i class="pt grande" [style.left.%]="h.p.x / 10" [style.top.%]="h.p.y" [style.background]="h.color"></i>
                <div class="tip" [class.izq]="h.p.x > 600" [style.left.%]="h.p.x / 10" [style.top.%]="h.p.y">
                  <strong>{{ h.p.reg.dominio }}</strong>
                  <span>{{ h.p.reg.fecha | date: "d 'de' MMM, HH:mm" }}</span>
                  <b [attr.data-nivel]="h.p.reg.nivel">{{ h.p.reg.puntaje }} pts · {{ etiqueta[h.p.reg.nivel] }}</b>
                </div>
              }
            </div>
            <div class="ejex" aria-hidden="true">
              @for (t of ticks(); track $index) { <span [style.left.%]="t.x / 10">{{ t.texto }}</span> }
            </div>
          </div>
        }
      </section>

      <!-- FILTROS -->
      <section class="filtros ent" style="--i: 6">
        <h2 class="titulo-sec">Línea de tiempo</h2>
        <div class="chips" role="group" aria-label="Filtrar por estado">
          @for (f of filtrosNivel; track f.valor) {
            <button type="button" class="chip" [class.activo]="nivel() === f.valor" (click)="nivel.set(f.valor)">{{ f.texto }}</button>
          }
        </div>
      </section>

      <!-- LÍNEA DE TIEMPO -->
      @if (grupos().length === 0) {
        <section class="panel vacio"><p class="sub" style="margin:0">Ningún análisis coincide con los filtros elegidos.</p></section>
      } @else {
        <div class="tiempo">
          @for (g of grupos(); track g.etiqueta; let gi = $index) {
            <section class="dia ent" [style.--i]="7 + gi">
              <h3>{{ g.etiqueta }}</h3>
              <ul>
                @for (r of g.items; track r.id) {
                  <li class="fila" [attr.data-nivel]="r.nivel">
                    <span class="marca-dom" [style.background]="r.color" aria-hidden="true"></span>
                    <div class="fila-dom">
                      <strong>{{ r.dominio }}</strong>
                      <span class="hora">{{ r.fecha | date: 'HH:mm' }} · {{ (r.duracionMs / 1000).toFixed(1) }} s</span>
                    </div>
                    <div class="fila-hall">
                      @if (r.graves > 0) { <span class="etq grave">{{ r.graves }} {{ r.graves === 1 ? 'grave' : 'graves' }}</span> }
                      @if (r.porCorregir - r.graves > 0) { <span class="etq medio">{{ r.porCorregir - r.graves }} por corregir</span> }
                      @if (r.porCorregir === 0) { <span class="etq ok">Sin problemas</span> }
                    </div>
                    <div class="fila-punt">
                      <span class="punt" [attr.data-nivel]="r.nivel">{{ r.puntaje }}</span>
                      @if (r.delta !== null && r.delta !== 0) {
                        <span class="delta" [attr.data-dir]="r.delta > 0 ? 'sube' : 'baja'">{{ r.delta > 0 ? '▲ +' + r.delta : '▼ −' + -r.delta }}</span>
                      } @else if (r.delta === 0) {
                        <span class="delta" data-dir="igual">＝</span>
                      } @else {
                        <span class="delta" data-dir="nuevo">Primero</span>
                      }
                    </div>
                    <span class="chip-nivel" [attr.data-nivel]="r.nivel">{{ etiqueta[r.nivel] }}</span>
                    <a class="ver" [routerLink]="['/dominios', r.dominioId]" [attr.aria-label]="'Ver detalle de ' + r.dominio">
                      Ver detalle
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    </a>
                  </li>
                }
              </ul>
            </section>
          }
          @if (restantes() > 0) {
            <button type="button" class="mas" (click)="mostrar.set(mostrar() + PASO)">
              Mostrar {{ restantes() > PASO ? PASO : restantes() }} más ({{ restantes() }} restantes)
            </button>
          }
        </div>
      }
    }
  `,
  styles: `
    :host { display: block; }

    .ent { animation: entra 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) backwards; animation-delay: calc(var(--i, 0) * 70ms); }
    @keyframes entra { from { opacity: 0; transform: translateY(14px); } }
    @keyframes revela { from { clip-path: inset(-12px 100% -12px 0); } }
    @keyframes aparece { from { opacity: 0; } }

    .encabezado { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
    .etiqueta-panel { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; color: var(--acento-claro); font-size: 12px; font-weight: 600; letter-spacing: 0.08em; }
    .encabezado h1 { font-size: 2.6rem; line-height: 1.1; margin: 0; }
    .encabezado .sub { margin: 6px 0 0; }

    .segmento { display: inline-flex; padding: 4px; gap: 2px; background: var(--tarjeta); border: 1px solid var(--borde); border-radius: 999px; }
    .segmento button { padding: 8px 18px; border: 0; border-radius: 999px; cursor: pointer; font: inherit; font-size: 13px; font-weight: 600; background: transparent; color: var(--suave); }
    .segmento button:hover { color: var(--texto); }
    .segmento button.activo { background: var(--acento); color: #fff; }

    .panel { background: var(--tarjeta); border: 1px solid var(--borde); border-radius: 24px; padding: 22px 24px; margin-bottom: 20px; }
    .vacio { text-align: center; border-style: dashed; padding: 44px 16px; }
    .vacio a { color: var(--acento-claro); }
    .nada { margin: 12px 0 0; }

    /* Métricas */
    .resumen-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
    .stat { background: var(--tarjeta); border: 1px solid var(--borde); border-radius: 22px; padding: 18px 22px; display: flex; flex-direction: column; gap: 8px; }
    .stat-titulo { color: var(--suave); font-size: 13px; }
    .stat-valor { font-family: var(--fuente-titulo); font-size: 2.2rem; line-height: 1.05; color: var(--titulo); font-variant-numeric: tabular-nums; }
    .stat-valor small { font-family: var(--fuente); font-size: 13px; color: var(--suave); font-weight: 400; }
    .stat-valor.verde { color: var(--verde); }
    .stat-valor.rojo { color: var(--rojo); }
    .stat-valor.apagado { color: var(--suave); }
    .stat-pie { font-size: 12.5px; color: var(--suave); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* Gráfica */
    .graf-cab { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
    .graf-cab h2 { margin: 0; font-size: 1.2rem; }
    .leyenda { display: flex; gap: 8px; flex-wrap: wrap; }
    .ley { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; cursor: pointer; font: inherit; font-size: 13px; color: var(--texto); background: transparent; border: 1px solid var(--borde); }
    .ley i { width: 10px; height: 10px; border-radius: 50%; }
    .ley:hover { border-color: var(--acento-claro); }
    .ley.off { color: var(--suave); text-decoration: line-through; }
    .ley.off i { opacity: 0.3; }

    .grafica { position: relative; display: grid; grid-template-columns: 34px minmax(0, 1fr); grid-template-rows: 280px 28px; column-gap: 10px; }
    .ejey { position: relative; grid-row: 1; grid-column: 1; }
    .ejey span { position: absolute; right: 0; transform: translateY(-50%); font-size: 11px; color: var(--suave); font-variant-numeric: tabular-nums; }
    .plot { position: relative; grid-row: 1; grid-column: 2; border-radius: 14px; background: var(--tarjeta-2); border: 1px solid var(--borde); touch-action: pan-y; }
    .lienzo { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 14px; animation: revela 1.1s ease-out 0.4s backwards; }
    .guia { stroke: rgba(255, 255, 255, 0.14); stroke-width: 1; stroke-dasharray: 4 5; vector-effect: non-scaling-stroke; }
    .linea { fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
    .pt { position: absolute; width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px; border-radius: 50%; box-shadow: 0 0 0 2px var(--tarjeta-2); animation: aparece 0.4s ease-out 1.2s backwards; pointer-events: none; }
    .pt.grande { width: 15px; height: 15px; margin: -7.5px 0 0 -7.5px; animation: none; box-shadow: 0 0 0 3px var(--tarjeta-2), 0 0 0 5px rgba(255, 255, 255, 0.25); z-index: 2; }
    .vertical { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(255, 255, 255, 0.2); pointer-events: none; }
    .tip { position: absolute; z-index: 3; transform: translate(14px, -50%); min-width: 150px; display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 12px; background: #0e1118; border: 1px solid var(--borde); box-shadow: 0 12px 30px -10px rgba(0, 0, 0, 0.7); pointer-events: none; font-size: 12px; color: var(--suave); }
    .tip.izq { transform: translate(calc(-100% - 14px), -50%); }
    .tip strong { color: var(--titulo); font-size: 13px; }
    .tip b { margin-top: 2px; font-size: 13px; }
    .tip b[data-nivel='bueno'] { color: var(--verde); }
    .tip b[data-nivel='mejoras'] { color: var(--ambar); }
    .tip b[data-nivel='critico'] { color: var(--rojo); }
    .ejex { position: relative; grid-row: 2; grid-column: 2; }
    .ejex span { position: absolute; top: 8px; transform: translateX(-50%); font-size: 11px; color: var(--suave); white-space: nowrap; }

    /* Filtros y línea de tiempo */
    .filtros { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: 8px 0 14px; }
    .titulo-sec { margin: 0; font-size: 1.35rem; }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .chip { padding: 7px 14px; border-radius: 999px; cursor: pointer; font: inherit; font-size: 13px; background: transparent; color: var(--suave); border: 1px solid var(--borde); }
    .chip:hover { color: var(--texto); }
    .chip.activo { background: var(--acento); border-color: var(--acento); color: #fff; }

    .tiempo { display: flex; flex-direction: column; gap: 22px; }
    .dia h3 { margin: 0 0 10px; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--suave); }
    .dia ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .fila {
      --c: var(--borde);
      display: grid; grid-template-columns: 10px minmax(150px, 1.3fr) minmax(130px, 1fr) auto auto auto; align-items: center; gap: 16px;
      padding: 14px 18px; background: var(--tarjeta); border: 1px solid var(--borde); border-left: 3px solid var(--c); border-radius: 16px;
      transition: transform 0.2s ease, border-color 0.2s ease;
    }
    .fila[data-nivel='bueno'] { --c: var(--verde); }
    .fila[data-nivel='mejoras'] { --c: var(--ambar); }
    .fila[data-nivel='critico'] { --c: var(--rojo); }
    .fila:hover { transform: translateX(3px); border-color: color-mix(in srgb, var(--c) 55%, var(--borde)); border-left-color: var(--c); }
    .marca-dom { width: 10px; height: 10px; border-radius: 50%; }
    .fila-dom { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .fila-dom strong { color: var(--titulo); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .hora { font-size: 12.5px; color: var(--suave); }
    .fila-hall { display: flex; gap: 6px; flex-wrap: wrap; }
    .etq { padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; }
    .etq.grave { background: rgba(239, 68, 68, 0.16); color: var(--rojo); }
    .etq.medio { background: rgba(245, 158, 11, 0.16); color: var(--ambar); }
    .etq.ok { background: rgba(34, 197, 94, 0.16); color: var(--verde); }
    .fila-punt { display: flex; align-items: center; gap: 8px; min-width: 96px; justify-content: flex-end; }
    .punt { font-family: var(--fuente-titulo); font-size: 1.6rem; font-weight: 600; line-height: 1; color: var(--titulo); font-variant-numeric: tabular-nums; }
    .punt[data-nivel='bueno'] { color: var(--verde); }
    .punt[data-nivel='mejoras'] { color: var(--ambar); }
    .punt[data-nivel='critico'] { color: var(--rojo); }
    .delta { padding: 2px 8px; border-radius: 999px; font-size: 11.5px; font-weight: 700; background: var(--borde); color: var(--suave); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .delta[data-dir='sube'] { background: rgba(34, 197, 94, 0.15); color: var(--verde); }
    .delta[data-dir='baja'] { background: rgba(239, 68, 68, 0.15); color: var(--rojo); }
    .delta[data-dir='nuevo'] { background: #2a3160; color: var(--acento-claro); }
    .chip-nivel { display: inline-block; padding: 3px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; }
    .chip-nivel[data-nivel='bueno'] { background: rgba(34, 197, 94, 0.16); color: var(--verde); }
    .chip-nivel[data-nivel='mejoras'] { background: rgba(245, 158, 11, 0.16); color: var(--ambar); }
    .chip-nivel[data-nivel='critico'] { background: rgba(239, 68, 68, 0.16); color: var(--rojo); }
    .ver { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; text-decoration: none; color: var(--acento-claro); white-space: nowrap; }
    .ver:hover { color: #fff; }

    .mas { align-self: center; padding: 10px 22px; border-radius: 999px; cursor: pointer; font: inherit; font-weight: 600; font-size: 14px; background: transparent; color: var(--texto); border: 1px solid var(--borde); }
    .mas:hover { border-color: var(--acento-claro); }

    @media (max-width: 1000px) {
      .resumen-cards { grid-template-columns: repeat(2, 1fr); }
      .fila { grid-template-columns: 10px minmax(0, 1fr) auto; row-gap: 10px; }
      .fila-hall { grid-column: 2 / -1; grid-row: 2; }
      .chip-nivel { grid-column: 2; grid-row: 3; justify-self: start; }
      .ver { grid-column: 3; grid-row: 3; }
      .fila-punt { grid-column: 3; grid-row: 1; }
    }
    @media (max-width: 520px) {
      .encabezado h1 { font-size: 1.9rem; }
      .grafica { grid-template-rows: 220px 28px; }
      .panel { padding: 18px 16px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .ent, .lienzo, .pt { animation: none; }
      .fila { transition: none; }
      .fila:hover { transform: none; }
    }
  `,
})
export class Historial {
  private servicio = inject(DominiosService);
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
