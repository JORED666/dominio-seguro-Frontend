import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icono } from '../../shared/ui/icono/icono';
import { Marca } from '../../shared/ui/marca/marca';
import { IntroAscii, introYaVista } from '../../shared/layout/intro-ascii/intro-ascii';

interface Revision {
  titulo: string;
  ok: boolean;
  detalle: string;
}

interface Pilar {
  num: string;
  titulo: string;
  texto: string;
  listo: boolean;
}

const MANIFIESTO =
  'La seguridad digital no tiene por qué ser intimidante. Te avisamos antes de que algo falle, en un lenguaje que cualquier dueño de negocio entiende.';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, Icono, Marca, IntroAscii],
  templateUrl: './landing.page.html',
  styleUrl: './landing.page.css',
})
export class Landing {
  private anfitrion = inject<ElementRef<HTMLElement>>(ElementRef);
  private destruir = inject(DestroyRef);

  private escaner = viewChild.required<ElementRef<HTMLElement>>('escaner');
  private manifiesto = viewChild.required<ElementRef<HTMLElement>>('manifiesto');

  reducir = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Intro ASCII: solo la primera visita de la sesión y sin "reducir movimiento"
  introActiva = signal(!this.reducir && !introYaVista());

  bajado = signal(false);
  puntajeHero = signal(0);
  private pEsc = signal(0);
  palabrasOn = signal(0);

  palabras = MANIFIESTO.split(' ');

  // Puntos que aporta cada revisión de ejemplo: suman 82 de 100
  revisiones: Revision[] = [
    { titulo: 'Certificado TLS', ok: true, detalle: 'Vigente · vence en 89 días' },
    { titulo: 'Protocolo de cifrado', ok: true, detalle: 'TLS 1.3 activo' },
    { titulo: 'Cabeceras de seguridad', ok: false, detalle: 'Falta HSTS estricta' },
    { titulo: 'Correo: SPF, DKIM y DMARC', ok: true, detalle: 'Protegido contra suplantación' },
    { titulo: 'Subdominios', ok: false, detalle: '2 subdominios olvidados' },
    { titulo: 'Dominios parecidos', ok: true, detalle: 'Sin copias sospechosas' },
  ];

  puntajeEsc = computed(() => Math.round(82 * Math.min(1, this.pEsc() / 0.9)));
  textoEstado = computed(() => {
    const p = this.pEsc();
    if (p < 0.01) return 'En espera ↓';
    if (p < 0.9) return 'Escaneando…';
    return 'Análisis completo · Nivel bueno';
  });

  pilares: Pilar[] = [
    { num: '01', titulo: 'Certificado HTTPS', texto: 'Vigencia y cifrado del sitio, para que tus clientes nunca vean un aviso rojo de «sitio no seguro».', listo: true },
    { num: '02', titulo: 'Cabeceras de seguridad', texto: 'HSTS, Content-Security-Policy y protección contra clickjacking y XSS.', listo: false },
    { num: '03', titulo: 'Correo del dominio', texto: 'SPF, DKIM y DMARC: que tus correos lleguen a la bandeja y nadie pueda suplantarte.', listo: false },
    { num: '04', titulo: 'Subdominios olvidados', texto: 'Pruebas viejas y entornos de staging que quedaron expuestos como puertas abiertas.', listo: true },
    { num: '05', titulo: 'Dominios parecidos', texto: 'Copias fraudulentas de tu nombre creadas para engañar a tus clientes.', listo: false },
  ];

  pasos = [
    { n: 1, titulo: 'Registra tu dominio', texto: 'Escribe la dirección de tu negocio. Sin descargar programas ni tocar tu código.', pie: '< 1 minuto' },
    { n: 2, titulo: 'Comprueba que es tuyo', texto: 'Validamos la titularidad con un registro DNS. Solo analizamos dominios de sus legítimos dueños.', pie: 'Protegemos tu privacidad' },
    { n: 3, titulo: 'Recibe tu puntaje 0 a 100', texto: 'Un informe claro con la salud de tu sitio y cada problema explicado sin tecnicismos.', pie: 'Lenguaje humano' },
    { n: 4, titulo: 'Corrige con nuestras guías', texto: 'Recomendaciones paso a paso, listas para seguir tú o para pasárselas a tu técnico.', pie: 'Soluciones para copiar y pegar' },
  ];

  constructor() {
    afterNextRender(() => {
      const raiz = this.anfitrion.nativeElement;

      // Entrada de elementos al hacer scroll
      const obs = new IntersectionObserver(
        (entradas) => {
          for (const e of entradas) {
            if (e.isIntersecting) {
              e.target.classList.add('in');
              obs.unobserve(e.target);
            }
          }
        },
        { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
      );
      raiz.querySelectorAll('.rv').forEach((el) => obs.observe(el));

      // Progreso de las secciones fijas (sticky) según el scroll
      let pendiente = false;
      const medir = () => {
        pendiente = false;
        const vh = window.innerHeight;
        const progreso = (el: HTMLElement) => {
          const r = el.getBoundingClientRect();
          const total = r.height - vh;
          return total <= 0 ? 0 : Math.min(1, Math.max(0, -r.top / total));
        };
        const esc = this.escaner().nativeElement;
        const a = progreso(esc);
        esc.style.setProperty('--p', a.toFixed(4));
        this.pEsc.set(Math.round(a * 200) / 200);

        const m = progreso(this.manifiesto().nativeElement);
        this.palabrasOn.set(Math.min(this.palabras.length, Math.floor(m * 1.15 * this.palabras.length)));

        this.bajado.set(window.scrollY > 40);
      };
      const alScroll = () => {
        if (!pendiente) {
          pendiente = true;
          requestAnimationFrame(medir);
        }
      };
      window.addEventListener('scroll', alScroll, { passive: true });
      window.addEventListener('resize', alScroll, { passive: true });
      medir();

      // Puntaje del hero: sube de 0 a 82 cuando termina de escribirse la terminal
      let raf = 0;
      let temporizador: ReturnType<typeof setTimeout> | undefined;
      if (this.reducir) {
        this.puntajeHero.set(82);
      } else {
        temporizador = setTimeout(() => {
          const t0 = performance.now();
          const paso = (t: number) => {
            const k = Math.min(1, (t - t0) / 1400);
            this.puntajeHero.set(Math.round(82 * (1 - Math.pow(1 - k, 3))));
            if (k < 1) raf = requestAnimationFrame(paso);
          };
          raf = requestAnimationFrame(paso);
        }, (this.introActiva() ? 2600 : 0) + 3500);
      }

      this.destruir.onDestroy(() => {
        obs.disconnect();
        window.removeEventListener('scroll', alScroll);
        window.removeEventListener('resize', alScroll);
        cancelAnimationFrame(raf);
        if (temporizador) clearTimeout(temporizador);
      });
    });
  }

  // Estado de cada revisión del escáner según el progreso del scroll
  estado(i: number): 'espera' | 'escaneando' | 'ok' | 'alerta' {
    const p = this.pEsc() / 0.9;
    if (p >= (i + 1) / this.revisiones.length) return this.revisiones[i].ok ? 'ok' : 'alerta';
    if (p >= i / this.revisiones.length && this.pEsc() > 0) return 'escaneando';
    return 'espera';
  }

  ir(e: Event, id: string) {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: this.reducir ? 'auto' : 'smooth', block: 'start' });
  }
}
