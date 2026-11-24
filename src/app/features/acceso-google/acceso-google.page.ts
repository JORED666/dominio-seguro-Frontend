import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

// Google regresa aquí tras iniciar sesión: el servidor ya dejó la cookie de sesión,
// así que se pide el token de acceso con /auth/refresh y se entra al panel
@Component({
  selector: 'app-acceso-google',
  template: '<p style="padding:2rem;text-align:center">Iniciando sesión con Google…</p>',
})
export class AccesoGoogle implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  ngOnInit() {
    this.auth.refrescar().subscribe({
      next: () => this.router.navigate(['/dominios'], { replaceUrl: true }),
      error: () => this.router.navigate(['/login'], { queryParams: { error: 'google' }, replaceUrl: true }),
    });
  }
}
