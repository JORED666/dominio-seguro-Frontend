import { DestroyRef, inject, signal } from '@angular/core';

/**
 * Progreso (0 a 1) de una animación de entrada con ease-out.
 * Sirve para números que suben desde 0 y para aros o barras que se llenan.
 * Hay que crearla en el constructor o en un campo de la clase (necesita contexto de inyección).
 * Con "reducir movimiento" activado en el sistema, salta directo a 1.
 */
export function crearAnimacion(duracionMs = 900) {
  const destruir = inject(DestroyRef);
  const k = signal(0);
  let raf = 0;
  const reducir = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  destruir.onDestroy(() => cancelAnimationFrame(raf));

  return {
    k: k.asReadonly(),

    // Arranca (o reinicia) la animación
    iniciar() {
      cancelAnimationFrame(raf);
      if (reducir) {
        k.set(1);
        return;
      }
      k.set(0);
      const t0 = performance.now();
      const paso = (t: number) => {
        const x = Math.min(1, (t - t0) / duracionMs);
        k.set(1 - Math.pow(1 - x, 3));
        if (x < 1) raf = requestAnimationFrame(paso);
      };
      raf = requestAnimationFrame(paso);
    },

    // Valor entero animado: sube de 0 a v
    n: (v: number) => Math.round(v * k()),
  };
}
