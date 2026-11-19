import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { mensajeError } from '../../core/modelos';
import { AuthShell } from '../../shared/layout/auth-shell/auth-shell';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, AuthShell],
  templateUrl: './login.page.html',
  styleUrl: './login.page.css',
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);

  correo = '';
  password = '';
  cargando = signal(false);
  error = signal('');
  verPassword = signal(false);
  mfaToken = signal<string | null>(null);
  codigo = '';

  entrar() {
    if (!this.correo || !this.password) {
      this.error.set('Escribe tu correo y contraseña');
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    this.auth.login(this.correo, this.password).subscribe({
      next: (r) => {
        if ('mfaRequerido' in r) {
          this.mfaToken.set(r.mfaToken);
          this.cargando.set(false);
        } else {
          this.router.navigate(['/dominios']);
        }
      },
      error: (e) => {
        this.error.set(mensajeError(e));
        this.cargando.set(false);
      },
    });
  }

  verificar() {
    const token = this.mfaToken();
    if (!token || !/^\d{6}$/.test(this.codigo)) {
      this.error.set('El código tiene 6 dígitos');
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    this.auth.verificarMfa(token, this.codigo).subscribe({
      next: () => this.router.navigate(['/dominios']),
      error: (e) => {
        this.error.set(mensajeError(e));
        this.cargando.set(false);
      },
    });
  }

  volver() {
    this.mfaToken.set(null);
    this.codigo = '';
    this.error.set('');
  }
}
