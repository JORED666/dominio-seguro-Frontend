import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Alerta } from '../../../../domain/alertas';
import { ETIQUETA_SEVERIDAD } from '../../../../domain/severidad';
import { hace } from '../../../../shared/utils/fechas';

// Tarjeta de una alerta. No decide nada: avisa con eventos y la página actúa.
@Component({
  selector: 'app-alerta-card',
  imports: [RouterLink],
  templateUrl: './alerta-card.html',
  styleUrl: './alerta-card.css',
})
export class AlertaCard {
  alerta = input.required<Alerta>();
  descartada = input(false);
  descartar = output<string>();
  restaurar = output<string>();

  etiqueta = ETIQUETA_SEVERIDAD;

  cuando = computed(() => {
    const a = this.alerta();
    const t = hace(a.desde);
    return a.tipo === 'hallazgo' ? `Activa desde ${t}` : a.tipo === 'sin-analisis' ? `Agregado ${t}` : `Detectada ${t}`;
  });
}
