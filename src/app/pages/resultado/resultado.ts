import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DominiosService } from '../../core/dominios.service';
import { Analisis, Dominio, ETIQUETA_NIVEL, Hallazgo, Severidad, mensajeError } from '../../core/modelos';
import { ETIQUETA_SEVERIDAD, ORDEN_SEVERIDAD } from '../../domain/severidad';
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
            <span class="punto"></span>
            <span>{{ historial().length }} {{ historial().length === 1 ? 'análisis' : 'análisis en total' }}</span>
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

      <!-- RESUMEN -->
      <section class="panel resumen ent" style="--i: 0" [attr.data-nivel]="ultimo()!.nivel">
        <div class="aro" [attr.data-nivel]="ultimo()!.nivel" [style.--p]="ultimo()!.puntaje * k()">
          <span class="aro-num">{{ puntajeAnimado() }}</span>
          <span class="aro-txt">DE 100</span>
        </div>

        <div class="res-centro">
          <div class="fila-chip">
            <span class="chip-nivel" [attr.data-nivel]="ultimo()!.nivel">{{ etiqueta[ultimo()!.nivel] }}</span>
            @if (delta() !== null) {
              <span class="delta" [attr.data-dir]="delta()! > 0 ? 'sube' : delta()! < 0 ? 'baja' : 'igual'">
                {{ delta()! > 0 ? '▲ +' + delta() : delta()! < 0 ? '▼ −' + -delta()! : '＝ Sin cambios' }}
              </span>
              <span class="vs">vs. el análisis anterior</span>
            }
          </div>
          <p class="res-texto">{{ mensaje[ultimo()!.nivel] }}</p>
          <div class="escala" aria-hidden="true"><span class="marca" [style.left.%]="ultimo()!.puntaje * k()"></span></div>
          <div class="escala-leyenda" aria-hidden="true"><span>Crítico</span><span>Mejoras</span><span>Bueno</span></div>
        </div>

        <div class="res-conteo">
          <div class="tile"><strong class="n-grave">{{ graves() }}</strong><span>Graves</span></div>
          <div class="tile"><strong class="n-prob">{{ conteo().problemas }}</strong><span>Por corregir</span></div>
          <div class="tile"><strong class="n-ok">{{ conteo().info }}</strong><span>Informativos</span></div>
        </div>

        <div class="paso" [attr.data-ok]="!primerPaso()">
          <span class="paso-etq">{{ primerPaso() ? 'Primer paso recomendado' : 'Todo en orden' }}</span>
          <p>
            @if (primerPaso(); as p) {
              <strong>{{ p.titulo }}.</strong> {{ p.recomendacion }}
            } @else {
              No hay nada urgente. Vuelve a analizar el dominio en unos días para mantener el puntaje.
            }
          </p>
        </div>
      </section>

      <div class="rejilla">
        <!-- HALLAZGOS -->
        <div class="principal">
          <div class="barra-sec ent" style="--i: 1">
            <h2 class="titulo-seccion">Hallazgos por categoría</h2>
            <div class="chips" role="group" aria-label="Filtrar hallazgos">
              @for (f of filtros; track f.valor) {
                <button type="button" class="chip" [class.activo]="filtro() === f.valor" (click)="filtro.set(f.valor)">
                  {{ f.texto }} ({{ cuentaFiltro(f.valor) }})
                </button>
              }
            </div>
          </div>

          @for (g of grupos(); track g.categoria; let i = $index) {
            <section class="panel grupo ent" [style.--i]="i + 2">
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
                @if (h.severidad === 'info') {
                  <details class="info-fila">
                    <summary><span class="ok-marca">✓</span>{{ h.titulo }}</summary>
                    <p>{{ h.descripcion }}</p>
                  </details>
                } @else {
                  <article class="hallazgo" [attr.data-sev]="h.severidad">
                    <div class="h-cab">
                      <span class="sev" [attr.data-sev]="h.severidad">{{ sev[h.severidad] }}</span>
                      <strong>{{ h.titulo }}</strong>
                    </div>
                    <p class="h-desc">{{ h.descripcion }}</p>
                    <p class="h-reco"><span>Qué hacer</span>{{ h.recomendacion }}</p>
                  </article>
                }
              }
            </section>
          } @empty {
            <section class="panel vacio">
              <p class="sub" style="margin:0">No hay hallazgos en esta categoría de filtro.</p>
            </section>
          }
        </div>

        <!-- LATERAL -->
        <aside class="lateral">
          @if (detalle(); as det) {
            @if (det.certificado; as c) {
              <section class="panel ent" style="--i: 2">
                <h3 class="lat-titulo">Certificado TLS</h3>
                <div class="cert-estado" [attr.data-tono]="tonoDias(c.diasRestantes, c.autorizado)">
                  <strong>{{ textoDias(c.diasRestantes) }}</strong>
                  <span>{{ c.autorizado ? 'Certificado confiable' : 'El navegador no lo considera confiable' }}</span>
                </div>
                <dl class="datos">
                  <dt>Emisor</dt><dd>{{ c.emisor }}</dd>
                  <dt>Protocolo</dt><dd>{{ c.protocolo }}</dd>
                  <dt>Vence</dt><dd>{{ c.venceEn | date: 'dd/MM/yyyy' }}</dd>
                </dl>
              </section>
            }
            @if (det.reputacion || det.exposicion) {
              <section class="panel ent" style="--i: 3">
                <h3 class="lat-titulo">Red e infraestructura</h3>
                <dl class="datos">
                  @if (det.reputacion; as r) {
                    <dt>Proveedor</dt><dd>{{ r.asn || 'Desconocido' }}</dd>
                    <dt>Riesgo de IP</dt>
                    <dd>
                      <span class="riesgo">
                        <span class="riesgo-barra"><i [style.width.%]="r.riesgo * k()" [attr.data-tono]="tonoRiesgo(r.riesgo)"></i></span>
                        <b>{{ r.riesgo }}</b><small>/ 100</small>
                      </span>
                    </dd>
                  }
                </dl>
                @if (det.exposicion; as e) {
                  <h4 class="sub-titulo">Puertos abiertos</h4>
                  @if (e.puertos.length) {
                    <div class="puertos">
                      @for (p of e.puertos; track p) {
                        <span class="puerto" [class.riesgo-p]="esSensible(p)" [title]="esSensible(p) ? 'Normalmente no debería estar abierto a Internet' : ''">
                          {{ p }}@if (nombrePuerto(p); as np) { <small>{{ np }}</small> }
                        </span>
                      }
                    </div>
                  } @else {
                    <p class="sub nada">Ninguno visible desde Internet.</p>
                  }
                  <h4 class="sub-titulo">Vulnerabilidades conocidas <span class="cuenta" [attr.data-cero]="e.vulnerabilidades.length === 0">{{ e.vulnerabilidades.length }}</span></h4>
                  @if (e.vulnerabilidades.length) {
                    <div class="cves">
                      @for (v of e.vulnerabilidades.slice(0, 4); track v) {
                        <a class="cve" [href]="'https://nvd.nist.gov/vuln/detail/' + v" target="_blank" rel="noopener noreferrer">{{ v }}</a>
                      }
                      @if (e.vulnerabilidades.length > 4) {
                        <span class="mas">+{{ e.vulnerabilidades.length - 4 }} más</span>
                      }
                    </div>
                  } @else {
                    <p class="sub nada">Ninguna asociada a la IP.</p>
                  }
                }
              </section>
            }
            <section class="panel ent" style="--i: 4">
              <div class="lat-cab">
                <h3 class="lat-titulo">Subdominios</h3>
                <span class="cuenta" [attr.data-cero]="det.subdominios.length === 0">{{ det.subdominios.length }}</span>
              </div>
              @if (det.subdominios.length === 0) {
                <p class="sub nada">No se encontraron subdominios públicos.</p>
              } @else {
                <ul class="lista-sub">
                  @for (s of det.subdominios; track s) { <li>{{ s }}</li> }
                </ul>
              }
            </section>
          } @else {
            <section class="panel ent aviso-det" style="--i: 2">
              <p class="sub" style="margin:0">Pulsa <strong>Analizar de nuevo</strong> para ver el certificado, los puertos y los subdominios de este análisis.</p>
            </section>
          }

          <section class="panel ent" style="--i: 5">
            <h3 class="lat-titulo">Historial</h3>
            @if (tendencia().length > 1) {
              <div class="barras" aria-hidden="true">
                @for (a of tendencia(); track a.id; let j = $index; let ult = $last) {
                  <div class="col" [class.actual]="ult" [style.--j]="j" [title]="(a.fecha | date: 'dd/MM/yyyy HH:mm') + ' · ' + a.puntaje + ' puntos'">
                    <span class="val">{{ a.puntaje }}</span>
                    <div class="pilar"><i [attr.data-nivel]="a.nivel" [style.height.%]="a.puntaje"></i></div>
                    <span class="fch">{{ a.fecha | date: 'dd/MM' }}</span>
                  </div>
                }
              </div>
            } @else {
              <p class="sub nada">La tendencia aparece desde el segundo análisis.</p>
            }
            <ul class="historial">
              @for (f of filasHistorial(); track f.a.id) {
                <li>
                  <span class="h-fecha">{{ f.a.fecha | date: 'dd/MM/yy HH:mm' }}</span>
                  <strong>{{ f.a.puntaje }}</strong>
                  @if (f.d !== null && f.d !== 0) {
                    <span class="mini-delta" [attr.data-dir]="f.d > 0 ? 'sube' : 'baja'">{{ f.d > 0 ? '▲' + f.d : '▼' + -f.d }}</span>
                  } @else {
                    <span class="mini-delta"></span>
                  }
                  <span class="chip-nivel peq" [attr.data-nivel]="f.a.nivel">{{ etiqueta[f.a.nivel] }}</span>
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

    /* Entrada escalonada (backwards: al terminar no pisa otros estados) */
    .ent { animation: entra 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) backwards; animation-delay: calc(var(--i, 0) * 80ms); }
    @keyframes entra { from { opacity: 0; transform: translateY(14px); } }
    @keyframes crece { from { transform: scaleY(0); } }

    .volver-link { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 18px; color: var(--suave); text-decoration: none; font-size: 14px; }
    .volver-link:hover { color: var(--acento-claro); }

    .cab { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
    .etiqueta { margin: 0 0 6px; color: var(--acento-claro); font-size: 12px; font-weight: 600; letter-spacing: 0.08em; }
    .cab h1 { margin: 0; font-size: 2.2rem; word-break: break-all; }
    .meta { display: flex; align-items: center; gap: 10px; margin: 6px 0 0; font-size: 14px; flex-wrap: wrap; }
    .punto { width: 4px; height: 4px; border-radius: 50%; background: var(--suave); }

    .btn-prim {
      height: 42px; padding: 0 22px; border-radius: 999px; cursor: pointer; font: inherit; font-weight: 600; font-size: 14px;
      display: inline-flex; align-items: center; gap: 8px; background: var(--acento); color: #fff; border: 0;
      box-shadow: 0 6px 18px rgba(91, 108, 248, 0.35);
    }
    .btn-prim:hover:not(:disabled) { filter: brightness(1.1); }
    .btn-prim:disabled { opacity: 0.55; cursor: not-allowed; }

    .panel { background: var(--tarjeta); border: 1px solid var(--borde); border-radius: 24px; padding: 22px 24px; }

    /* ---------- Resumen ---------- */
    .resumen {
      --c: var(--acento);
      position: relative; overflow: hidden; margin-bottom: 28px;
      display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 20px 36px;
      padding: 28px 32px;
      background: radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--c) 14%, var(--tarjeta)) 0%, var(--tarjeta) 55%);
    }
    .resumen[data-nivel='bueno'] { --c: var(--verde); }
    .resumen[data-nivel='mejoras'] { --c: var(--ambar); }
    .resumen[data-nivel='critico'] { --c: var(--rojo); border-color: rgba(239, 68, 68, 0.35); }

    .aro {
      --c: var(--borde);
      position: relative; width: 148px; height: 148px; border-radius: 50%;
      display: grid; place-content: center; text-align: center;
      background: conic-gradient(var(--c) calc(var(--p) * 1%), #2a3042 0);
    }
    .aro::before { content: ''; position: absolute; inset: 11px; border-radius: 50%; background: var(--tarjeta-2); }
    .aro[data-nivel='bueno'] { --c: var(--verde); }
    .aro[data-nivel='mejoras'] { --c: var(--ambar); }
    .aro[data-nivel='critico'] { --c: var(--rojo); }
    .aro-num, .aro-txt { position: relative; }
    .aro-num { font-family: var(--fuente-titulo); font-size: 3rem; font-weight: 600; line-height: 1; color: var(--titulo); font-variant-numeric: tabular-nums; }
    .aro[data-nivel='bueno'] .aro-num { color: var(--verde); }
    .aro[data-nivel='mejoras'] .aro-num { color: var(--ambar); }
    .aro[data-nivel='critico'] .aro-num { color: var(--rojo); }
    .aro-txt { font-size: 10px; letter-spacing: 0.1em; color: var(--suave); margin-top: 4px; }

    .fila-chip { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .chip-nivel { display: inline-block; padding: 4px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; }
    .chip-nivel.peq { padding: 2px 10px; font-size: 12px; white-space: nowrap; justify-self: end; }
    .chip-nivel[data-nivel='bueno'] { background: rgba(34,197,94,.16); color: var(--verde); }
    .chip-nivel[data-nivel='mejoras'] { background: rgba(245,158,11,.16); color: var(--ambar); }
    .chip-nivel[data-nivel='critico'] { background: rgba(239,68,68,.16); color: var(--rojo); }
    .delta { padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: var(--borde); color: var(--texto); font-variant-numeric: tabular-nums; }
    .delta[data-dir='sube'] { background: rgba(34,197,94,.15); color: var(--verde); }
    .delta[data-dir='baja'] { background: rgba(239,68,68,.15); color: var(--rojo); }
    .vs { font-size: 12px; color: var(--suave); }
    .res-texto { margin: 12px 0 16px; color: var(--texto); font-size: 1.05rem; max-width: 60ch; }
    .escala { position: relative; width: 100%; max-width: 560px; height: 8px; border-radius: 999px;
      background: linear-gradient(90deg, var(--rojo) 0 50%, var(--ambar) 50% 80%, var(--verde) 80% 100%); opacity: 0.9; }
    .marca { position: absolute; top: 50%; width: 16px; height: 16px; margin-left: -8px; transform: translateY(-50%);
      border-radius: 50%; background: #fff; border: 3px solid var(--tarjeta-2); box-shadow: 0 0 0 1px var(--borde); }
    .escala-leyenda { display: flex; width: 100%; max-width: 560px; margin-top: 6px; font-size: 11px; color: var(--suave); }
    .escala-leyenda span:nth-child(1) { width: 50%; }
    .escala-leyenda span:nth-child(2) { width: 30%; }

    .res-conteo { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .tile { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 92px; padding: 14px 10px; border-radius: 16px; background: var(--tarjeta-2); border: 1px solid var(--borde); }
    .tile strong { font-family: var(--fuente-titulo); font-size: 2rem; color: var(--titulo); line-height: 1.1; font-variant-numeric: tabular-nums; }
    .tile span { font-size: 12px; color: var(--suave); }
    .n-grave { color: var(--rojo) !important; }
    .n-prob { color: var(--naranja) !important; }
    .n-ok { color: var(--verde) !important; }

    .paso { grid-column: 1 / -1; padding: 14px 18px; border-radius: 16px; background: color-mix(in srgb, var(--acento) 12%, var(--tarjeta-2)); border: 1px solid color-mix(in srgb, var(--acento) 35%, var(--borde)); }
    .paso[data-ok='true'] { background: color-mix(in srgb, var(--verde) 10%, var(--tarjeta-2)); border-color: color-mix(in srgb, var(--verde) 35%, var(--borde)); }
    .paso-etq { display: block; margin-bottom: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--acento-claro); }
    .paso[data-ok='true'] .paso-etq { color: var(--verde); }
    .paso p { margin: 0; font-size: 14.5px; color: var(--texto); }
    .paso strong { color: var(--titulo); }

    /* ---------- Rejilla principal + lateral ---------- */
    .rejilla { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 24px; align-items: start; }
    .principal { display: flex; flex-direction: column; gap: 16px; }
    .lateral { display: flex; flex-direction: column; gap: 16px; }

    .barra-sec { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; min-height: 40px; }
    .titulo-seccion { margin: 0; font-size: 1.35rem; }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .chip { padding: 7px 14px; border-radius: 999px; cursor: pointer; font: inherit; font-size: 13px; background: transparent; color: var(--suave); border: 1px solid var(--borde); }
    .chip:hover { color: var(--texto); }
    .chip.activo { background: var(--acento); border-color: var(--acento); color: #fff; }

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
    .h-cab { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .h-cab strong { color: var(--titulo); }
    .h-desc { margin: 6px 0 0; color: var(--suave); font-size: 14px; }
    .h-reco { margin: 10px 0 0; padding: 10px 12px; border-radius: 10px; background: rgba(91,108,248,.10); color: var(--texto); font-size: 14px; }
    .h-reco span { display: block; margin-bottom: 2px; color: var(--acento-claro); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }

    /* Los informativos ocupan una sola línea; se abren si se quiere leer el detalle */
    .info-fila { margin-top: 8px; padding: 10px 14px; border-radius: 12px; background: color-mix(in srgb, var(--verde) 6%, var(--tarjeta-2)); border: 1px solid color-mix(in srgb, var(--verde) 18%, var(--borde)); }
    .info-fila summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--texto); }
    .info-fila summary::-webkit-details-marker { display: none; }
    .info-fila summary::after { content: '＋'; margin-left: auto; color: var(--suave); font-size: 12px; }
    .info-fila[open] summary::after { content: '－'; }
    .ok-marca { flex: none; width: 20px; height: 20px; display: grid; place-items: center; border-radius: 50%; background: rgba(34,197,94,.18); color: var(--verde); font-size: 12px; font-weight: 700; }
    .info-fila p { margin: 8px 0 0 30px; color: var(--suave); font-size: 13.5px; }

    .sev { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 6px; background: var(--borde); }
    .sev[data-sev='critica'] { background: var(--rojo); color: #fff; }
    .sev[data-sev='alta'] { background: var(--naranja); color: #fff; }
    .sev[data-sev='media'] { background: var(--ambar); color: #111; }
    .sev[data-sev='baja'] { background: var(--acento); color: #fff; }

    .vacio { text-align: center; border-style: dashed; }

    /* ---------- Lateral ---------- */
    .lat-titulo { margin: 0 0 14px; font-size: 1.05rem; }
    .lat-cab { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .lat-cab .lat-titulo { margin: 0; }
    .sub-titulo { display: flex; align-items: center; gap: 8px; margin: 18px 0 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--suave); }
    .nada { margin: 0; font-size: 13.5px; }
    .aviso-det { border-style: dashed; }

    .cuenta { min-width: 24px; padding: 1px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; text-align: center; background: rgba(239,68,68,.16); color: var(--rojo); }
    .cuenta[data-cero='true'] { background: rgba(34,197,94,.16); color: var(--verde); }

    .cert-estado { --t: var(--verde); display: flex; flex-direction: column; gap: 2px; margin-bottom: 14px; padding: 12px 14px; border-radius: 14px; background: color-mix(in srgb, var(--t) 10%, var(--tarjeta-2)); border: 1px solid color-mix(in srgb, var(--t) 30%, var(--borde)); }
    .cert-estado[data-tono='rojo'] { --t: var(--rojo); }
    .cert-estado[data-tono='ambar'] { --t: var(--ambar); }
    .cert-estado strong { font-family: var(--fuente-titulo); font-size: 1.1rem; color: var(--t); }
    .cert-estado span { font-size: 12.5px; color: var(--suave); }

    .datos { display: grid; grid-template-columns: max-content 1fr; gap: 10px 18px; margin: 0; font-size: 14px; align-items: center; }
    .datos dt { color: var(--suave); }
    .datos dd { margin: 0; color: var(--texto); word-break: break-word; }

    .riesgo { display: flex; align-items: center; gap: 8px; }
    .riesgo-barra { flex: 1; height: 6px; border-radius: 999px; background: var(--borde); overflow: hidden; min-width: 50px; }
    .riesgo-barra i { display: block; height: 100%; border-radius: 999px; background: var(--verde); }
    .riesgo-barra i[data-tono='ambar'] { background: var(--ambar); }
    .riesgo-barra i[data-tono='rojo'] { background: var(--rojo); }
    .riesgo b { font-weight: 700; color: var(--titulo); }
    .riesgo small { color: var(--suave); }

    .puertos { display: flex; flex-wrap: wrap; gap: 6px; }
    .puerto { display: inline-flex; align-items: baseline; gap: 6px; padding: 3px 10px; border-radius: 10px; background: #1b2040; border: 1px solid var(--borde); font-weight: 700; font-size: 12.5px; color: var(--texto); font-variant-numeric: tabular-nums; }
    .puerto small { font-weight: 500; font-size: 11px; color: var(--suave); }
    .puerto.riesgo-p { background: rgba(239,68,68,.12); border-color: rgba(239,68,68,.45); color: var(--rojo); }
    .puerto.riesgo-p small { color: color-mix(in srgb, var(--rojo) 70%, var(--suave)); }

    .cves { display: flex; flex-wrap: wrap; gap: 6px; }
    .cve { padding: 3px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; text-decoration: none; color: var(--naranja); background: rgba(249,115,22,.12); border: 1px solid rgba(249,115,22,.35); }
    .cve:hover { background: rgba(249,115,22,.22); }
    .mas { padding: 3px 6px; font-size: 12px; color: var(--suave); }

    .lista-sub { max-height: 200px; overflow-y: auto; margin: 0; padding-left: 1.1rem; color: var(--suave); font-size: 14px; }

    .barras { display: flex; align-items: stretch; gap: 8px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid var(--borde); }
    .col { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .val { font-size: 11px; color: var(--suave); font-variant-numeric: tabular-nums; }
    .pilar { width: 100%; height: 84px; display: flex; align-items: flex-end; }
    .pilar i { display: block; width: 100%; min-height: 4px; border-radius: 6px 6px 3px 3px; background: var(--borde); opacity: 0.55; transform-origin: bottom; animation: crece 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) backwards; animation-delay: calc(0.3s + var(--j, 0) * 60ms); }
    .pilar i[data-nivel='bueno'] { background: var(--verde); }
    .pilar i[data-nivel='mejoras'] { background: var(--ambar); }
    .pilar i[data-nivel='critico'] { background: var(--rojo); }
    .col.actual .pilar i { opacity: 1; box-shadow: 0 0 18px -4px currentColor; }
    .col.actual .val { color: var(--titulo); font-weight: 700; }
    .fch { font-size: 10.5px; color: var(--suave); }

    .historial { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; max-height: 280px; overflow-y: auto; }
    .historial li { display: grid; grid-template-columns: 1fr 28px 38px 112px; gap: 8px; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--borde); font-size: 13px; color: var(--suave); }
    .historial li:last-child { border-bottom: 0; }
    .historial strong { color: var(--titulo); font-size: 14px; font-variant-numeric: tabular-nums; text-align: right; }
    .mini-delta { font-size: 11px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
    .mini-delta[data-dir='sube'] { color: var(--verde); }
    .mini-delta[data-dir='baja'] { color: var(--rojo); }

    @media (max-width: 1100px) {
      .rejilla { grid-template-columns: 1fr; }
      .resumen { grid-template-columns: auto minmax(0, 1fr); }
      .res-conteo { grid-column: 1 / -1; }
      .tile { min-width: 0; }
    }
    @media (max-width: 640px) {
      .resumen { grid-template-columns: 1fr; justify-items: center; text-align: center; padding: 22px 18px; }
      .fila-chip { justify-content: center; }
      .escala, .escala-leyenda { margin-inline: auto; }
      .res-conteo { width: 100%; }
      .paso { text-align: left; width: 100%; }
      .cab h1 { font-size: 1.7rem; }
      .barra-sec { flex-direction: column; align-items: flex-start; }
    }
    @media (prefers-reduced-motion: reduce) {
      .ent, .pilar i { animation: none; }
    }
  `,
})
export class Resultado {
  private ruta = inject(ActivatedRoute);
  private servicio = inject(DominiosService);
  private destruir = inject(DestroyRef);

  etiqueta = ETIQUETA_NIVEL;
  sev = ETIQUETA_SEVERIDAD;
  mensaje = MENSAJE_NIVEL;
  id = this.ruta.snapshot.paramMap.get('id') ?? '';

  filtros: { valor: FiltroHallazgos; texto: string }[] = [
    { valor: 'todos', texto: 'Todos' },
    { valor: 'corregir', texto: 'Por corregir' },
    { valor: 'info', texto: 'Informativos' },
  ];

  dominio = signal<Dominio | null>(null);
  historial = signal<Analisis[]>([]);
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
    const r = this.servicio.ultimoResultado();
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
    forkJoin({ lista: this.servicio.listar(), hist: this.servicio.historial(this.id) }).subscribe({
      next: ({ lista, hist }) => {
        this.dominio.set(lista.find((d) => d.id === this.id) ?? null);
        this.historial.set(hist);
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
