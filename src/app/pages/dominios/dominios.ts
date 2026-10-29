import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DominiosService } from '../../core/dominios.service';
import { Dominio, ETIQUETA_NIVEL, mensajeError } from '../../core/modelos';

@Component({
  selector: 'app-dominios',
  imports: [FormsModule, RouterLink],
  template: `
    <h1>Mis dominios</h1>
    <p class="sub">Registra los dominios que quieres vigilar y analiza su seguridad.</p>

    <section class="tarjeta">
      <form class="fila" (ngSubmit)="agregar()">
        <input
          type="text"
          name="nombre"
          [(ngModel)]="nuevo"
          placeholder="ejemplo.com"
          aria-label="Nombre del dominio"
          required
        />
        <button class="btn" type="submit" [disabled]="agregando()">
          {{ agregando() ? 'Agregando…' : 'Agregar dominio' }}
        </button>
      </form>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
    </section>

    @if (analizando()) {
      <p class="aviso">Analizando el dominio… puede tardar hasta 30 segundos.</p>
    }

    <section class="tarjeta">
      @if (cargando()) {
        <p class="sub">Cargando…</p>
      } @else if (dominios().length === 0) {
        <p class="sub">Aún no tienes dominios. Agrega el primero arriba.</p>
      } @else {
        <div class="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Dominio</th>
                <th>Puntaje</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (d of dominios(); track d.id) {
                <tr>
                  <td>{{ d.nombreDominio }}</td>
                  <td>{{ d.ultimoPuntaje ?? '—' }}</td>
                  <td>
                    @if (d.nivel) {
                      <span class="badge" [attr.data-nivel]="d.nivel">{{ etiqueta[d.nivel] }}</span>
                    } @else {
                      <span class="badge" data-nivel="sin">Sin analizar</span>
                    }
                  </td>
                  <td class="acciones">
                    <button
                      class="btn"
                      type="button"
                      [disabled]="analizando() !== null"
                      (click)="analizar(d)"
                    >
                      {{ analizando() === d.id ? 'Analizando…' : 'Analizar' }}
                    </button>
                    @if (d.nivel) {
                      <a class="btn secundario" [routerLink]="['/dominios', d.id]">Ver detalle</a>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class Dominios {
  private servicio = inject(DominiosService);
  private router = inject(Router);

  etiqueta = ETIQUETA_NIVEL;
  dominios = signal<Dominio[]>([]);
  cargando = signal(true);
  agregando = signal(false);
  analizando = signal<string | null>(null);
  error = signal('');
  nuevo = '';

  constructor() {
    this.cargar();
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
