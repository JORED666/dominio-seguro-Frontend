import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DominiosService } from '../../core/dominios.service';
import { Analisis, Dominio, ETIQUETA_NIVEL, Hallazgo, Severidad, mensajeError } from '../../core/modelos';

const ORDEN: Record<Severidad, number> = { critica: 0, alta: 1, media: 2, baja: 3, info: 4 };
const ETIQUETA_SEVERIDAD: Record<Severidad, string> = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
  info: 'Info',
};
const ORDEN_CATEGORIAS = ['TLS', 'Reputación', 'Exposición', 'Subdominios'];
const MENSAJE_NIVEL = {
  bueno: 'La configuración de seguridad es sólida. Revisa los puntos informativos para mantenerla así.',
  mejoras: 'Hay aspectos que conviene corregir pronto para reducir el riesgo.',
  critico: 'Hay problemas graves que requieren atención inmediata.',
};

interface Grupo {
  categoria: string;
  items: Hallazgo[];
  peor: Severidad;
  problemas: number;
}

@Component({
  selector: 'app-resultado',
  imports: [RouterLink, DatePipe],
  template: `
    <a class="volver-link" routerLink="/dominios">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
      Volver a mis dominios
    </a>

    @if (cargando()) {
      <p class="sub">Cargando…</p>
    } @else if (!ultimo()) {
      <header class="cab">
        <div>
          <h1>{{ dominio()?.nombreDominio }}</h1>
          <p class="sub">Este dominio todavía no tiene análisis.</p>
        </div>
        <button class="btn-prim" type="button" [disabled]="analizando()" (click)="reanalizar()">
          {{ analizando() ? 'Analizando… (hasta 30 s)' : 'Primer análisis' }}
        </button>
      </header>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
    } @else {
      <header class="cab">
        <div>
          <p class="etiqueta">ANÁLISIS DE SEGURIDAD</p>
          <h1>{{ dominio()?.nombreDominio }}</h1>
          <p class="sub meta">
            <span>{{ ultimo()!.fecha | date: 'dd/MM/yyyy HH:mm' }}</span>
            <span class="punto"></span>
            <span>Duración {{ (ultimo()!.duracionMs / 1000).toFixed(1) }} s</span>
          </p>
        </div>
        <button class="btn-prim" type="button" [disabled]="analizando()" (click)="reanalizar()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>
          {{ analizando() ? 'Analizando… (hasta 30 s)' : 'Analizar de nuevo' }}
        </button>
      </header>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }

      <section class="panel resumen">
        <div class="aro" [attr.data-nivel]="ultimo()!.nivel" [style.--p]="ultimo()!.puntaje">
          <span class="aro-num">{{ ultimo()!.puntaje }}</span>
          <span class="aro-txt">DE 100</span>
        </div>
        <div class="res-centro">
          <span class="chip-nivel" [attr.data-nivel]="ultimo()!.nivel">{{ etiqueta[ultimo()!.nivel] }}</span>
          <p class="res-texto">{{ mensaje[ultimo()!.nivel] }}</p>
          <div class="escala" aria-hidden="true"><span class="marca" [style.left.%]="ultimo()!.puntaje"></span></div>
          <div class="escala-leyenda" aria-hidden="true"><span>Crítico</span><span>Mejoras</span><span>Bueno</span></div>
        </div>
        <div class="res-conteo">
          <div><strong class="n-prob">{{ conteo().problemas }}</strong><span>Por corregir</span></div>
          <div><strong class="n-ok">{{ conteo().info }}</strong><span>Informativos</span></div>
          <div><strong>{{ grupos().length }}</strong><span>Categorías</span></div>
        </div>
      </section>

      <div class="rejilla">
        <div class="principal">
          <h2 class="titulo-seccion">Hallazgos por categoría</h2>
          @for (g of grupos(); track g.categoria) {
            <section class="panel grupo">
              <header class="grupo-cab">
                <span class="grupo-icono" [attr.data-sev]="g.peor">
                  @switch (g.categoria) {
                    @case ('TLS') {
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/></svg>
                    }
                    @case ('Reputación') {
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>
                    }
                    @case ('Exposición') {
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01"/></svg>
                    }
                    @default {
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>
                    }
                  }
                </span>
                <h3>{{ g.categoria }}</h3>
                <span class="grupo-estado" [attr.data-sev]="g.peor">
                  {{ g.problemas > 0 ? g.problemas + ' por corregir' : 'Sin problemas' }}
                </span>
              </header>
              @for (h of g.items; track h.id) {
                <article class="hallazgo" [attr.data-sev]="h.severidad">
                  <div class="h-cab">
                    <span class="sev" [attr.data-sev]="h.severidad">{{ sev[h.severidad] }}</span>
                    <strong>{{ h.titulo }}</strong>
                  </div>
                  <p class="h-desc">{{ h.descripcion }}</p>
                  @if (h.severidad !== 'info') {
                    <p class="h-reco"><span>Qué hacer</span>{{ h.recomendacion }}</p>
                  }
                </article>
              }
            </section>
          }
        </div>

        <aside class="lateral">
          @if (detalle(); as det) {
            @if (det.certificado; as c) {
              <section class="panel">
                <h3 class="lat-titulo">Certificado TLS</h3>
                <dl class="datos">
                  <dt>Emisor</dt><dd>{{ c.emisor }}</dd>
                  <dt>Protocolo</dt><dd>{{ c.protocolo }}</dd>
                  <dt>Vence</dt>
                  <dd>
                    {{ c.venceEn | date: 'dd/MM/yyyy' }}
                    @if (c.diasRestantes !== null) { <small>({{ c.diasRestantes }} días)</small> }
                  </dd>
                  <dt>Confiable</dt>
                  <dd><span class="si-no" [attr.data-ok]="c.autorizado">{{ c.autorizado ? 'Sí' : 'No' }}</span></dd>
                </dl>
              </section>
            }
            @if (det.reputacion || det.exposicion) {
              <section class="panel">
                <h3 class="lat-titulo">Red e infraestructura</h3>
                <dl class="datos">
                  @if (det.reputacion; as r) {
                    <dt>Proveedor</dt><dd>{{ r.asn || 'Desconocido' }}</dd>
                    <dt>Riesgo de IP</dt><dd>{{ r.riesgo }} / 100</dd>
                  }
                  @if (det.exposicion; as e) {
                    <dt>Puertos</dt>
                    <dd>
                      @if (e.puertos.length) {
                        <span class="puertos">@for (p of e.puertos; track p) { <b>{{ p }}</b> }</span>
                      } @else { Ninguno visible }
                    </dd>
                    <dt>CVE</dt><dd>{{ e.vulnerabilidades.length }}</dd>
                  }
                </dl>
              </section>
            }
            <section class="panel">
              <h3 class="lat-titulo">Subdominios ({{ det.subdominios.length }})</h3>
              @if (det.subdominios.length === 0) {
                <p class="sub">No se encontraron subdominios.</p>
              } @else {
                <ul class="lista-sub">
                  @for (s of det.subdominios; track s) { <li>{{ s }}</li> }
                </ul>
              }
            </section>
          } @else {
            <section class="panel">
              <p class="sub" style="margin:0">Pulsa <strong>Analizar de nuevo</strong> para ver el certificado, la red y los subdominios de este análisis.</p>
            </section>
          }

          <section class="panel">
            <h3 class="lat-titulo">Historial</h3>
            @if (tendencia().length > 1) {
              <div class="barras" aria-hidden="true">
                @for (a of tendencia(); track a.id) {
                  <span class="barra-h" [attr.data-nivel]="a.nivel" [style.height.%]="a.puntaje"></span>
                }
              </div>
            }
            <ul class="historial">
              @for (a of historial(); track a.id) {
                <li>
                  <span>{{ a.fecha | date: 'dd/MM/yyyy HH:mm' }}</span>
                  <strong>{{ a.puntaje }}</strong>
                  <span class="chip-nivel peq" [attr.data-nivel]="a.nivel">{{ etiqueta[a.nivel] }}</span>
                </li>
              }
            </ul>
          </section>
        </aside>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .volver-link { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 18px; color: var(--suave); text-decoration: none; font-size: 14px; }
    .volver-link:hover { color: var(--acento-claro); }

    .cab { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
    .etiqueta { margin: 0 0 6px; color: var(--acento-claro); font-size: 12px; font-weight: 600; letter-spacing: 0.08em; }
    .cab h1 { margin: 0; font-size: 2.2rem; word-break: break-all; }
    .meta { display: flex; align-items: center; gap: 10px; margin: 6px 0 0; font-size: 14px; }
    .punto { width: 4px; height: 4px; border-radius: 50%; background: var(--suave); }

    .btn-prim {
      height: 42px; padding: 0 22px; border-radius: 999px; cursor: pointer; font: inherit; font-weight: 600; font-size: 14px;
      display: inline-flex; align-items: center; gap: 8px; background: var(--acento); color: #fff; border: 0;
      box-shadow: 0 6px 18px rgba(91, 108, 248, 0.35);
    }
    .btn-prim:hover:not(:disabled) { filter: brightness(1.1); }
    .btn-prim:disabled { opacity: 0.55; cursor: not-allowed; }

    .panel { background: var(--tarjeta); border: 1px solid var(--borde); border-radius: 24px; padding: 22px 24px; }

    /* Resumen */
    .resumen { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 32px; margin-bottom: 28px; }
    .aro {
      --c: var(--borde);
      position: relative; width: 132px; height: 132px; border-radius: 50%;
      display: grid; place-content: center; text-align: center;
      background: conic-gradient(var(--c) calc(var(--p) * 1%), #2a3042 0);
    }
    .aro::before { content: ''; position: absolute; inset: 10px; border-radius: 50%; background: var(--tarjeta); }
    .aro[data-nivel='bueno'] { --c: var(--verde); }
    .aro[data-nivel='mejoras'] { --c: var(--ambar); }
    .aro[data-nivel='critico'] { --c: var(--rojo); }
    .aro-num, .aro-txt { position: relative; }
    .aro-num { font-family: var(--fuente-titulo); font-size: 2.6rem; font-weight: 600; line-height: 1; color: var(--titulo); }
    .aro[data-nivel='bueno'] .aro-num { color: var(--verde); }
    .aro[data-nivel='mejoras'] .aro-num { color: var(--ambar); }
    .aro[data-nivel='critico'] .aro-num { color: var(--rojo); }
    .aro-txt { font-size: 10px; letter-spacing: 0.1em; color: var(--suave); margin-top: 4px; }

    .chip-nivel { display: inline-block; padding: 4px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; }
    .chip-nivel.peq { padding: 2px 10px; font-size: 12px; }
    .chip-nivel[data-nivel='bueno'] { background: rgba(34,197,94,.16); color: var(--verde); }
    .chip-nivel[data-nivel='mejoras'] { background: rgba(245,158,11,.16); color: var(--ambar); }
    .chip-nivel[data-nivel='critico'] { background: rgba(239,68,68,.16); color: var(--rojo); }
    .res-texto { margin: 10px 0 14px; color: var(--texto); max-width: 60ch; }
    .escala { position: relative; width: 100%; max-width: 520px; height: 8px; border-radius: 999px;
      background: linear-gradient(90deg, var(--rojo) 0 50%, var(--ambar) 50% 80%, var(--verde) 80% 100%); opacity: 0.85; }
    .marca { position: absolute; top: 50%; width: 16px; height: 16px; margin-left: -8px; transform: translateY(-50%);
      border-radius: 50%; background: #fff; border: 3px solid var(--tarjeta); box-shadow: 0 0 0 1px var(--borde); }
    .escala-leyenda { display: flex; width: 100%; max-width: 520px; margin-top: 6px; font-size: 11px; color: var(--suave); }
    .escala-leyenda span:nth-child(1) { width: 50%; }
    .escala-leyenda span:nth-child(2) { width: 30%; }

    .res-conteo { display: flex; gap: 28px; }
    .res-conteo div { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 76px; }
    .res-conteo strong { font-family: var(--fuente-titulo); font-size: 1.9rem; color: var(--titulo); line-height: 1.1; }
    .res-conteo span { font-size: 12px; color: var(--suave); }
    .n-prob { color: var(--naranja) !important; }
    .n-ok { color: var(--verde) !important; }

    /* Rejilla principal + lateral */
    .rejilla { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 24px; align-items: start; }
    .titulo-seccion { margin: 0 0 14px; }
    .principal { display: flex; flex-direction: column; gap: 16px; }
    .lateral { display: flex; flex-direction: column; gap: 16px; }

    .grupo { padding: 20px 22px; }
    .grupo-cab { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .grupo-cab h3 { margin: 0; font-size: 1.15rem; flex: 1; }
    .grupo-icono { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px; background: #1b2040; border: 1px solid var(--borde); color: var(--acento-claro); }
    .grupo-icono[data-sev='critica'] { color: var(--rojo); }
    .grupo-icono[data-sev='alta'] { color: var(--naranja); }
    .grupo-icono[data-sev='media'] { color: var(--ambar); }
    .grupo-icono[data-sev='info'] { color: var(--verde); }
    .grupo-estado { font-size: 12px; font-weight: 600; padding: 3px 12px; border-radius: 999px; background: rgba(34,197,94,.16); color: var(--verde); }
    .grupo-estado[data-sev='critica'] { background: rgba(239,68,68,.16); color: var(--rojo); }
    .grupo-estado[data-sev='alta'] { background: rgba(249,115,22,.16); color: var(--naranja); }
    .grupo-estado[data-sev='media'], .grupo-estado[data-sev='baja'] { background: rgba(245,158,11,.16); color: var(--ambar); }

    .hallazgo { padding: 14px 16px; margin-top: 10px; border-radius: 14px; background: var(--tarjeta-2); border-left: 3px solid var(--borde); }
    .hallazgo[data-sev='critica'] { border-left-color: var(--rojo); }
    .hallazgo[data-sev='alta'] { border-left-color: var(--naranja); }
    .hallazgo[data-sev='media'] { border-left-color: var(--ambar); }
    .hallazgo[data-sev='baja'] { border-left-color: var(--acento); }
    .hallazgo[data-sev='info'] { border-left-color: var(--verde); }
    .h-cab { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .h-cab strong { color: var(--titulo); }
    .h-desc { margin: 6px 0 0; color: var(--suave); font-size: 14px; }
    .h-reco { margin: 10px 0 0; padding: 10px 12px; border-radius: 10px; background: rgba(91,108,248,.10); color: var(--texto); font-size: 14px; }
    .h-reco span { display: block; margin-bottom: 2px; color: var(--acento-claro); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }

    .sev { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 6px; background: var(--borde); }
    .sev[data-sev='critica'] { background: var(--rojo); color: #fff; }
    .sev[data-sev='alta'] { background: var(--naranja); color: #fff; }
    .sev[data-sev='media'] { background: var(--ambar); color: #111; }
    .sev[data-sev='baja'] { background: var(--acento); color: #fff; }
    .sev[data-sev='info'] { background: rgba(34,197,94,.16); color: var(--verde); }

    /* Lateral */
    .lat-titulo { margin: 0 0 12px; font-size: 1.05rem; }
    .datos { display: grid; grid-template-columns: max-content 1fr; gap: 8px 18px; margin: 0; font-size: 14px; }
    .datos dt { color: var(--suave); }
    .datos dd { margin: 0; color: var(--texto); word-break: break-word; }
    .datos small { color: var(--suave); }
    .si-no { padding: 1px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: rgba(239,68,68,.16); color: var(--rojo); }
    .si-no[data-ok='true'] { background: rgba(34,197,94,.16); color: var(--verde); }
    .puertos { display: flex; flex-wrap: wrap; gap: 6px; }
    .puertos b { padding: 1px 9px; border-radius: 8px; background: #1b2040; border: 1px solid var(--borde); font-weight: 600; font-size: 12px; }

    .lista-sub { max-height: 200px; overflow-y: auto; margin: 0; padding-left: 1.1rem; color: var(--suave); font-size: 14px; }

    .barras { display: flex; align-items: flex-end; gap: 6px; height: 64px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--borde); }
    .barra-h { flex: 1; min-height: 4px; border-radius: 4px 4px 0 0; background: var(--borde); }
    .barra-h[data-nivel='bueno'] { background: var(--verde); }
    .barra-h[data-nivel='mejoras'] { background: var(--ambar); }
    .barra-h[data-nivel='critico'] { background: var(--rojo); }
    .historial { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; max-height: 260px; overflow-y: auto; }
    .historial li { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--borde); font-size: 13px; color: var(--suave); }
    .historial li:last-child { border-bottom: 0; }
    .historial strong { color: var(--titulo); font-size: 14px; }

    @media (max-width: 1100px) {
      .rejilla { grid-template-columns: 1fr; }
      .resumen { grid-template-columns: auto 1fr; }
      .res-conteo { grid-column: 1 / -1; justify-content: space-around; }
    }
    @media (max-width: 640px) {
      .resumen { grid-template-columns: 1fr; justify-items: center; text-align: center; }
      .escala, .escala-leyenda { margin-inline: auto; }
      .cab h1 { font-size: 1.7rem; }
    }
  `,
})
export class Resultado {
  private ruta = inject(ActivatedRoute);
  private servicio = inject(DominiosService);

