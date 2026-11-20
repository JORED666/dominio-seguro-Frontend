import { Component, input } from '@angular/core';

// Iconos de trazo (24x24) reutilizables: <app-icono nombre="candado" [tam]="20" />
@Component({
  selector: 'app-icono',
  templateUrl: './icono.html',
  styles: `
    :host { display: inline-flex; line-height: 0; }
  `,
})
export class Icono {
  nombre = input.required<string>();
  tam = input(20);
}
