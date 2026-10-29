import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DominiosService } from '../../core/dominios.service';
import { Analisis, Dominio, ETIQUETA_NIVEL, Severidad, mensajeError } from '../../core/modelos';

const ORDEN: Record<Severidad, number> = { critica: 0, alta: 1, media: 2, baja: 3, info: 4 };
const ETIQUETA_SEVERIDAD: Record<Severidad, string> = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
  info: 'Info',
};

@Component({
  selector: 'app-resultado',
  imports: [RouterLink, DatePipe],
  template: `
    <a class="volver" routerLink="/dominios">← Volver a mis dominios</a>

    @if (cargando()) {
      <p class="sub">Cargando…</p>
    } @else if (!ultimo()) {
      <h1>{{ dominio()?.nombreDominio }}</h1>
      <p class="sub">Este dominio todavía no tiene análisis.</p>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
    } @else {
      <h1>{{ dominio()?.nombreDominio }}</h1>
      <p class="sub">
        Último análisis: {{ ultimo()!.fecha | date: 'dd/MM/yyyy HH:mm' }} ·
        {{ (ultimo()!.duracionMs / 1000).toFixed(1) }} s
      </p>

      <section class="tarjeta resumen">
        <div class="gauge" [attr.data-nivel]="ultimo()!.nivel" [style.--p]="ultimo()!.puntaje">
          <span>{{ ultimo()!.puntaje }}</span>
        </div>
        <div>
          <span class="badge grande" [attr.data-nivel]="ultimo()!.nivel">
            {{ etiqueta[ultimo()!.nivel] }}
          </span>
          <p class="sub">Puntaje de seguridad de 0 a 100.</p>
          <button class="btn" type="button" [disabled]="analizando()" (click)="reanalizar()">
            {{ analizando() ? 'Analizando… (hasta 30 s)' : 'Analizar de nuevo' }}
          </button>
          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
        </div>
      </section>

      <section class="tarjeta">
        <h2>Hallazgos</h2>
        @for (h of hallazgos(); track h.id) {
          <article class="hallazgo" [attr.data-sev]="h.severidad">
            <div class="cabecera">
              <span class="sev" [attr.data-sev]="h.severidad">{{ sev[h.severidad] }}</span>
              <strong>{{ h.titulo }}</strong>
              <span class="cat">{{ h.categoria }}</span>
            </div>
            <p>{{ h.descripcion }}</p>
            <p class="reco"><strong>Qué hacer:</strong> {{ h.recomendacion }}</p>
          </article>
        }
      </section>

      @if (detalle(); as det) {
        @if (det.certificado; as c) {
          <section class="tarjeta">
            <h2>Certificado TLS</h2>
            <dl class="datos">
              <dt>Emisor</dt>
              <dd>{{ c.emisor }}</dd>
              <dt>Protocolo</dt>
              <dd>{{ c.protocolo }}</dd>
              <dt>Vence</dt>
              <dd>
                {{ c.venceEn | date: 'dd/MM/yyyy' }}
                @if (c.diasRestantes !== null) {
                  ({{ c.diasRestantes }} días)
                }
              </dd>
              <dt>Confiable</dt>
              <dd>{{ c.autorizado ? 'Sí' : 'No' }}</dd>
            </dl>
          </section>
        }
        <section class="tarjeta">
          <h2>Subdominios encontrados ({{ det.subdominios.length }})</h2>
          @if (det.subdominios.length === 0) {
            <p class="sub">No se encontraron subdominios.</p>
          } @else {
            <ul class="lista-sub">
              @for (s of det.subdominios; track s) {
                <li>{{ s }}</li>
              }
            </ul>
          }
        </section>
      }

      <section class="tarjeta">
        <h2>Historial</h2>
        <div class="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Puntaje</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              @for (a of historial(); track a.id) {
                <tr>
                  <td>{{ a.fecha | date: 'dd/MM/yyyy HH:mm' }}</td>
                  <td>{{ a.puntaje }}</td>
                  <td><span class="badge" [attr.data-nivel]="a.nivel">{{ etiqueta[a.nivel] }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }
  `,
})
export class Resultado {
  private ruta = inject(ActivatedRoute);
  private servicio = inject(DominiosService);

  etiqueta = ETIQUETA_NIVEL;
  sev = ETIQUETA_SEVERIDAD;
  id = this.ruta.snapshot.paramMap.get('id') ?? '';

  dominio = signal<Dominio | null>(null);
  historial = signal<Analisis[]>([]);
  cargando = signal(true);
  analizando = signal(false);
  error = signal('');

  ultimo = computed(() => this.historial()[0] ?? null);
  hallazgos = computed(() =>
    [...(this.ultimo()?.hallazgos ?? [])].sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad])
  );
  // Certificado y subdominios solo existen si el análisis se acaba de ejecutar
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
