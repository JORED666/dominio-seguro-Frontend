import { Component, DestroyRef, ElementRef, afterNextRender, inject, output, signal, viewChild } from '@angular/core';

const CLAVE = 'ds-intro';

/** ¿Ya se mostró la intro en esta sesión del navegador? */
export function introYaVista(): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(CLAVE) === '1';
  } catch {
    return false;
  }
}

interface Celda {
  c: number;
  r: number;
  ch: string;
  d: number; // ms en que empieza a aparecer (de adentro hacia afuera)
  hasta: number; // marca de tiempo hasta la que está resaltada
}

// Del más tenue al más denso
const RAMPA = '..:+xX#@';
const COLOR_CARACTER = '#6f7ce0';
const COLOR_RESALTE = '#5b6cf8';
const COLOR_FONDO = '#141720';

/**
 * Intro de pantalla completa: el logo se "descifra" en caracteres ASCII de adentro hacia afuera
 * y reacciona al cursor. Dura ~2.4 s, se puede saltar y solo se muestra una vez por sesión.
 */
@Component({
  selector: 'app-intro-ascii',
  template: `
    <div class="intro" [class.sale]="saliendo()" (click)="saltar()">
      <canvas #lienzo aria-hidden="true"></canvas>
      <button type="button" class="saltar" (click)="saltar(); $event.stopPropagation()">Saltar</button>
    </div>
  `,
  styles: `
    .intro {
      position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center;
      background: ${COLOR_FONDO}; cursor: pointer; opacity: 1; transition: opacity 0.55s ease;
    }
    .intro.sale { opacity: 0; pointer-events: none; }
    canvas { display: block; }
    .saltar {
      position: absolute; right: 20px; bottom: 20px; padding: 8px 14px; cursor: pointer;
      font: 500 12px/1 'JetBrains Mono', ui-monospace, monospace; letter-spacing: 0.08em; text-transform: uppercase;
      color: var(--suave, #9aa3c7); background: transparent; border: 1px solid var(--borde, #353a58); border-radius: 999px;
    }
    .saltar:hover, .saltar:focus-visible { color: #fff; border-color: var(--acento-claro, #8e99f5); outline: none; }
  `,
})
export class IntroAscii {
  terminada = output<void>();
  saliendo = signal(false);

  private lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');
  private destruir = inject(DestroyRef);
  private fin: ReturnType<typeof setTimeout> | undefined;
  private cerrada = false;

