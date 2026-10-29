import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { mensajeError } from '../../core/modelos';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="tarjeta auth">
      <h1>Iniciar sesión</h1>
      <p class="sub">Accede para monitorear la seguridad de tus dominios.</p>

      <form (ngSubmit)="entrar()">
        <label>
          Correo electrónico
          <input type="email" name="correo" [(ngModel)]="correo" required autocomplete="username" />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            name="password"
            [(ngModel)]="password"
            required
            autocomplete="current-password"
          />
        </label>

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }

        <button class="btn" type="submit" [disabled]="cargando()">
          {{ cargando() ? 'Entrando…' : 'Iniciar sesión' }}
        </button>
      </form>

      <p class="pie">¿No tienes cuenta? <a routerLink="/registro">Crear cuenta</a></p>
    </section>
  `,
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);

  correo = '';
  password = '';
  cargando = signal(false);
  error = signal('');

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
