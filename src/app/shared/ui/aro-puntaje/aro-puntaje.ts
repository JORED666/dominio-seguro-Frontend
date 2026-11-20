import { Component, computed, input } from '@angular/core';
import { Nivel } from '../../../core/modelos';

// Aro con el puntaje de un dominio. "progreso" (0 a 1) permite animarlo desde fuera.
@Component({
  selector: 'app-aro-puntaje',
  templateUrl: './aro-puntaje.html',
  styleUrl: './aro-puntaje.css',
  host: {
    '[attr.data-nivel]': 'nivel() ?? "sin"',
    '[style.--p]': '(puntaje() ?? 0) * progreso()',
    '[style.--tam]': 'tam() + "px"',
    '[style.--hueco]': 'hueco()',
  },
})
export class AroPuntaje {
  puntaje = input<number | null>(null);
  nivel = input<Nivel | null>(null);
  progreso = input(1);
  texto = input('PUNTOS');
  tam = input(96);
  hueco = input('var(--fondo)'); // color del círculo interior: el del fondo donde se coloque

  valor = computed(() => {
    const p = this.puntaje();
    return p === null ? '--' : Math.round(p * this.progreso());
  });
}
