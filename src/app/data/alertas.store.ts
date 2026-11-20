import { Injectable, computed, inject, signal } from '@angular/core';
import { Alerta, construirAlertas } from '../domain/alertas';
import { esGrave } from '../domain/severidad';
import { guardarLista, leerLista } from '../shared/utils/almacen';
import { DominiosStore } from './dominios.store';

const CLAVE_DESCARTADAS = 'ds-alertas-descartadas';

/**
 * Alertas calculadas a partir de los dominios y sus historiales, más lo que el usuario descartó.
 * Lo comparten la pantalla de Alertas y la campana de la barra superior.
 */
@Injectable({ providedIn: 'root' })
export class AlertasStore {
  private datos = inject(DominiosStore);

  private _descartadas = signal(leerLista(CLAVE_DESCARTADAS));
  readonly descartadas = this._descartadas.asReadonly();

  readonly todas = computed<Alerta[]>(() =>
    this.datos.dominios().flatMap((d) => {
      const h = this.datos.historialDe(d.id);
      // Con nivel pero sin historial: la API falló para ese dominio, no se inventan alertas
      return d.nivel && !h.length ? [] : construirAlertas(d, h);
    }),
  );

  readonly activas = computed(() => this.todas().filter((a) => !this._descartadas().includes(a.id)));
  readonly graves = computed(() => this.activas().filter((a) => a.sev !== 'ok' && esGrave(a.sev)).length);

  descartar(id: string) {
    this.guardar([...this._descartadas(), id]);
  }

  restaurar(id: string) {
    this.guardar(this._descartadas().filter((x) => x !== id));
  }

  restaurarTodas() {
    this.guardar([]);
  }

  private guardar(lista: string[]) {
    this._descartadas.set(lista);
    guardarLista(CLAVE_DESCARTADAS, lista);
  }
}
