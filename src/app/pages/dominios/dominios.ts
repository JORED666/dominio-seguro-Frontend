import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { DominiosService } from '../../core/dominios.service';
import { Analisis, Dominio, ETIQUETA_NIVEL, Hallazgo, Nivel, Severidad, mensajeError } from '../../core/modelos';

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

const ORDEN: Record<Severidad, number> = { critica: 0, alta: 1, media: 2, baja: 3, info: 4 };
const ETIQ_SEV: Record<Severidad, string> = { critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja', info: 'Info' };

// Medidas de la mini gráfica (viewBox)
const GW = 160;
const GH = 52;
const GP = 4;

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
      <article class="stat" style="--i: 0">
        <div class="stat-top"><span class="stat-titulo">Dominios vigilados</span><span class="stat-icono"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" /></svg></span></div>
        <strong class="stat-valor">{{ n(conteo().todos) }}</strong>
      </article>
      <article class="stat" style="--i: 1">
        <div class="stat-top"><span class="stat-titulo">Puntaje promedio</span><span class="stat-icono"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M4 17a8 8 0 1116 0" /><path d="M12 17l4-5" stroke-linecap="round" /></svg></span></div>
        <strong class="stat-valor">
          {{ promedio() === null ? '—' : n(promedio()) }}<small> / 100</small>
        </strong>
        <div class="barra-prom"><span [style.width.%]="(promedio() ?? 0) * k()"></span></div>
      </article>
      <article class="stat" style="--i: 2">
        <div class="stat-top"><span class="stat-titulo">Dominios críticos</span><span class="stat-icono rojo"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" /><path d="M12 8v4M12 15v.5" stroke-linecap="round" /></svg></span></div>
        <strong class="stat-valor" [class.rojo]="conteo().critico > 0">{{ n(conteo().critico) }}</strong>
      </article>
      <article class="stat" style="--i: 3">
        <div class="stat-top"><span class="stat-titulo">Sin analizar</span><span class="stat-icono ambar"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" stroke-linecap="round" /></svg></span></div>
        <strong class="stat-valor" [class.ambar]="conteo().sin > 0">{{ n(conteo().sin) }}</strong>
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
        @for (d of visibles(); track d.id; let i = $index) {
          <article class="dominio" [attr.data-nivel]="d.nivel ?? 'sin'" [style.--i]="i + 4">
            <div class="dom-cab">
              <span class="dom-icono"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" /></svg></span>
              <h2 class="dom-nombre">{{ d.nombreDominio }}</h2>
              @if (d.nivel) {
                <span class="badge" [attr.data-nivel]="d.nivel">{{ etiqueta[d.nivel] }}</span>
              } @else {
                <span class="badge" data-nivel="sin">Sin analizar</span>
              }
            </div>

            <div class="dom-cuerpo">
              <div class="aro" [attr.data-nivel]="d.nivel ?? 'sin'" [style.--p]="(d.ultimoPuntaje ?? 0) * k()">
                <span class="aro-num">{{ n(d.ultimoPuntaje) }}</span>
                <span class="aro-txt">{{ d.nivel ? 'PUNTOS' : 'SIN DATOS' }}</span>
              </div>

              <div class="dom-info">
                @if (!d.nivel) {
                  <p class="pista">Haz el primer análisis para revisar su certificado, reputación y exposición.</p>
                  <p class="meta">Agregado el {{ fecha(d.creadoEn) }}</p>
                } @else if (info()[d.id]; as inf) {
                  <div class="fila-tend">
                    @if (inf.delta === null) {
                      <span class="delta" data-dir="nuevo">Primer análisis</span>
                    } @else if (inf.delta > 0) {
                      <span class="delta" data-dir="sube">▲ +{{ inf.delta }}</span>
                      <span class="vs">vs. el análisis anterior</span>
                    } @else if (inf.delta < 0) {
                      <span class="delta" data-dir="baja">▼ −{{ -inf.delta }}</span>
                      <span class="vs">vs. el análisis anterior</span>
                    } @else {
                      <span class="delta" data-dir="igual">＝ Sin cambios</span>
                      <span class="vs">vs. el análisis anterior</span>
                    }
                  </div>
                  @if (inf.serie.length > 1) {
                    <div class="spark" aria-hidden="true">
                      <svg viewBox="0 0 160 52" preserveAspectRatio="none">
                        <path class="area" [attr.d]="inf.area" />
                        <path class="linea" [attr.d]="inf.trazo" />
                      </svg>
                      <i class="punto-fin" [style.top.%]="inf.yUlt"></i>
                    </div>
                  } @else {
                    <p class="meta">La tendencia aparece desde el segundo análisis.</p>
                  }
                  <p class="meta">Último análisis: {{ inf.hace }}</p>
                } @else if (!extrasListos()) {
                  <div class="esqueleto" aria-hidden="true"><span></span><span></span><span></span></div>
                } @else {
                  <p class="meta">Agregado el {{ fecha(d.creadoEn) }}</p>
                }
              </div>
            </div>

            @if (d.nivel && info()[d.id]; as inf) {
              <div class="problema" [attr.data-sev]="inf.principal ? inf.principal.severidad : 'ok'">
                <span class="punto-sev"></span>
                <div class="problema-txt">
                  <small>{{ inf.principal ? 'Problema principal · ' + etiqSev[inf.principal.severidad] : 'Estado' }}</small>
                  <p>{{ inf.principal ? inf.principal.titulo : 'Sin problemas relevantes en el último análisis' }}</p>
                </div>
                @if (inf.relevantes > 0) {
                  <span class="cuenta">{{ inf.relevantes }} por revisar</span>
                }
              </div>
            }

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

    /* Entrada escalonada (backwards: al terminar no pisa el hover) */
    .stat, .dominio { animation: entra 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) backwards; animation-delay: calc(var(--i, 0) * 70ms); }
    @keyframes entra { from { opacity: 0; transform: translateY(14px); } }
    @keyframes revela { from { clip-path: inset(-12px 100% -12px 0); } }
    @keyframes aparece { from { opacity: 0; } }
    @keyframes brillo { from { background-position: 200% 0; } to { background-position: -200% 0; } }

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
    .stat-valor { font-family: var(--fuente-titulo); font-size: 2.5rem; line-height: 1; color: var(--titulo); font-variant-numeric: tabular-nums; }
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
    .dominio {
      --c: var(--acento);
      background: var(--tarjeta); border: 1px solid var(--borde); border-radius: 26px; padding: 22px;
      display: flex; flex-direction: column; gap: 16px;
      transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
    }
    .dominio[data-nivel='bueno'] { --c: var(--verde); }
    .dominio[data-nivel='mejoras'] { --c: var(--ambar); }
    .dominio[data-nivel='critico'] { --c: var(--rojo); }
    .dominio[data-nivel='critico'] { border-color: rgba(239, 68, 68, 0.35); }
    .dominio:hover {
      transform: translateY(-3px);
      border-color: color-mix(in srgb, var(--c) 55%, var(--borde));
      box-shadow: 0 18px 44px -22px var(--c);
    }

    .dom-cab { display: flex; align-items: center; gap: 14px; }
    .dom-icono { width: 44px; height: 44px; flex: none; display: grid; place-items: center; border-radius: 14px; background: #1b2040; border: 1px solid var(--borde); color: var(--acento-claro); }
    .dom-nombre { margin: 0; font-size: 1.3rem; word-break: break-all; flex: 1; min-width: 0; }
    .dom-cab .badge { flex: none; }
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
    .aro-num { font-family: var(--fuente-titulo); font-size: 1.7rem; font-weight: 600; line-height: 1; color: var(--titulo); font-variant-numeric: tabular-nums; }
    .aro[data-nivel='bueno'] .aro-num { color: var(--verde); }
    .aro[data-nivel='mejoras'] .aro-num { color: var(--ambar); }
    .aro[data-nivel='critico'] .aro-num { color: var(--rojo); }
    .aro-txt { font-size: 9px; letter-spacing: 0.08em; color: var(--suave); margin-top: 3px; }

    .dom-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
    .fila-tend { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .delta { padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: var(--borde); color: var(--texto); font-variant-numeric: tabular-nums; }
    .delta[data-dir='sube'] { background: rgba(34, 197, 94, 0.15); color: var(--verde); }
    .delta[data-dir='baja'] { background: rgba(239, 68, 68, 0.15); color: var(--rojo); }
    .delta[data-dir='nuevo'] { background: #2a3160; color: var(--acento-claro); }
    .vs { font-size: 12px; color: var(--suave); }

    .spark { position: relative; height: 52px; color: var(--c); }
    .spark svg { display: block; width: 100%; height: 100%; overflow: visible; animation: revela 1s ease-out 0.5s backwards; }
    .spark .linea { fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
    .spark .area { fill: currentColor; opacity: 0.12; stroke: none; }
    .punto-fin {
      position: absolute; right: 2.5%; width: 9px; height: 9px; margin: -4.5px -4.5px 0 0; border-radius: 50%;
      background: currentColor; box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 25%, transparent);
      animation: aparece 0.4s ease-out 1.3s backwards;
    }
    .meta { margin: 0; color: var(--suave); font-size: 12.5px; }
    .pista { margin: 0; color: var(--acento-claro); font-size: 13px; }

    .esqueleto { display: flex; flex-direction: column; gap: 10px; }
    .esqueleto span { height: 12px; border-radius: 6px; background: linear-gradient(90deg, var(--borde) 25%, #454b6e 50%, var(--borde) 75%); background-size: 200% 100%; animation: brillo 1.4s linear infinite; }
    .esqueleto span:nth-child(1) { width: 45%; }
    .esqueleto span:nth-child(2) { width: 100%; height: 30px; }
    .esqueleto span:nth-child(3) { width: 60%; }

    .problema {
      --s: var(--suave);
      display: flex; align-items: center; gap: 14px; padding: 12px 16px;
      background: color-mix(in srgb, var(--s) 7%, var(--fondo)); border: 1px solid var(--borde); border-left: 3px solid var(--s); border-radius: 14px;
    }
    .problema[data-sev='critica'] { --s: var(--rojo); }
    .problema[data-sev='alta'] { --s: var(--naranja); }
    .problema[data-sev='media'] { --s: var(--ambar); }
    .problema[data-sev='baja'] { --s: var(--acento-claro); }
    .problema[data-sev='ok'] { --s: var(--verde); }
    .punto-sev { flex: none; width: 10px; height: 10px; border-radius: 50%; background: var(--s); box-shadow: 0 0 0 4px color-mix(in srgb, var(--s) 22%, transparent); }
    .problema-txt { flex: 1; min-width: 0; }
    .problema-txt small { display: block; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--s); }
    .problema-txt p { margin: 2px 0 0; font-size: 14px; color: var(--texto); }
    .cuenta { flex: none; font-size: 12px; color: var(--suave); white-space: nowrap; }

    .dom-pie { display: flex; justify-content: space-between; align-items: center; gap: 12px; border-top: 1px solid var(--borde); padding-top: 16px; }
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
      .dom-cab { flex-wrap: wrap; }
      .dom-cuerpo { flex-direction: column; text-align: center; }
      .dom-info { align-items: stretch; }
      .fila-tend { justify-content: center; }
      .problema { flex-wrap: wrap; }
    }
    @media (prefers-reduced-motion: reduce) {
      .stat, .dominio, .spark svg, .punto-fin, .esqueleto span { animation: none; }
      .dominio { transition: none; }
      .dominio:hover { transform: none; }
    }
  `,
})
export class Dominios {
  private servicio = inject(DominiosService);
  private router = inject(Router);
  private destruir = inject(DestroyRef);

  etiqueta = ETIQUETA_NIVEL;
  etiqSev = ETIQ_SEV;
  filtros: { valor: Filtro; texto: string }[] = [
    { valor: 'todos', texto: 'Todos' },
    { valor: 'bueno', texto: 'Bueno' },
    { valor: 'mejoras', texto: 'Necesita mejoras' },
    { valor: 'critico', texto: 'Crítico' },
    { valor: 'sin', texto: 'Sin analizar' },
  ];

  dominios = signal<Dominio[]>([]);
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

  // Progreso (0 a 1) de la animación de números y aros
  k = signal(0);
  private raf = 0;
  private yaAnimado = false;
  private reducir = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    this.destruir.onDestroy(() => cancelAnimationFrame(this.raf));
    this.cargar();
  }

  // Número animado: sube de 0 al valor real durante la entrada
  n(v: number | null): string | number {
    return v === null ? '--' : Math.round(v * this.k());
  }

  fecha(iso: string) {
    return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  private hace(iso: string): string {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    if (s < 3600) return rtf.format(-Math.max(1, Math.round(s / 60)), 'minute');
    if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
    return rtf.format(-Math.round(s / 86400), 'day');
  }

  private animarEntrada() {
    if (this.yaAnimado) return;
    this.yaAnimado = true;
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

  // Tendencia, último análisis y problema principal, a partir del historial de cada dominio
  private armarInfo(h: Analisis[]): Info {
    const serie = h
      .slice(0, 8)
      .map((a) => a.puntaje)
      .reverse();
    const relevantes = (h[0].hallazgos ?? []).filter((x) => x.severidad !== 'info');
    const principal = [...relevantes].sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad])[0] ?? null;

    const xs = serie.map((_, i) => GP + (i * (GW - 2 * GP)) / Math.max(1, serie.length - 1));
    const ys = serie.map((v) => GH - GP - (Math.min(100, Math.max(0, v)) / 100) * (GH - 2 * GP));
    const trazo = serie.length > 1 ? 'M' + xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' L') : '';
    const area = trazo ? `${trazo} L${xs[xs.length - 1].toFixed(1)},${GH - GP} L${xs[0].toFixed(1)},${GH - GP} Z` : '';

    return {
      serie,
      delta: h.length > 1 ? h[0].puntaje - h[1].puntaje : null,
      hace: this.hace(h[0].fecha),
      principal,
      relevantes: relevantes.length,
      trazo,
      area,
      yUlt: (ys[ys.length - 1] / GH) * 100,
    };
  }

  private cargarExtras(lista: Dominio[]) {
    const con = lista.filter((d) => d.nivel);
    if (!con.length) {
      this.extrasListos.set(true);
      return;
    }
    forkJoin(con.map((d) => this.servicio.historial(d.id).pipe(catchError(() => of([] as Analisis[]))))).subscribe((res) => {
      const mapa: Record<string, Info> = {};
      con.forEach((d, i) => {
        if (res[i].length) mapa[d.id] = this.armarInfo(res[i]);
      });
      this.info.set(mapa);
      this.extrasListos.set(true);
    });
  }

  cargar() {
    this.servicio.listar().subscribe({
      next: (lista) => {
        this.dominios.set(lista);
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
