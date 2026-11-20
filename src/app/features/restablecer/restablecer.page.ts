import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { mensajeError } from '../../core/modelos';
import { AuthShell } from '../../shared/layout/auth-shell/auth-shell';

@Component({
  selector: 'app-restablecer',
  imports: [FormsModule, RouterLink, AuthShell],
  templateUrl: './restablecer.page.html',
  styleUrls: ['../login/login.page.css', '../olvide/olvide.page.css'],
})
export class Restablecer {
  private auth = inject(AuthService);
  private token: string;

  password = '';
  confirmar = '';
  cargando = signal(false);
  error = signal('');
  verPassword = signal(false);
  listo = signal(false);
  sinEnlace: boolean;

  constructor() {
    const router = inject(Router);
    this.token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';
    this.sinEnlace = this.token === '';
    // El token ya está en memoria: se quita de la barra de direcciones para que no quede en el historial
    router.navigate([], { replaceUrl: true });
  }

  cambiar() {
    if (this.password.length < 12) {
      this.error.set('La contraseña debe tener al menos 12 caracteres');
      return;
    }
    if (this.password !== this.confirmar) {
      this.error.set('Las contraseñas no coinciden');
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    this.auth.restablecer(this.token, this.password).subscribe({
      next: () => {
        this.listo.set(true);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeError(e));
        this.cargando.set(false);
      },
    });
  }
}
