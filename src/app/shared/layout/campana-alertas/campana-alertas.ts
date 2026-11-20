import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertasStore } from '../../../data/alertas.store';

// Campana de la barra superior: lleva a Alertas y muestra cuántas son graves
@Component({
  selector: 'app-campana-alertas',
  imports: [RouterLink],
  templateUrl: './campana-alertas.html',
  styleUrl: './campana-alertas.css',
})
export class CampanaAlertas {
  protected alertas = inject(AlertasStore);
}