  etiqueta = ETIQUETA_NIVEL;
  sev = ETIQUETA_SEVERIDAD;
  mensaje = MENSAJE_NIVEL;
  id = this.ruta.snapshot.paramMap.get('id') ?? '';

  dominio = signal<Dominio | null>(null);
  historial = signal<Analisis[]>([]);
  cargando = signal(true);
  analizando = signal(false);
  error = signal('');

  ultimo = computed(() => this.historial()[0] ?? null);

  // Hallazgos agrupados por categoría; dentro de cada una, de más a menos grave
  grupos = computed<Grupo[]>(() => {
    const mapa = new Map<string, Hallazgo[]>();
    for (const h of this.ultimo()?.hallazgos ?? []) {
      mapa.set(h.categoria, [...(mapa.get(h.categoria) ?? []), h]);
    }
    const rango = (c: string) => {
      const i = ORDEN_CATEGORIAS.indexOf(c);
      return i === -1 ? ORDEN_CATEGORIAS.length : i;
    };
    return [...mapa.entries()]
      .sort((a, b) => rango(a[0]) - rango(b[0]))
      .map(([categoria, lista]) => {
        const items = [...lista].sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad]);
        return {
          categoria,
          items,
          peor: items[0].severidad,
          problemas: items.filter((h) => h.severidad !== 'info').length,
        };
      });
  });

  conteo = computed(() => {
    const todos = this.ultimo()?.hallazgos ?? [];
    const info = todos.filter((h) => h.severidad === 'info').length;
    return { problemas: todos.length - info, info };
  });

  // Últimos 8 análisis, del más antiguo al más reciente, para las barras de tendencia
  tendencia = computed(() => this.historial().slice(0, 8).reverse());

  // Certificado, red y subdominios solo existen si el análisis se acaba de ejecutar
  detalle = computed(() => {
    const r = this.servicio.ultimoResultado();
    return r && r.dominioId === this.id ? r : null;
  });

  constructor() {
    this.cargar();
  }

  cargar() {
    forkJoin({ lista: this.servicio.listar(), hist: this.servicio.historial(this.id) }).subscribe({
      next: ({ lista, hist }) => {
        this.dominio.set(lista.find((d) => d.id === this.id) ?? null);
        this.historial.set(hist);
        this.cargando.set(false);
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
    this.servicio.analizar(this.id).subscribe({
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
