import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { mensajeError } from '../../core/modelos';
import { AuthShell } from '../../shared/auth-shell/auth-shell';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, AuthShell],
  template: `
    <app-auth-shell>
      <section class="tarjeta-auth">
        <h1>Qué gusto verte de nuevo</h1>
        <p class="subtitulo">Entra a tu cuenta para ver cómo están tus dominios</p>

        @if (error()) {
          <div class="alerta" role="alert">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" stroke-linecap="round" />
            </svg>
            <div>
              <strong>{{ error() }}</strong>
              <span>Revisa tus datos e inténtalo de nuevo.</span>
            </div>
          </div>
        }

        <form (ngSubmit)="entrar()">
          <label>
            Correo electrónico
            <input
              class="campo"
              type="email"
              name="correo"
              [(ngModel)]="correo"
              placeholder="tucorreo@ejemplo.com"
              autocomplete="username"
              required
            />
          </label>

          <label>
            Contraseña
            <span class="con-icono">
              <input
                class="campo"
                [type]="verPassword() ? 'text' : 'password'"
                name="password"
                [(ngModel)]="password"
                placeholder="Tu contraseña"
                autocomplete="current-password"
                required
              />
              <button
                type="button"
                class="ojo"
                (click)="verPassword.set(!verPassword())"
                [attr.aria-label]="verPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                  @if (verPassword()) { <path d="M3 3l18 18" stroke-linecap="round" /> }
                </svg>
              </button>
            </span>
          </label>

          <button type="button" class="olvide" disabled title="Próximamente">
            ¿Olvidaste tu contraseña?
          </button>

          <button class="boton" type="submit" [disabled]="cargando()">
            {{ cargando() ? 'Entrando…' : 'Iniciar sesión' }}
          </button>
        </form>

        <div class="separador"><span>o</span></div>

        <button type="button" class="google" disabled title="Próximamente">
          <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          Iniciar sesión con Google
          <small>Próximamente</small>
        </button>

        <p class="pie-auth">¿Aún no tienes cuenta? <a routerLink="/registro">Crea una</a></p>
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
    .alerta span { display: block; font-size: 13px; color: #f1b5b5; }

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

    .olvide {
      align-self: flex-end; margin-top: -8px;
      background: none; border: 0; padding: 0;
      color: var(--acento-claro); font: inherit; font-size: 13px; font-weight: 600;
    }
    .olvide:disabled { opacity: 0.7; cursor: not-allowed; }

    .boton {
      height: 52px; border: 0; border-radius: 999px; cursor: pointer;
      background: var(--acento); color: #fff;
      font: inherit; font-size: 16px; font-weight: 600;
      box-shadow: 0 8px 24px rgba(91, 108, 248, 0.4);
    }
    .boton:hover:not(:disabled) { filter: brightness(1.08); }
    .boton:disabled { opacity: 0.6; cursor: not-allowed; }

    .separador { display: flex; align-items: center; gap: 14px; margin: 22px 0 18px; color: var(--suave); font-size: 13px; }
    .separador::before, .separador::after { content: ''; flex: 1; height: 1px; background: var(--borde); }

    .google {
      width: 100%; height: 48px;
      display: flex; align-items: center; justify-content: center; gap: 10px;
      background: transparent; color: var(--texto);
      border: 1px solid var(--borde); border-radius: 999px;
      font: inherit; font-size: 15px; font-weight: 500;
    }
    .google small {
      padding: 2px 8px; border-radius: 999px;
      background: var(--borde); color: var(--suave); font-size: 11px;
    }
    .google:disabled { cursor: not-allowed; opacity: 0.85; }

    .pie-auth { text-align: center; color: var(--suave); font-size: 14px; margin: 24px 0 0; }
    .pie-auth a { color: var(--acento-claro); font-weight: 600; text-decoration: none; }

    @media (max-width: 600px) { .tarjeta-auth { padding: 32px 22px 28px; border-radius: 22px; } h1 { font-size: 1.7rem; } }
  `,
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);

  correo = '';
  password = '';
  cargando = signal(false);
  error = signal('');
  verPassword = signal(false);

  entrar() {
    if (!this.correo || !this.password) {
      this.error.set('Escribe tu correo y contraseña');
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    this.auth.login(this.correo, this.password).subscribe({
      next: () => this.router.navigate(['/dominios']),
      error: (e) => {
        this.error.set(mensajeError(e));
        this.cargando.set(false);
      },
    });
  }
}
