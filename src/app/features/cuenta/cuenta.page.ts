import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { mensajeError } from '../../core/modelos';
import { AlertasStore } from '../../data/alertas.store';
import { DominiosStore } from '../../data/dominios.store';
import { guardarLista, leerLista } from '../../shared/utils/almacen';

const CLAVE_SIMILARES = 'ds-similares-revisados';

@Component({
  selector: 'app-cuenta',
  imports: [RouterLink, FormsModule],
  templateUrl: './cuenta.page.html',
  styleUrl: './cuenta.page.css',
})
export class Cuenta {
  protected auth = inject(AuthService);
  private datos = inject(DominiosStore);
  protected alertas = inject(AlertasStore);

  protected similaresRevisados = signal(leerLista(CLAVE_SIMILARES).length);

  protected dominios = computed(() => this.datos.dominios().length);
  protected analisis = computed(() => Object.values(this.datos.historiales()).reduce((suma, h) => suma + h.length, 0));
  protected activas = computed(() => this.alertas.activas().filter((a) => a.sev !== 'ok').length);

  protected mfaPaso = signal<'inicio' | 'qr'>('inicio');
  protected mfaQr = signal('');
  protected mfaSecreto = signal('');
  protected mfaCargando = signal(false);
  protected mfaError = signal('');
  protected mfaCodigo = '';
  protected mfaPassword = '';

  protected configurarMfa() {
    this.mfaCargando.set(true);
    this.mfaError.set('');
    this.auth.configurarMfa().subscribe({
      next: (r) => {
        this.mfaQr.set(r.qr);
        this.mfaSecreto.set(r.secreto);
        this.mfaPaso.set('qr');
        this.mfaCargando.set(false);
      },
      error: (e) => this.fallaMfa(e),
    });
  }

  protected activarMfa() {
    this.mfaCargando.set(true);
    this.mfaError.set('');
    this.auth.activarMfa(this.mfaCodigo).subscribe({ next: () => this.reiniciarMfa(), error: (e) => this.fallaMfa(e) });
  }

  protected desactivarMfa() {
    this.mfaCargando.set(true);
    this.mfaError.set('');
    this.auth
      .desactivarMfa(this.mfaPassword, this.mfaCodigo)
      .subscribe({ next: () => this.reiniciarMfa(), error: (e) => this.fallaMfa(e) });
  }

  private fallaMfa(e: unknown) {
    this.mfaError.set(mensajeError(e));
    this.mfaCargando.set(false);
  }

  private reiniciarMfa() {
    this.mfaPaso.set('inicio');
    this.mfaQr.set('');
    this.mfaSecreto.set('');
    this.mfaCodigo = '';
    this.mfaPassword = '';
    this.mfaError.set('');
    this.mfaCargando.set(false);
  }

  protected restaurarSimilares() {
    guardarLista(CLAVE_SIMILARES, []);
    this.similaresRevisados.set(0);
  }
}
