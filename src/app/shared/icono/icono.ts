import { Component, input } from '@angular/core';

// Iconos de trazo (24x24) reutilizables: <app-icono nombre="candado" [tam]="20" />
@Component({
  selector: 'app-icono',
  template: `
    <svg
      [attr.width]="tam()"
      [attr.height]="tam()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (nombre()) {
        @case ('escudo') {
          <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" />
          <path d="M9 12l2 2 4-4" />
        }
        @case ('politica') {
          <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" />
        }
        @case ('candado') {
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 1 1 8 0v3" />
        }
        @case ('terminal') {
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="m7 9 3 3-3 3M13 15h4" />
        }
        @case ('correo') {
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        }
        @case ('arbol') {
          <path d="M6 4h4v4H6zM6 16h4v4H6zM14 16h4v4h-4z" />
          <path d="M8 8v8M8 12h8v4" />
        }
        @case ('radar') {
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 12l6-6" />
        }
        @case ('check') {
          <path d="M5 12l5 5 9-10" />
        }
        @case ('aviso') {
          <path d="M12 4 2.5 20h19z" />
          <path d="M12 10v4M12 17v.5" />
        }
        @case ('globo') {
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
        }
        @case ('flecha') {
          <path d="M5 12h14M13 6l6 6-6 6" />
        }
        @case ('play') {
          <circle cx="12" cy="12" r="9" />
          <path d="M10 8.5v7l6-3.5z" />
        }
        @case ('reloj') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        }
        @case ('grafica') {
          <path d="M4 18l5-6 4 3 7-9" />
          <path d="M4 21h16" />
        }
        @case ('tarea') {
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 3 3 5-6" />
        }
        @case ('ojo') {
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        }
        @case ('tendencia') {
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M15 7h6v6" />
        }
        @case ('buscar') {
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        }
      }
    </svg>
  `,
  styles: `
    :host { display: inline-flex; line-height: 0; }
  `,
})
export class Icono {
  nombre = input.required<string>();
  tam = input(20);
}
