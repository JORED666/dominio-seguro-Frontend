import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AlertasStore } from '../../data/alertas.store';
import { DominiosStore } from '../../data/dominios.store';
import { guardarLista, leerLista } from '../../shared/utils/almacen';

const CLAVE_SIMILARES = 'ds-similares-revisados';

@Component({
  selector: 'app-cuenta',
  imports: [RouterLink],
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

  protected restaurarSimilares() {
    guardarLista(CLAVE_SIMILARES, []);
    this.similaresRevisados.set(0);
  }
}
