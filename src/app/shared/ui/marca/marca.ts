import { Component, input } from '@angular/core';

// Logo de Dominio Seguro (PNG blanco con fondo transparente en public/logo-simbolo-blanco.png).
@Component({
  selector: 'app-marca',
  template: `<img src="logo-simbolo-blanco.png" [attr.width]="tam()" [attr.height]="tam()" alt="" />`,
  styles: `
    :host { display: inline-flex; line-height: 0; }
    img { display: block; object-fit: contain; }
  `,
})
export class Marca {
  tam = input(28);
  // Se conserva por compatibilidad con los usos existentes; el PNG es el mismo en todos los tamaños.
  mini = input(false);
}
