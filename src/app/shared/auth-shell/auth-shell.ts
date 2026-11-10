import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// Marco común de las pantallas de acceso (login y registro):
// marco redondeado, fondo con líneas decorativas y contenido centrado.
@Component({
  selector: 'app-auth-shell',
  imports: [RouterLink],
  template: `
    <div class="pagina">
      <div class="marco">
        <a class="inicio" routerLink="/">← Ir al inicio</a>

        <svg class="deco izq" viewBox="0 0 440 400" fill="none" aria-hidden="true">
          <g stroke="#353a58" stroke-width="1.5">
            <path d="M0 340 L130 210 L330 210" />
            <path d="M20 370 L150 240 L350 240 L390 200" />
            <path d="M70 400 L200 270 L330 270" />
            <path d="M0 250 L60 250 L100 290" />
          </g>
          <g fill="#353a58">
            <circle cx="130" cy="210" r="5" />
            <circle cx="390" cy="200" r="5" />
            <circle cx="60" cy="250" r="4" />
            <circle cx="330" cy="270" r="4" />
          </g>
          <circle cx="260" cy="330" r="14" fill="#242f4f" />
          <circle cx="170" cy="370" r="7" fill="#242f4f" />
        </svg>

        <svg class="deco der" viewBox="0 0 440 460" fill="none" aria-hidden="true">
          <g stroke="#353a58" stroke-width="1.5">
            <path d="M440 120 L330 120 L270 180" />
            <path d="M440 230 L300 230 L360 290 L440 290" />
            <path d="M440 330 L350 330 L400 380 L440 380" />
            <path d="M250 60 L300 20" />
          </g>
          <g fill="#353a58">
            <circle cx="270" cy="180" r="5" />
            <circle cx="300" cy="230" r="5" />
            <circle cx="250" cy="60" r="4" />
          </g>
          <circle cx="400" cy="60" r="8" fill="#242f4f" />
          <circle cx="330" cy="400" r="4" stroke="#353a58" stroke-width="1.5" />
        </svg>

        <svg class="deco arco" viewBox="0 0 300 300" fill="none" aria-hidden="true">
          <path d="M20 20 Q150 20 280 150" stroke="#353a58" stroke-width="1.5" stroke-dasharray="5 7" />
        </svg>
        <svg class="deco rayas r1" viewBox="0 0 160 14" aria-hidden="true">
          <g stroke="#2b3354" stroke-width="5">
            <path d="M0 14 L10 0M16 14 L26 0M32 14 L42 0M48 14 L58 0M64 14 L74 0M80 14 L90 0M96 14 L106 0M112 14 L122 0M128 14 L138 0M144 14 L154 0" />
          </g>
        </svg>
        <svg class="deco rayas r2" viewBox="0 0 160 14" aria-hidden="true">
          <g stroke="#2b3354" stroke-width="5">
            <path d="M0 14 L10 0M16 14 L26 0M32 14 L42 0M48 14 L58 0M64 14 L74 0M80 14 L90 0M96 14 L106 0M112 14 L122 0M128 14 L138 0M144 14 L154 0" />
          </g>
        </svg>

        <div class="contenido"><ng-content /></div>
      </div>
    </div>
  `,
  styles: `
    .pagina {
      min-height: 100vh;
      background: var(--fondo);
    }
    .marco {
      position: relative;
      overflow: hidden;
      min-height: 100vh;
      background:
        radial-gradient(circle at 18% 22%, rgba(91, 108, 248, 0.14), transparent 28%),
        var(--fondo);
      display: grid;
      place-items: center;
      padding: 72px 16px 48px;
    }
    .inicio {
      position: absolute;
      top: 40px;
      left: 40px;
      z-index: 2;
      padding: 10px 24px;
      border: 1px solid var(--borde);
      border-radius: 999px;
      background: rgba(26, 30, 42, 0.8);
      color: var(--texto);
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
    }
    .inicio:hover { border-color: var(--acento-claro); }
    .deco { position: absolute; pointer-events: none; }
    .deco.izq { left: 0; bottom: 0; width: 40%; max-width: 440px; }
    .deco.der { right: 0; top: 14%; width: 38%; max-width: 440px; }
    .deco.arco { left: 38%; top: 0; width: 24%; max-width: 300px; opacity: 0.8; }
    .deco.rayas { width: 130px; }
    .deco.r1 { left: 5%; bottom: 5%; }
    .deco.r2 { right: 6%; top: 52%; width: 170px; }
    .contenido { position: relative; z-index: 1; width: 100%; display: grid; place-items: center; }

    @media (max-width: 700px) {
      .marco { padding-top: 88px; }
      .inicio { top: 20px; left: 20px; }
      .deco { opacity: 0.5; }
    }
  `,
})
export class AuthShell {}