  constructor() {
    afterNextRender(() => {
      const cv = this.lienzo().nativeElement;
      const bloqueoPrevio = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      let raf = 0;
      let activa = true;
      let alMover: ((e: MouseEvent) => void) | null = null;
      const limpiar = () => {
        activa = false;
        cancelAnimationFrame(raf);
        removeEventListener('keydown', alTeclear);
        if (alMover) removeEventListener('mousemove', alMover);
        document.body.style.overflow = bloqueoPrevio;
      };
      const alTeclear = (e: KeyboardEvent) => {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.saltar();
        }
      };
      addEventListener('keydown', alTeclear);
      this.destruir.onDestroy(() => {
        limpiar();
        if (this.fin) clearTimeout(this.fin);
      });

      const img = new Image();
      img.onerror = () => this.cerrar(); // si no carga el logo, no bloqueamos la página
      img.onload = () => {
        if (!activa) return;
        const COLS = innerWidth < 640 ? 44 : 64;
        const lado = Math.min(innerHeight * 0.8, innerWidth * 0.92, 660);
        const CELDA = lado / COLS;
        const dpr = Math.min(devicePixelRatio || 1, 2);

        // Muestreamos la opacidad del PNG (el logo es blanco sobre transparente)
        const m = document.createElement('canvas');
        m.width = COLS;
        m.height = COLS;
        const mc = m.getContext('2d', { willReadFrequently: true });
        if (!mc) return this.cerrar();
        mc.drawImage(img, 0, 0, COLS, COLS);
        const px = mc.getImageData(0, 0, COLS, COLS).data;

        const celdas = new Map<string, Celda>();
        const lista: Celda[] = [];
        const centro = (COLS - 1) / 2;
        const maxDist = Math.hypot(centro, centro);
        for (let r = 0; r < COLS; r++) {
          for (let c = 0; c < COLS; c++) {
            const a = px[(r * COLS + c) * 4 + 3] / 255;
            if (a < 0.12) continue;
            const ch = RAMPA[Math.min(RAMPA.length - 1, Math.floor(a * RAMPA.length))];
            const d = (Math.hypot(c - centro, r - centro) / maxDist) * 900 + Math.random() * 160;
            const celda: Celda = { c, r, ch, d, hasta: 0 };
            celdas.set(c + ',' + r, celda);
            lista.push(celda);
          }
        }
        if (!lista.length) return this.cerrar();

        cv.width = COLS * CELDA * dpr;
        cv.height = COLS * CELDA * dpr;
        cv.style.width = COLS * CELDA + 'px';
        cv.style.height = COLS * CELDA + 'px';
        const x = cv.getContext('2d');
        if (!x) return this.cerrar();
        x.setTransform(dpr, 0, 0, dpr, 0, 0);
        x.font = `${Math.max(6, CELDA * 1.05)}px 'JetBrains Mono', ui-monospace, monospace`;
        x.textAlign = 'center';
        x.textBaseline = 'middle';

        const iluminar = (inicio: Celda) => {
          const ahora = performance.now();
          inicio.hasta = ahora + 650;
          let actual = inicio;
          const vistas = [inicio];
          for (let i = 0; i < 14; i++) {
            const vecinas: Celda[] = [];
            for (let dy = -1; dy <= 1; dy++)
              for (let dx = -1; dx <= 1; dx++) {
                const v = celdas.get(actual.c + dx + ',' + (actual.r + dy));
                if (v && !vistas.includes(v)) vecinas.push(v);
              }
            if (!vecinas.length) break;
            actual = vecinas[Math.floor(Math.random() * vecinas.length)];
            actual.hasta = ahora + 650 + i * 12;
            vistas.push(actual);
          }
        };
        alMover = (e: MouseEvent) => {
          const R = cv.getBoundingClientRect();
          const mc2 = (e.clientX - R.left) / CELDA;
          const mr = (e.clientY - R.top) / CELDA;
          let mejor: Celda | null = null;
          let dmin = Infinity;
          for (const k of lista) {
            const dd = Math.hypot(mc2 - k.c, mr - k.r);
            if (dd < dmin) {
              dmin = dd;
              mejor = k;
            }
          }
          if (mejor && dmin < 7) iluminar(mejor);
        };
        addEventListener('mousemove', alMover);

        const t0 = performance.now();
        const MANTENER = 2000; // ms antes de empezar a desvanecer
        const dibujar = (ahora: number) => {
          const t = ahora - t0;
          x.clearRect(0, 0, COLS * CELDA, COLS * CELDA);
          for (const k of lista) {
            const p = Math.min(1, Math.max(0, (t - k.d) / 380));
            if (p === 0) continue;
            const encendida = k.hasta > ahora;
            const px0 = k.c * CELDA;
            const py0 = k.r * CELDA;
            if (encendida) {
              x.globalAlpha = 1;
              x.fillStyle = COLOR_RESALTE;
              x.fillRect(px0, py0, CELDA, CELDA);
            }
            x.globalAlpha = p;
            x.fillStyle = encendida ? COLOR_FONDO : COLOR_CARACTER;
            // mientras "se descifra" muestra símbolos al azar y se asienta al final
            const letra = p < 0.75 ? RAMPA[Math.floor(Math.random() * RAMPA.length)] : k.ch;
            x.fillText(letra, px0 + CELDA / 2, py0 + CELDA / 2);
          }
          x.globalAlpha = 1;
          if (t > MANTENER && !this.cerrada) this.cerrar();
          if (activa) raf = requestAnimationFrame(dibujar);
        };
        raf = requestAnimationFrame(dibujar);
      };
      img.src = 'logo-simbolo-blanco.png';
    });
  }

  saltar() {
    this.cerrar();
  }

  private cerrar() {
    if (this.cerrada) return;
    this.cerrada = true;
    try {
      sessionStorage.setItem(CLAVE, '1');
    } catch {
      /* sin almacenamiento: la intro se mostrará otra vez, no pasa nada */
    }
    this.saliendo.set(true);
    this.fin = setTimeout(() => {
      document.body.style.overflow = '';
      this.terminada.emit();
    }, 560);
  }
}
