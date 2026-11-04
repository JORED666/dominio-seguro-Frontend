import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { mensajeError } from '../../core/modelos';
import { AuthShell } from '../../shared/auth-shell/auth-shell';

@Component({
  selector: 'app-registro',
  imports: [FormsModule, RouterLink, AuthShell],
  template: `
    <app-auth-shell>
      <section class="tarjeta-auth">
        <h1>Crea tu cuenta</h1>
        <p class="subtitulo">Empieza a vigilar la seguridad de tus dominios</p>

        @if (error()) {
          <div class="alerta" role="alert">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" stroke-linecap="round" />
            </svg>
            <div><strong>{{ error() }}</strong></div>
          </div>
        }

        <form (ngSubmit)="registrar()">
          <label>
            Nombre
            <input class="campo" type="text" name="nombre" [(ngModel)]="nombre"
              placeholder="Tu nombre" autocomplete="name" required />
          </label>

          <label>
            Correo electrónico
            <input class="campo" type="email" name="correo" [(ngModel)]="correo"
              placeholder="tucorreo@ejemplo.com" autocomplete="username" required />
          </label>

          <label>
            Contraseña
            <span class="con-icono">
              <input class="campo" [type]="verPassword() ? 'text' : 'password'" name="password"
                [(ngModel)]="password" placeholder="Crea una contraseña segura"
                autocomplete="new-password" required />
              <button type="button" class="ojo" (click)="verPassword.set(!verPassword())"
                [attr.aria-label]="verPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                  @if (verPassword()) { <path d="M3 3l18 18" stroke-linecap="round" /> }
                </svg>
              </button>
            </span>
          </label>

          <ul class="requisitos">
            @for (r of reglas; track r.texto) {
              <li [class.cumple]="r.ok">{{ r.ok ? '✓' : '○' }} {{ r.texto }}</li>
            }
          </ul>

          <button class="boton" type="submit" [disabled]="cargando() || !valido">
            {{ cargando() ? 'Creando…' : 'Crear cuenta' }}
          </button>
        </form>

        <p class="pie-auth">¿Ya tienes cuenta? <a routerLink="/login">Inicia sesión</a></p>
      </section>
    </app-auth-shell>
  `,
  styles: `
    .tarjeta-auth {
      width: 100%;
      max-width: 530px;
      padding: 44px 48px 36px;
      background: var(--tarjeta);
      border: 1px solid var(--borde);
      border-radius: 28px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
    }
    h1 { text-align: center; font-size: 2.1rem; line-height: 1.15; margin: 0 0 10px; }
    .subtitulo { text-align: center; color: var(--suave); margin: 0 0 24px; }

    .alerta {
      display: flex; gap: 12px; align-items: flex-start;
      padding: 14px 16px; margin-bottom: 20px;
      border: 1px solid var(--rojo); border-radius: 14px;
      background: rgba(239, 68, 68, 0.1); color: #ff7b7b;
    }
    .alerta svg { flex: none; margin-top: 1px; }
    .alerta strong { display: block; font-size: 15px; }

    form { display: flex; flex-direction: column; gap: 18px; }
    label { color: var(--texto); font-weight: 600; font-size: 15px; gap: 8px; }

    .campo {
      width: 100%; height: 48px; padding: 0 20px;
      background: #384250; color: var(--texto);
      border: 1px solid transparent; border-radius: 999px;
      font-size: 15px; font-weight: 400;
    }
    .campo::placeholder { color: #b4bdca; }
    .campo:focus { outline: 3px solid rgba(91, 108, 248, 0.55); outline-offset: 1px; }

    .con-icono { position: relative; display: block; }
    .con-icono .campo { padding-right: 52px; }
    .ojo {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
      width: 36px; height: 36px; display: grid; place-items: center;
      background: transparent; border: 0; border-radius: 50%;
      color: #b4bdca; cursor: pointer;
    }
    .ojo:hover { background: rgba(255, 255, 255, 0.08); }

    .requisitos {
      display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px;
      margin: -4px 0 0; padding: 0 4px; list-style: none;
      color: var(--suave); font-size: 13px;
    }
    .requisitos li.cumple { color: var(--verde); }

    .boton {
      height: 52px; border: 0; border-radius: 999px; cursor: pointer;
      background: var(--acento); color: #fff;
      font: inherit; font-size: 16px; font-weight: 600;
      box-shadow: 0 8px 24px rgba(91, 108, 248, 0.4);
    }
    .boton:hover:not(:disabled) { filter: brightness(1.08); }
    .boton:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }

    .pie-auth { text-align: center; color: var(--suave); font-size: 14px; margin: 24px 0 0; }
    .pie-auth a { color: var(--acento-claro); font-weight: 600; text-decoration: none; }

    @media (max-width: 600px) {
      .tarjeta-auth { padding: 32px 22px 28px; border-radius: 22px; }
      h1 { font-size: 1.7rem; }
      .requisitos { grid-template-columns: 1fr; }
    }
  `,
})
export class Registro {
  private auth = inject(AuthService);
  private router = inject(Router);

  nombre = '';
  correo = '';
  password = '';
  cargando = signal(false);
  error = signal('');
  verPassword = signal(false);

  get reglas() {
    const p = this.password;
    return [
      { texto: 'Al menos 12 caracteres', ok: p.length >= 12 },
      { texto: 'Una letra mayúscula', ok: /[A-Z]/.test(p) },
      { texto: 'Un número', ok: /\d/.test(p) },
      { texto: 'Un símbolo', ok: /[^A-Za-z0-9]/.test(p) },
    ];
  }

  get valido() {
    return this.nombre.trim().length >= 2 && this.correo.includes('@') && this.reglas.every((r) => r.ok);
  }

  registrar() {
    if (!this.valido) return;
    this.cargando.set(true);
    this.error.set('');
    this.auth.registro(this.nombre.trim(), this.correo, this.password).subscribe({
      next: () => this.router.navigate(['/dominios']),
      error: (e) => {
        this.error.set(mensajeError(e));
        this.cargando.set(false);
      },
    });
  }
}
