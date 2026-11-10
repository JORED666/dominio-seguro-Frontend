import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icono } from '../../shared/icono/icono';
import { Marca } from '../../shared/marca/marca';
import { IntroAscii, introYaVista } from '../../shared/intro-ascii/intro-ascii';

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
  template: `
    <div class="lp" [class.reducir]="reducir" [class.en-pausa]="introActiva()">
      @if (introActiva()) {
        <app-intro-ascii (terminada)="introActiva.set(false)" />
      }
      <div class="grano" aria-hidden="true"></div>

      <!-- NAVEGACIÓN -->
      <header class="nav" [class.solido]="bajado()">
        <a class="logo con-marca" routerLink="/" aria-label="Dominio Seguro, inicio"><app-marca [tam]="30" [mini]="true" />DOMINIO<b>/</b>SEGURO</a>
        <nav class="nav-links">
          <a href="#escaner" (click)="ir($event, 'escaner')">Análisis</a>
          <a href="#revisamos" (click)="ir($event, 'revisamos')">Qué revisamos</a>
          <a href="#pasos" (click)="ir($event, 'pasos')">Cómo funciona</a>
        </nav>
        <div class="nav-acciones">
          <a class="btn-linea" routerLink="/login">Entrar</a>
          <a class="btn-neon" routerLink="/registro">Crear cuenta</a>
        </div>
      </header>

      <!-- HERO -->
      <section class="hero" id="inicio">
        <div class="hero-rejilla" aria-hidden="true"></div>
        <div class="barrido" aria-hidden="true"></div>

        <div class="hero-contenido">
          <div class="hero-izq">
            <p class="etq"><i class="parpadeo"></i> // VIGILANCIA DE DOMINIOS PARA NEGOCIOS</p>
            <h1>
              <span class="ln" style="--i: 0"><span>¿TU SITIO</span></span>
              <span class="ln" style="--i: 1"><span>WEB ES</span></span>
              <span class="ln" style="--i: 2"><span class="hueco">REALMENTE</span></span>
              <span class="ln" style="--i: 3"><span class="neon">SEGURO<em>?</em></span></span>
            </h1>
            <p class="lead">
              Escaneamos tu dominio todos los días y te avisamos, en lenguaje claro, antes de que algo falle o afecte a tus clientes.
            </p>
            <div class="cta-fila">
              <a class="btn-neon grande" routerLink="/registro">EMPEZAR GRATIS <app-icono nombre="flecha" [tam]="18" /></a>
              <a class="btn-linea grande" href="#escaner" (click)="ir($event, 'escaner')">VER UN ANÁLISIS ↓</a>
            </div>
          </div>

          <aside class="term" aria-label="Ejemplo ilustrativo de un análisis">
            <div class="term-barra">
              <span></span><span></span><span></span>
              <small>ejemplo ilustrativo</small>
            </div>
            <div class="term-cuerpo">
              <p class="t" style="--d: 0.9s"><b class="g">$</b> escanear panaderiaelsol.mx</p>
              <p class="t" style="--d: 1.5s"><b class="ok">[ OK ]</b> Certificado TLS vigente</p>
              <p class="t" style="--d: 1.9s"><b class="ok">[ OK ]</b> Protocolo TLS 1.3</p>
              <p class="t" style="--d: 2.3s"><b class="al">[ !! ]</b> Falta cabecera HSTS</p>
              <p class="t" style="--d: 2.7s"><b class="ok">[ OK ]</b> SPF · DKIM · DMARC</p>
              <p class="t" style="--d: 3.1s"><b class="al">[ !! ]</b> 2 subdominios olvidados</p>
              <div class="t term-puntaje" style="--d: 3.5s">
                <span>PUNTAJE</span>
                <strong>{{ puntajeHero() }}<small>/100</small></strong>
                <div class="term-barra-p"><i [style.width.%]="puntajeHero()"></i></div>
              </div>
            </div>
          </aside>
        </div>

        <div class="marquee" aria-hidden="true">
          <div class="marquee-pista">
            @for (n of [1, 2]; track n) {
              <span>TLS ✦ HSTS ✦ SPF ✦ DKIM ✦ DMARC ✦ SUBDOMINIOS ✦ TYPOSQUATTING ✦ REPUTACIÓN DE IP ✦ </span>
            }
          </div>
        </div>
      </section>

      <!-- ESCÁNER (sección fija que se controla con el scroll) -->
      <section class="escaner" id="escaner" #escaner>
        <div class="esc-pin">
          <div class="linea-escaneo" aria-hidden="true"></div>
          <div class="esc-izq">
            <p class="etq">// 01 · ASÍ SE VE UN ANÁLISIS</p>
            <div class="gran-num">{{ puntajeEsc() }}<small>/100</small></div>
            <div class="barra-g"><i [style.width.%]="puntajeEsc()"></i></div>
            <p class="esc-estado">{{ textoEstado() }}</p>
            <p class="nota">Ejemplo ilustrativo · desplázate para escanear</p>
          </div>
          <ul class="esc-lista">
            @for (c of revisiones; track c.titulo; let i = $index) {
              <li [attr.data-e]="estado(i)">
                <span class="chip">
                  @switch (estado(i)) {
                    @case ('ok') { ✓ }
                    @case ('alerta') { ! }
                    @case ('escaneando') { <i class="parpadeo"></i> }
                    @default { · }
                  }
                </span>
                <div>
                  <strong>{{ c.titulo }}</strong>
                  <small>{{ estado(i) === 'espera' || estado(i) === 'escaneando' ? 'Analizando…' : c.detalle }}</small>
                </div>
              </li>
            }
          </ul>
        </div>
      </section>

      <!-- QUÉ REVISAMOS -->
      <section class="revisamos" id="revisamos">
        <p class="etq rv">// 02 · QUÉ REVISAMOS</p>
        <h2 class="titulo-gigante rv">CINCO COSAS<br />QUE PUEDEN<br /><span class="neon">ROMPER TU NEGOCIO</span></h2>
        <div class="filas">
          @for (p of pilares; track p.num) {
            <article class="fila rv">
              <span class="fila-num">{{ p.num }}</span>
              <h3>{{ p.titulo }}</h3>
              <p>{{ p.texto }}</p>
              @if (!p.listo) { <span class="pronto">PRÓXIMAMENTE</span> } @else { <span class="listo">ACTIVO</span> }
            </article>
          }
        </div>
      </section>

      <!-- CÓMO FUNCIONA: tarjetas que se apilan -->
      <section class="pasos" id="pasos">
        <p class="etq rv">// 03 · CÓMO FUNCIONA</p>
        <h2 class="titulo-gigante rv">CUATRO PASOS.<br /><span class="hueco">CERO TECNICISMOS.</span></h2>
        <div class="pila">
          @for (s of pasos; track s.n; let i = $index) {
            <article class="paso" [class.ultimo]="i === pasos.length - 1" [style.--i]="i">
              <span class="paso-n">0{{ s.n }}</span>
              <div>
                <h3>{{ s.titulo }}</h3>
                <p>{{ s.texto }}</p>
              </div>
              <span class="paso-pie">{{ s.pie }}</span>
            </article>
          }
        </div>
      </section>

      <!-- MANIFIESTO: las palabras se encienden con el scroll -->
      <section class="manifiesto" #manifiesto>
        <div class="man-pin">
          <p class="etq">// 04 · NUESTRA IDEA</p>
          <p class="man-texto" aria-label="La seguridad digital no tiene por qué ser intimidante. Te avisamos antes de que algo falle, en un lenguaje que cualquier dueño de negocio entiende.">
            @for (w of palabras; track $index; let i = $index) {
              <span class="pal" [class.on]="i < palabrasOn()" aria-hidden="true">{{ w }} </span>
            }
          </p>
        </div>
      </section>

      <!-- CTA FINAL -->
      <section class="final">
        <h2 class="titulo-gigante rv">ANALIZA TU<br /><span class="neon">PRIMER DOMINIO</span></h2>
        <p class="rv final-sub">Gratis. Sin instalar nada. Resultados en menos de un minuto.</p>
        <a class="btn-neon enorme rv" routerLink="/registro">CREAR CUENTA GRATIS <app-icono nombre="flecha" [tam]="22" /></a>
        <a class="ya-tengo rv" routerLink="/login">Ya tengo cuenta →</a>
      </section>

      <footer class="pie" id="contacto">
        <div class="pie-fila">
          <strong class="logo con-marca"><app-marca [tam]="26" [mini]="true" />DOMINIO<b>/</b>SEGURO</strong>
          <p>© 2026 Dominio Seguro. Solo analizamos dominios cuya propiedad fue verificada por sus legítimos dueños.</p>
        </div>
      </footer>
    </div>
  `,
  styles: `
    :host { display: block; }
    .lp {
      --neg: var(--fondo); --papel: var(--texto); --gris: var(--suave); --linea: #2a3050; --panel: var(--tarjeta-2);
      --neon: var(--acento-claro); --rell: var(--acento); --warn: var(--ambar); --mal: var(--rojo);
      --mono: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
      position: relative; overflow-x: clip; background: var(--neg); color: var(--papel);
    }
    .lp h1, .lp h2, .lp h3 { color: inherit; margin: 0; }
    .grano {
      position: fixed; inset: 0; z-index: 50; pointer-events: none; opacity: 0.05; mix-blend-mode: overlay;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
    }
    .neon { color: var(--neon); }
    .hueco { color: transparent; -webkit-text-stroke: 2px var(--papel); }
    .etq { margin: 0 0 22px; font-family: var(--mono); font-size: 12px; letter-spacing: 0.14em; color: var(--gris); display: flex; align-items: center; gap: 10px; }
    .parpadeo { display: inline-block; width: 8px; height: 8px; background: var(--neon); animation: parp 1s steps(2) infinite; }
    @keyframes parp { 50% { opacity: 0; } }

    /* Botones */
    .btn-neon, .btn-linea {
      display: inline-flex; align-items: center; gap: 10px; height: 42px; padding: 0 20px; text-decoration: none; cursor: pointer;
      font-family: var(--mono); font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
      transition: transform 160ms ease-out, background 160ms ease-out, color 160ms ease-out, box-shadow 160ms ease-out;
    }
    .btn-neon { background: var(--rell); color: #fff; border: 0; }
    .btn-neon:hover { box-shadow: 0 0 0 4px rgba(91, 108, 248, 0.3), 0 0 40px rgba(91, 108, 248, 0.45); }
    .btn-linea { background: transparent; color: var(--papel); border: 1px solid var(--borde); }
    .btn-linea:hover { border-color: var(--neon); color: var(--neon); }
    .btn-neon:active, .btn-linea:active { transform: scale(0.97); }
    .grande { height: 54px; padding: 0 28px; font-size: 14px; }
    .enorme { height: 72px; padding: 0 40px; font-size: 18px; }

    /* Navegación */
    .nav { position: fixed; top: 0; left: 0; right: 0; z-index: 60; display: flex; align-items: center; gap: 24px; padding: 16px max(24px, 4vw); transition: background 200ms ease-out, border-color 200ms ease-out; border-bottom: 1px solid transparent; }
    .nav.solido { background: rgba(14, 16, 23, 0.88); backdrop-filter: blur(10px); border-bottom-color: var(--linea); }
    .logo { font-family: var(--fuente-titulo); font-weight: 700; letter-spacing: 0.04em; font-size: 1.05rem; color: var(--papel); text-decoration: none; }
    .logo b { color: var(--neon); margin: 0 1px; }
    .con-marca { display: inline-flex; align-items: center; }
    .con-marca app-marca { margin-right: 10px; }
    .nav-links { flex: 1; display: flex; justify-content: center; gap: 32px; }
    .nav-links a { font-family: var(--mono); font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gris); text-decoration: none; transition: color 160ms; }
    .nav-links a:hover { color: var(--neon); }
    .nav-acciones { display: flex; gap: 10px; margin-left: auto; }

    /* Hero */
    /* Mientras corre la intro, las animaciones de la Landing esperan */
    .en-pausa *, .en-pausa *::before, .en-pausa *::after { animation-play-state: paused !important; }
    .hero { position: relative; min-height: 100svh; display: flex; flex-direction: column; padding-top: 96px; overflow: hidden;
      background: radial-gradient(ellipse 70% 60% at 70% 15%, rgba(91, 108, 248, 0.18), transparent 70%); }
    .hero-rejilla { position: absolute; inset: 0; opacity: 0.5; pointer-events: none;
      background-image: linear-gradient(var(--linea) 1px, transparent 1px), linear-gradient(90deg, var(--linea) 1px, transparent 1px);
      background-size: 64px 64px; mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, #000 30%, transparent 100%); }
    .barrido { position: absolute; left: 0; right: 0; top: 0; height: 160px; pointer-events: none; opacity: 0;
      background: linear-gradient(180deg, transparent, rgba(91, 108, 248, 0.25) 85%, var(--neon) 99%, transparent 100%);
      animation: barrer 1.6s cubic-bezier(0.6, 0, 0.3, 1) 0.2s forwards; }
    @keyframes barrer { 0% { transform: translateY(-160px); opacity: 1; } 100% { transform: translateY(100vh); opacity: 0; } }
    .hero-contenido { position: relative; flex: 1; display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.9fr); gap: 48px; align-items: center; padding: 24px max(24px, 4vw) 48px; }
    .hero h1 { font-family: var(--fuente-titulo); font-weight: 700; font-size: clamp(3rem, 8.4vw, 8rem); line-height: 0.92; letter-spacing: -0.04em; }
    .ln { display: block; overflow: hidden; padding-bottom: 0.04em; }
    .ln > span { display: block; transform: translateY(105%); animation: sube 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; animation-delay: calc(0.25s + var(--i) * 0.1s); }
    .ln em { font-style: normal; display: inline-block; animation: balanceo 3s ease-in-out 1.8s infinite; }
    @keyframes sube { to { transform: none; } }
    @keyframes balanceo { 0%, 100% { transform: none; } 50% { transform: translateY(-6px) rotate(-6deg); } }
    .lead { margin: 28px 0 32px; max-width: 46ch; font-size: 1.15rem; line-height: 1.55; color: var(--gris); opacity: 0; animation: aparece 0.7s ease-out 1s forwards; }
    .cta-fila { display: flex; flex-wrap: wrap; gap: 12px; opacity: 0; animation: aparece 0.7s ease-out 1.2s forwards; }
    @keyframes aparece { to { opacity: 1; } }

    .term { background: var(--panel); border: 1px solid var(--borde); box-shadow: 0 0 0 1px #000, 0 40px 100px rgba(0, 0, 0, 0.6), 0 0 80px rgba(91, 108, 248, 0.14); opacity: 0; transform: translateY(24px); animation: entra 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.6s forwards; }
    @keyframes entra { to { opacity: 1; transform: none; } }
    .term-barra { display: flex; align-items: center; gap: 7px; padding: 12px 16px; border-bottom: 1px solid var(--linea); }
    .term-barra span { width: 10px; height: 10px; border-radius: 50%; background: var(--borde); }
    .term-barra small { margin-left: auto; font-family: var(--mono); font-size: 11px; color: var(--gris); }
    .term-cuerpo { padding: 20px 20px 24px; font-family: var(--mono); font-size: 13.5px; line-height: 1.5; min-height: 300px; }
    .term-cuerpo .t { margin: 0 0 10px; opacity: 0; animation: aparece 0.01s linear forwards; animation-delay: var(--d); }
    .term-cuerpo b { font-weight: 700; margin-right: 8px; }
    .g { color: var(--neon); } .ok { color: var(--verde); } .al { color: var(--warn); }
    .term-puntaje { margin-top: 18px !important; padding-top: 16px; border-top: 1px dashed var(--borde); display: grid; grid-template-columns: auto 1fr; align-items: end; gap: 6px 16px; }
    .term-puntaje span { color: var(--gris); font-size: 11px; letter-spacing: 0.14em; }
    .term-puntaje strong { grid-column: 1; font-family: var(--fuente-titulo); font-size: 3.4rem; line-height: 1; color: var(--verde); }
    .term-puntaje small { font-size: 1rem; color: var(--gris); font-family: var(--mono); }
    .term-barra-p { grid-column: 2; grid-row: 2; height: 10px; background: #1f2434; align-self: center; }
    .term-barra-p i { display: block; height: 100%; background: var(--verde); }

    .marquee { position: relative; overflow: hidden; transform: rotate(-1.2deg) scale(1.03); background: var(--rell); color: #fff; border-block: 2px solid var(--neg); }
    .marquee-pista { display: flex; width: max-content; animation: corre 32s linear infinite; }
    .marquee-pista span { padding: 12px 0; font-family: var(--fuente-titulo); font-weight: 700; font-size: 1.3rem; letter-spacing: 0.06em; white-space: pre; }
    @keyframes corre { to { transform: translateX(-50%); } }

    /* Escáner fijo */
    .escaner { position: relative; height: 420vh; }
    .esc-pin { position: sticky; top: 0; height: 100svh; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 48px; align-items: center; padding: 0 max(24px, 4vw); overflow: hidden; }
    .linea-escaneo { position: absolute; top: 0; bottom: 0; width: 2px; left: calc(var(--p, 0) * 100%); background: var(--neon); box-shadow: 0 0 24px 4px rgba(91, 108, 248, 0.6), -140px 0 120px 20px rgba(91, 108, 248, 0.1); pointer-events: none; }
    .gran-num { font-family: var(--fuente-titulo); font-weight: 700; font-size: clamp(7rem, 24vw, 22rem); line-height: 0.85; letter-spacing: -0.05em; color: var(--verde); font-variant-numeric: tabular-nums; }
    .gran-num small { font-size: 0.22em; letter-spacing: 0; color: var(--gris); font-family: var(--mono); margin-left: 8px; }
    .barra-g { height: 12px; background: #1f2434; margin: 28px 0 18px; max-width: 520px; }
    .barra-g i { display: block; height: 100%; background: var(--verde); }
    .esc-estado { margin: 0 0 6px; font-family: var(--mono); font-size: 14px; letter-spacing: 0.06em; text-transform: uppercase; }
    .nota { margin: 0; font-size: 12px; color: var(--gris); }
    .esc-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .esc-lista li { display: flex; align-items: center; gap: 20px; padding: 22px 0; border-bottom: 1px solid var(--linea); transition: opacity 250ms ease-out; }
    .esc-lista li strong { display: block; font-family: var(--fuente-titulo); font-size: clamp(1.2rem, 2.2vw, 1.8rem); letter-spacing: -0.01em; }
    .esc-lista li small { display: block; margin-top: 2px; font-family: var(--mono); font-size: 12px; color: var(--gris); }
    .esc-lista li[data-e='espera'] { opacity: 0.32; }
    .chip { flex: none; width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid var(--borde); font-family: var(--mono); font-weight: 700; font-size: 18px; color: var(--gris); }
    .esc-lista li[data-e='escaneando'] .chip { border-color: var(--neon); }
    .esc-lista li[data-e='ok'] .chip { background: var(--verde); border-color: var(--verde); color: #000; }
    .esc-lista li[data-e='alerta'] .chip { background: var(--warn); border-color: var(--warn); color: #000; }
    .esc-lista li[data-e='alerta'] small { color: var(--warn); }

    /* Secciones con título gigante */
    .revisamos, .pasos, .final { padding: 140px max(24px, 4vw) 60px; }
    .titulo-gigante { font-family: var(--fuente-titulo); font-weight: 700; font-size: clamp(2.6rem, 7.4vw, 7rem); line-height: 0.96; letter-spacing: -0.04em; margin-bottom: 64px !important; }

    .rv { opacity: 0; transform: translateY(48px); transition: opacity 700ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 700ms cubic-bezier(0.2, 0.8, 0.2, 1); }
    .rv.in { opacity: 1; transform: none; }

    .filas { border-top: 1px solid var(--linea); }
    .fila { display: grid; grid-template-columns: 90px minmax(0, 1.1fr) minmax(0, 1.4fr) 130px; align-items: center; gap: 24px; padding: 34px 20px; border-bottom: 1px solid var(--linea); transition: background 180ms ease-out, color 180ms ease-out, padding 180ms ease-out; }
    .fila:hover { background: var(--rell); color: #fff; padding-left: 32px; }
    .fila-num { font-family: var(--mono); font-size: 14px; color: var(--gris); }
    .fila h3 { font-family: var(--fuente-titulo); font-size: clamp(1.4rem, 2.6vw, 2.4rem); letter-spacing: -0.02em; line-height: 1.05; }
    .fila p { margin: 0; color: var(--gris); font-size: 15px; line-height: 1.5; transition: color 180ms; }
    .fila:hover p, .fila:hover .fila-num { color: rgba(255, 255, 255, 0.85); }
    .pronto, .listo { justify-self: end; font-family: var(--mono); font-size: 11px; letter-spacing: 0.1em; padding: 5px 10px; border: 1px solid currentColor; }
    .pronto { color: var(--warn); } .listo { color: var(--verde); }
    .fila:hover .pronto, .fila:hover .listo { color: #fff; }

    /* Pasos apilados */
    .pila { position: relative; }
    .paso { position: sticky; top: calc(92px + var(--i) * 26px); display: grid; grid-template-columns: 180px minmax(0, 1fr); grid-template-rows: 1fr auto; gap: 8px 40px; min-height: 46vh; margin-bottom: 10vh; padding: 36px 40px; background: var(--panel); border: 1px solid var(--borde); box-shadow: 0 -20px 60px rgba(0, 0, 0, 0.5); }
    .paso-n { grid-row: 1 / 3; font-family: var(--fuente-titulo); font-weight: 700; font-size: clamp(5rem, 13vw, 11rem); line-height: 0.8; letter-spacing: -0.06em; color: transparent; -webkit-text-stroke: 2px var(--neon); }
    .paso h3 { font-family: var(--fuente-titulo); font-size: clamp(1.8rem, 4vw, 3.6rem); letter-spacing: -0.03em; line-height: 1; margin-bottom: 16px; }
    .paso p { margin: 0; max-width: 46ch; font-size: 1.1rem; line-height: 1.55; color: var(--gris); }
    .paso-pie { align-self: end; font-family: var(--mono); font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--neon); }
    .paso.ultimo { background: var(--rell); border-color: var(--rell); color: #fff; }
    .paso.ultimo p { color: rgba(255, 255, 255, 0.88); }
    .paso.ultimo .paso-pie { color: #fff; }
    .paso.ultimo .paso-n { -webkit-text-stroke-color: #fff; }

    /* Manifiesto */
    .manifiesto { position: relative; height: 320vh; }
    .man-pin { position: sticky; top: 0; height: 100svh; display: flex; flex-direction: column; justify-content: center; padding: 0 max(24px, 4vw); }
    .man-texto { margin: 0; font-family: var(--fuente-titulo); font-weight: 700; font-size: clamp(2.2rem, 6.2vw, 6rem); line-height: 1.02; letter-spacing: -0.035em; max-width: 24ch; }
    .pal { color: #2a3045; transition: color 220ms ease-out; }
    .pal.on { color: var(--papel); }

    /* Final */
    .final { text-align: left; padding-bottom: 140px; }
    .final-sub { font-size: 1.2rem; color: var(--gris); margin: 0 0 40px; }
    .ya-tengo { display: block; margin-top: 28px; width: max-content; font-family: var(--mono); font-size: 13px; color: var(--gris); text-decoration: none; }
    .ya-tengo:hover { color: var(--neon); }

    .pie { border-top: 1px solid var(--linea); padding: 32px max(24px, 4vw); }
    .pie-fila { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px 32px; }
    .pie p { margin: 0; font-size: 13px; color: var(--gris); max-width: 62ch; }

    /* Movimiento reducido: sin animaciones, estados finales visibles */
    .reducir .ln > span, .reducir .lead, .reducir .cta-fila, .reducir .term, .reducir .term-cuerpo .t { animation: none !important; opacity: 1; transform: none; }
    .reducir .barrido, .reducir .parpadeo, .reducir .marquee-pista, .reducir .ln em { animation: none !important; }
    .reducir .barrido { display: none; }
    .reducir .rv { opacity: 1; transform: none; transition: none; }

    @media (max-width: 960px) {
      .nav-links { display: none; }
      .hero-contenido { grid-template-columns: 1fr; gap: 36px; }
      .esc-pin { grid-template-columns: 1fr; gap: 12px; align-content: center; }
      .gran-num { font-size: clamp(5rem, 28vw, 9rem); }
      .esc-lista li { padding: 12px 0; }
      .chip { width: 36px; height: 36px; }
      .fila { grid-template-columns: 1fr; gap: 8px; padding: 26px 8px; }
      .pronto, .listo { justify-self: start; }
      .paso { grid-template-columns: 1fr; min-height: 40vh; padding: 28px 24px; }
      .paso-n { grid-row: auto; font-size: 4.5rem; }
      .revisamos, .pasos, .final { padding-top: 90px; }
    }
    @media (max-width: 560px) {
      .nav-acciones .btn-linea { display: none; }
      .enorme { height: 60px; padding: 0 24px; font-size: 15px; }
    }
  `,
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
