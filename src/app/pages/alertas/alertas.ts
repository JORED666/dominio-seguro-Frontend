import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { DominiosService } from '../../core/dominios.service';
import { Analisis, Dominio, Hallazgo, Severidad, mensajeError } from '../../core/modelos';

type Sev = Severidad | 'ok';
type Tipo = 'hallazgo' | 'caida' | 'mejora' | 'resuelto' | 'inactivo' | 'sin-analisis';
type Filtro = 'todas' | 'graves' | 'nuevas' | 'buenas';

interface Alerta {
  id: string;
  tipo: Tipo;
  sev: Sev;
  dominioId: string;
  dominio: string;
  enlace: string[];
  titulo: string;
  detalle: string;
  recomendacion: string;
  categoria: string;
  desde: number; // desde cuándo se conoce (ms)
  nueva: boolean; // apareció en el análisis más reciente
}

const ORDEN: Record<Sev, number> = { critica: 0, alta: 1, media: 2, baja: 3, info: 4, ok: 5 };
const ETIQUETA: Record<Sev, string> = { critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja', info: 'Info', ok: 'Buena noticia' };
const DIA = 864e5;
const CLAVE_DESCARTADAS = 'ds-alertas-descartadas';
const DIAS_SIN_ANALISIS = 7;
const CAMBIO_RELEVANTE = 10;

const relevantes = (a: Analisis): Hallazgo[] => (a.hallazgos ?? []).filter((x) => x.severidad !== 'info');
const clave = (x: Hallazgo) => x.categoria + '|' + x.titulo;

function leerDescartadas(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_DESCARTADAS) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

// Convierte el historial de un dominio en las alertas que merece
function construir(d: Dominio, h: Analisis[]): Alerta[] {
  const base = { dominioId: d.id, dominio: d.nombreDominio, enlace: ['/dominios', d.id] };
  if (!h.length) {
    return [
      {
        ...base,
        enlace: ['/dominios'],
        id: `${d.id}|sin-analisis`,
        tipo: 'sin-analisis',
        sev: 'baja',
        titulo: 'Todavía no analizas este dominio',
        detalle: 'Sin un primer análisis no sabemos si su certificado, su reputación o sus puertos tienen problemas.',
        recomendacion: 'En Mis dominios pulsa «Primer análisis» en este dominio.',
        categoria: 'Pendiente',
        desde: new Date(d.creadoEn).getTime(),
        nueva: false,
      },
    ];
  }

  const out: Alerta[] = [];
  const ult = h[0];
  const prev = h[1];
  const fUlt = new Date(ult.fecha).getTime();
  const clavesPrev = new Set(prev ? relevantes(prev).map(clave) : []);
  const clavesUlt = new Set(relevantes(ult).map(clave));

  // Un hallazgo es una alerta mientras siga apareciendo; "desde" es la primera vez de la racha actual
  for (const x of relevantes(ult)) {
    let desde = fUlt;
    for (let j = 1; j < h.length; j++) {
      if (relevantes(h[j]).some((y) => clave(y) === clave(x))) desde = new Date(h[j].fecha).getTime();
      else break;
    }
    out.push({
      ...base,
      id: `${d.id}|h|${clave(x)}`,
      tipo: 'hallazgo',
      sev: x.severidad,
      titulo: x.titulo,
      detalle: x.descripcion,
      recomendacion: x.recomendacion,
      categoria: x.categoria,
      desde,
      nueva: !!prev && !clavesPrev.has(clave(x)),
    });
  }

  if (prev) {
    const delta = ult.puntaje - prev.puntaje;
    if (delta <= -CAMBIO_RELEVANTE) {
      out.push({
        ...base,
        id: `${d.id}|caida|${ult.id}`,
        tipo: 'caida',
        sev: delta <= -25 ? 'critica' : 'alta',
        titulo: `El puntaje bajó ${-delta} puntos`,
        detalle: `Pasó de ${prev.puntaje} a ${ult.puntaje} desde el análisis anterior.`,
        recomendacion: 'Revisa los hallazgos nuevos de este dominio: algo cambió en su configuración.',
        categoria: 'Tendencia',
        desde: fUlt,
        nueva: true,
      });
    } else if (delta >= CAMBIO_RELEVANTE) {
      out.push({
        ...base,
        id: `${d.id}|mejora|${ult.id}`,
        tipo: 'mejora',
        sev: 'ok',
        titulo: `El puntaje subió ${delta} puntos`,
        detalle: `Pasó de ${prev.puntaje} a ${ult.puntaje} desde el análisis anterior.`,
        recomendacion: '',
        categoria: 'Tendencia',
        desde: fUlt,
        nueva: true,
      });
    }
    for (const x of relevantes(prev)) {
      if (clavesUlt.has(clave(x))) continue;
      out.push({
        ...base,
        id: `${d.id}|resuelto|${clave(x)}|${ult.id}`,
        tipo: 'resuelto',
        sev: 'ok',
        titulo: `Resuelto: ${x.titulo}`,
        detalle: 'Ya no aparece en el análisis más reciente.',
        recomendacion: '',
        categoria: x.categoria,
        desde: fUlt,
        nueva: true,
      });
    }
  }

  const dias = (Date.now() - fUlt) / DIA;
  if (dias > DIAS_SIN_ANALISIS) {
    out.push({
      ...base,
      id: `${d.id}|inactivo`,
      tipo: 'inactivo',
      sev: 'media',
      titulo: `Hace ${Math.floor(dias)} días que no analizas este dominio`,
      detalle: 'Un certificado puede vencer o un puerto puede abrirse en cualquier momento.',
      recomendacion: 'Vuelve a analizarlo para confirmar que sigue en buen estado.',
      categoria: 'Mantenimiento',
      desde: fUlt,
      nueva: false,
    });
  }
  return out;
}

@Component({
  selector: 'app-alertas',
  imports: [RouterLink],
  template: `
    <header class="encabezado ent" style="--i: 0">
      <div>
        <p class="etiqueta-panel">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 1112 0c0 6 2 7 2 7H4s2-1 2-7" /><path d="M10 20a2 2 0 004 0" /></svg>
          CENTRO DE ALERTAS
        </p>
        <h1>Alertas</h1>
        <p class="sub">Lo que necesita tu atención, calculado a partir de tus análisis</p>
      </div>
      @if (leyenda().length > 1) {
        <label class="selector">
          <span>Dominio</span>
          <select [value]="dominioSel()" (change)="dominioSel.set($any($event.target).value)" aria-label="Filtrar por dominio">
            <option value="">Todos</option>
            @for (d of leyenda(); track d.id) { <option [value]="d.id">{{ d.nombre }}</option> }
          </select>
        </label>
      }
    </header>

    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }

    @if (cargando()) {
      <p class="sub">Cargando…</p>
    } @else if (leyenda().length === 0) {
      <section class="panel vacio">
        <h2>Aún no tienes dominios</h2>
        <p class="sub">Agrega uno en <a routerLink="/dominios">Mis dominios</a> y las alertas aparecerán aquí.</p>
      </section>
    } @else {
      <section class="resumen-cards">
        <article class="stat ent" style="--i: 1">
          <span class="stat-titulo">Alertas activas</span>
          <strong class="stat-valor">{{ n(cuentas().activas) }}</strong>
          <span class="stat-pie">por revisar</span>
        </article>
        <article class="stat ent" style="--i: 2">
          <span class="stat-titulo">Graves</span>
          <strong class="stat-valor" [class.rojo]="cuentas().graves > 0">{{ n(cuentas().graves) }}</strong>
          <span class="stat-pie">críticas y altas</span>
        </article>
        <article class="stat ent" style="--i: 3">
          <span class="stat-titulo">Nuevas</span>
          <strong class="stat-valor" [class.ambar]="cuentas().nuevas > 0">{{ n(cuentas().nuevas) }}</strong>
          <span class="stat-pie">desde el análisis anterior</span>
        </article>
        <article class="stat ent" style="--i: 4">
          <span class="stat-titulo">Buenas noticias</span>
          <strong class="stat-valor" [class.verde]="cuentas().buenas > 0">{{ n(cuentas().buenas) }}</strong>
          <span class="stat-pie">mejoras y problemas resueltos</span>
        </article>
      </section>

      <section class="filtros ent" style="--i: 5">
        <div class="chips" role="group" aria-label="Filtrar alertas">
          @for (f of filtros; track f.valor) {
            <button type="button" class="chip" [class.activo]="filtro() === f.valor" (click)="filtro.set(f.valor)">
              {{ f.texto }} ({{ cuentaFiltro(f.valor) }})
            </button>
          }
        </div>
        @if (descartadas().length > 0) {
          <button type="button" class="enlace" (click)="verDescartadas.set(!verDescartadas())">
            {{ verDescartadas() ? 'Volver a las activas' : 'Ver descartadas (' + descartadas().length + ')' }}
          </button>
        }
      </section>

      @if (secciones().length === 0) {
        <section class="panel vacio ent" style="--i: 6">
          @if (verDescartadas()) {
            <p class="sub" style="margin:0">No hay alertas descartadas.</p>
          } @else if (cuentas().activas === 0 && filtro() === 'todas') {
            <span class="todo-ok" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" /><path d="m9 12 2 2 4-4" /></svg>
            </span>
            <h2>Todo en orden</h2>
            <p class="sub">No hay alertas activas. Sigue analizando tus dominios de vez en cuando para mantenerlo así.</p>
          } @else {
            <p class="sub" style="margin:0">Ninguna alerta coincide con el filtro elegido.</p>
          }
        </section>
      } @else {
        @for (s of secciones(); track s.titulo; let si = $index) {
          <section class="seccion ent" [style.--i]="6 + si">
            <header class="sec-cab">
              <h2>{{ s.titulo }}</h2>
              <span class="sec-cuenta">{{ s.items.length }}</span>
              <p>{{ s.descripcion }}</p>
            </header>
            <ul class="lista">
              @for (a of s.items; track a.id) {
                <li class="alerta" [attr.data-sev]="a.sev">
                  <span class="icono" aria-hidden="true">
                    @switch (a.sev) {
                      @case ('critica') { <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" /><path d="M12 8v4M12 15v.5" /></svg> }
                      @case ('alta') { <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" /><path d="M12 8v4M12 15v.5" /></svg> }
                      @case ('media') { <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 2.5 20h19z" /><path d="M12 10v4M12 17v.5" /></svg> }
                      @case ('ok') { <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg> }
                      @default { <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.5" /></svg> }
                    }
                  </span>
                  <div class="cuerpo">
                    <div class="cab">
                      <strong>{{ a.titulo }}</strong>
                      @if (a.nueva && a.sev !== 'ok') { <span class="nueva">Nueva</span> }
                      <span class="sev-etq" [attr.data-sev]="a.sev">{{ etiqueta[a.sev] }}</span>
                    </div>
                    <p class="meta">
                      <a [routerLink]="['/dominios', a.dominioId]" class="dom">{{ a.dominio }}</a>
                      <span class="punto"></span><span>{{ a.categoria }}</span>
                      <span class="punto"></span><span>{{ cuando(a) }}</span>
                    </p>
                    <p class="detalle">{{ a.detalle }}</p>
                    @if (a.recomendacion) {
                      <p class="reco"><span>Qué hacer</span>{{ a.recomendacion }}</p>
                    }
                    <div class="acciones">
                      <a class="btn-sec" [routerLink]="a.enlace">{{ a.tipo === 'sin-analisis' ? 'Ir a Mis dominios' : 'Ver detalle' }}</a>
                      @if (verDescartadas()) {
                        <button type="button" class="enlace" (click)="restaurar(a.id)">Restaurar</button>
                      } @else {
                        <button type="button" class="enlace" (click)="descartar(a.id)">Descartar</button>
                      }
                    </div>
                  </div>
                </li>
              }
            </ul>
          </section>
        }
      }
    }
  `,
  styles: `
    :host { display: block; }

    .ent { animation: entra 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) backwards; animation-delay: calc(var(--i, 0) * 70ms); }
    @keyframes entra { from { opacity: 0; transform: translateY(14px); } }

    .encabezado { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
    .etiqueta-panel { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; color: var(--acento-claro); font-size: 12px; font-weight: 600; letter-spacing: 0.08em; }
    .encabezado h1 { font-size: 2.6rem; line-height: 1.1; margin: 0; }
    .encabezado .sub { margin: 6px 0 0; }

    .selector { display: flex; flex-direction: row; align-items: center; gap: 10px; padding: 6px 8px 6px 16px; background: var(--tarjeta); border: 1px solid var(--borde); border-radius: 999px; font-size: 13px; color: var(--suave); }
    .selector select { height: 34px; padding: 0 12px; border-radius: 999px; border: 0; background: var(--tarjeta-2); color: var(--texto); font: inherit; font-size: 13px; cursor: pointer; max-width: 240px; }
    .selector select:focus-visible { outline: 3px solid rgba(91, 108, 248, 0.55); }

    .panel { background: var(--tarjeta); border: 1px solid var(--borde); border-radius: 24px; padding: 22px 24px; }
    .vacio { text-align: center; border-style: dashed; padding: 44px 16px; }
    .vacio a { color: var(--acento-claro); }
    .todo-ok { display: inline-grid; place-items: center; width: 64px; height: 64px; margin-bottom: 10px; border-radius: 50%; background: rgba(34, 197, 94, 0.14); color: var(--verde); }

    .resumen-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
    .stat { background: var(--tarjeta); border: 1px solid var(--borde); border-radius: 22px; padding: 18px 22px; display: flex; flex-direction: column; gap: 8px; }
    .stat-titulo { color: var(--suave); font-size: 13px; }
    .stat-valor { font-family: var(--fuente-titulo); font-size: 2.4rem; line-height: 1.05; color: var(--titulo); font-variant-numeric: tabular-nums; }
    .stat-valor.rojo { color: var(--rojo); }
    .stat-valor.ambar { color: var(--ambar); }
    .stat-valor.verde { color: var(--verde); }
    .stat-pie { font-size: 12.5px; color: var(--suave); }

    .filtros { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .chip { padding: 7px 14px; border-radius: 999px; cursor: pointer; font: inherit; font-size: 13px; background: transparent; color: var(--suave); border: 1px solid var(--borde); }
    .chip:hover { color: var(--texto); }
    .chip.activo { background: var(--acento); border-color: var(--acento); color: #fff; }
    .enlace { padding: 6px 4px; border: 0; background: none; cursor: pointer; font: inherit; font-size: 13px; font-weight: 600; color: var(--acento-claro); }
    .enlace:hover { color: #fff; }

    .seccion { margin-bottom: 26px; }
    .sec-cab { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
    .sec-cab h2 { margin: 0; font-size: 1.25rem; }
    .sec-cuenta { min-width: 24px; padding: 1px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; text-align: center; background: var(--borde); color: var(--texto); }
    .sec-cab p { flex-basis: 100%; margin: 0; font-size: 13.5px; color: var(--suave); }

    .lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
    .alerta {
      --c: var(--acento-claro);
      display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 16px; padding: 18px 20px;
      background: var(--tarjeta); border: 1px solid var(--borde); border-left: 3px solid var(--c); border-radius: 18px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .alerta[data-sev='critica'] { --c: var(--rojo); }
    .alerta[data-sev='alta'] { --c: var(--naranja); }
    .alerta[data-sev='media'] { --c: var(--ambar); }
    .alerta[data-sev='baja'] { --c: var(--acento-claro); }
    .alerta[data-sev='ok'] { --c: var(--verde); }
    .alerta:hover { border-color: color-mix(in srgb, var(--c) 45%, var(--borde)); border-left-color: var(--c); box-shadow: 0 16px 40px -24px var(--c); }
    .icono { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 14px; color: var(--c); background: color-mix(in srgb, var(--c) 14%, var(--tarjeta-2)); border: 1px solid color-mix(in srgb, var(--c) 30%, var(--borde)); }
    .cuerpo { min-width: 0; }
    .cab { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .cab strong { color: var(--titulo); font-size: 1.02rem; }
    .nueva { padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; background: var(--acento); color: #fff; }
    .sev-etq { margin-left: auto; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: color-mix(in srgb, var(--c) 16%, transparent); color: var(--c); }
    .meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 6px 0 0; font-size: 13px; color: var(--suave); }
    .dom { color: var(--texto); font-weight: 600; text-decoration: none; }
    .dom:hover { color: var(--acento-claro); }
    .punto { width: 3px; height: 3px; border-radius: 50%; background: var(--suave); }
    .detalle { margin: 10px 0 0; font-size: 14px; color: var(--suave); }
    .reco { margin: 12px 0 0; padding: 10px 12px; border-radius: 10px; background: rgba(91, 108, 248, 0.1); color: var(--texto); font-size: 14px; }
    .reco span { display: block; margin-bottom: 2px; color: var(--acento-claro); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    .acciones { display: flex; align-items: center; gap: 14px; margin-top: 14px; }
    .btn-sec { height: 36px; padding: 0 18px; display: inline-flex; align-items: center; border-radius: 999px; font-size: 13px; font-weight: 600; text-decoration: none; color: var(--texto); border: 1px solid var(--borde); }
    .btn-sec:hover { border-color: var(--acento-claro); }

    @media (max-width: 1000px) {
      .resumen-cards { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 560px) {
      .encabezado h1 { font-size: 1.9rem; }
      .alerta { grid-template-columns: 1fr; padding: 16px; }
      .icono { width: 38px; height: 38px; }
      .sev-etq { margin-left: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .ent { animation: none; }
    }
  `,
})
export class Alertas {
  private servicio = inject(DominiosService);
  private destruir = inject(DestroyRef);

  etiqueta = ETIQUETA;
  filtros: { valor: Filtro; texto: string }[] = [
    { valor: 'todas', texto: 'Todas' },
    { valor: 'graves', texto: 'Graves' },
    { valor: 'nuevas', texto: 'Nuevas' },
    { valor: 'buenas', texto: 'Buenas noticias' },
  ];

  cargando = signal(true);
  error = signal('');
  leyenda = signal<{ id: string; nombre: string }[]>([]);
  alertas = signal<Alerta[]>([]);

  filtro = signal<Filtro>('todas');
  dominioSel = signal('');
  descartadas = signal<string[]>(leerDescartadas());
  verDescartadas = signal(false);

  // Progreso (0 a 1) de la animación de los números
  k = signal(0);
  private raf = 0;
  private reducir = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Alertas del dominio elegido, separando activas y descartadas
  private delDominio = computed(() => {
    const d = this.dominioSel();
    return this.alertas().filter((a) => !d || a.dominioId === d);
  });

  private visibles = computed(() => {
    const desc = this.descartadas();
    const ver = this.verDescartadas();
    return this.delDominio().filter((a) => desc.includes(a.id) === ver);
  });

  cuentas = computed(() => {
    const l = this.delDominio().filter((a) => !this.descartadas().includes(a.id));
    const activas = l.filter((a) => a.sev !== 'ok');
    return {
      activas: activas.length,
      graves: activas.filter((a) => a.sev === 'critica' || a.sev === 'alta').length,
      nuevas: activas.filter((a) => a.nueva).length,
      buenas: l.filter((a) => a.sev === 'ok').length,
    };
  });

  private coincide(a: Alerta, f: Filtro): boolean {
    return f === 'todas' || (f === 'graves' && (a.sev === 'critica' || a.sev === 'alta')) || (f === 'nuevas' && a.nueva && a.sev !== 'ok') || (f === 'buenas' && a.sev === 'ok');
  }

  cuentaFiltro(f: Filtro): number {
    return this.visibles().filter((a) => this.coincide(a, f)).length;
  }

  secciones = computed(() => {
    const f = this.filtro();
    const lista = this.visibles()
      .filter((a) => this.coincide(a, f))
      .sort((a, b) => ORDEN[a.sev] - ORDEN[b.sev] || b.desde - a.desde);
    const defs: { titulo: string; descripcion: string; sevs: Sev[] }[] = [
      { titulo: 'Requieren acción', descripcion: 'Problemas graves que conviene resolver cuanto antes.', sevs: ['critica', 'alta'] },
      { titulo: 'Conviene revisar', descripcion: 'No son urgentes, pero reducen tu puntaje.', sevs: ['media', 'baja'] },
      { titulo: 'Buenas noticias', descripcion: 'Mejoras y problemas que ya quedaron resueltos.', sevs: ['ok'] },
    ];
    return defs
      .map((d) => ({ titulo: d.titulo, descripcion: d.descripcion, items: lista.filter((a) => d.sevs.includes(a.sev)) }))
      .filter((s) => s.items.length > 0);
  });

  constructor() {
    this.destruir.onDestroy(() => cancelAnimationFrame(this.raf));
    this.cargar();
  }

  n(v: number): number {
    return Math.round(v * this.k());
  }

  cuando(a: Alerta): string {
    const s = Math.max(0, (Date.now() - a.desde) / 1000);
    const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    const t = s < 3600 ? rtf.format(-Math.max(1, Math.round(s / 60)), 'minute') : s < 86400 ? rtf.format(-Math.round(s / 3600), 'hour') : rtf.format(-Math.round(s / 86400), 'day');
    return a.tipo === 'hallazgo' ? `Activa desde ${t}` : a.tipo === 'sin-analisis' ? `Agregado ${t}` : `Detectada ${t}`;
  }

  descartar(id: string) {
    this.guardar([...this.descartadas(), id]);
  }

  restaurar(id: string) {
    const resto = this.descartadas().filter((x) => x !== id);
    this.guardar(resto);
    if (!resto.length) this.verDescartadas.set(false);
  }

  private guardar(lista: string[]) {
    this.descartadas.set(lista);
    try {
      localStorage.setItem(CLAVE_DESCARTADAS, JSON.stringify(lista));
    } catch {
      /* sin almacenamiento: se descarta solo mientras la página siga abierta */
    }
  }

  private animarEntrada() {
    cancelAnimationFrame(this.raf);
    if (this.reducir) {
      this.k.set(1);
      return;
    }
    const t0 = performance.now();
    const paso = (t: number) => {
      const x = Math.min(1, (t - t0) / 900);
      this.k.set(1 - Math.pow(1 - x, 3));
      if (x < 1) this.raf = requestAnimationFrame(paso);
    };
    this.raf = requestAnimationFrame(paso);
  }

  private cargar() {
    this.servicio.listar().subscribe({
      next: (lista) => {
        this.leyenda.set(lista.map((d) => ({ id: d.id, nombre: d.nombreDominio })));
        const con = lista.filter((d) => d.nivel);
        const sin = lista.filter((d) => !d.nivel);
        const terminar = (res: Analisis[][]) => {
          const todas: Alerta[] = [];
          con.forEach((d, i) => {
            if (res[i].length) todas.push(...construir(d, res[i]));
          });
          sin.forEach((d) => todas.push(...construir(d, [])));
          this.alertas.set(todas);
          this.cargando.set(false);
          this.animarEntrada();
        };
        if (!con.length) return terminar([]);
        forkJoin(con.map((d) => this.servicio.historial(d.id).pipe(catchError(() => of([] as Analisis[]))))).subscribe(terminar);
      },
      error: (e) => {
        this.error.set(mensajeError(e));
        this.cargando.set(false);
      },
    });
  }
}
