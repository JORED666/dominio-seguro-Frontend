import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { mensajeError } from '../../core/modelos';

@Component({
  selector: 'app-registro',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="tarjeta auth">
      <h1>Crear cuenta</h1>
      <p class="sub">Registra tu cuenta para empezar a vigilar tus dominios.</p>

      <form (ngSubmit)="registrar()">
        <label>
          Nombre
          <input type="text" name="nombre" [(ngModel)]="nombre" required autocomplete="name" />
        </label>
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
            autocomplete="new-password"
          />
        </label>

        <ul class="requisitos">
          @for (r of reglas; track r.texto) {
            <li [class.cumple]="r.ok">{{ r.ok ? '✓' : '○' }} {{ r.texto }}</li>
          }
        </ul>

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }

        <button class="btn" type="submit" [disabled]="cargando() || !valido">
          {{ cargando() ? 'Creando…' : 'Crear cuenta' }}
        </button>
      </form>

      <p class="pie">¿Ya tienes cuenta? <a routerLink="/login">Inicia sesión</a></p>
    </section>
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
