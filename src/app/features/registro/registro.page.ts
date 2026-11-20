import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { mensajeError } from '../../core/modelos';
import { AuthShell } from '../../shared/layout/auth-shell/auth-shell';

@Component({
  selector: 'app-registro',
  imports: [FormsModule, RouterLink, AuthShell],
  templateUrl: './registro.page.html',
  styleUrl: './registro.page.css',
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
