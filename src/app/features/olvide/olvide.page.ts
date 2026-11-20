import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { mensajeError } from '../../core/modelos';
import { AuthShell } from '../../shared/layout/auth-shell/auth-shell';

@Component({
  selector: 'app-olvide',
  imports: [FormsModule, RouterLink, AuthShell],
  templateUrl: './olvide.page.html',
  styleUrls: ['../login/login.page.css', './olvide.page.css'],
})
export class Olvide {
  private auth = inject(AuthService);

  correo = '';
  cargando = signal(false);
  error = signal('');
  enviado = signal(false);

  enviar() {
    if (!this.correo) {
      this.error.set('Escribe tu correo');
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    this.auth.olvide(this.correo).subscribe({
      next: () => {
        this.enviado.set(true);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeError(e));
        this.cargando.set(false);
      },
    });
  }
}
