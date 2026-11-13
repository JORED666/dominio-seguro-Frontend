import { Component, computed, input, output } from '@angular/core';
import { ETIQUETA_ESTADO, ETIQUETA_RIESGO, ETIQUETA_TECNICA, Similar, tramosDe } from '../../../../domain/similares';
import { hace } from '../../../../shared/utils/fechas';

// Tarjeta de un dominio parecido. No decide nada: avisa con eventos y la página actúa.
@Component({
  selector: 'app-similar-card',
  templateUrl: './similar-card.html',
  styleUrl: './similar-card.css',
})
export class SimilarCard {
  similar = input.required<Similar>();
  revisado = input(false);
  revisar = output<string>();
  restaurar = output<string>();

  estado = ETIQUETA_ESTADO;
  riesgo = ETIQUETA_RIESGO;
  tecnica = ETIQUETA_TECNICA;

  tramos = computed(() => tramosDe(this.similar().original, this.similar().nombre));
  cuando = computed(() => `Detectado ${hace(this.similar().detectadoEn)}`);
}
