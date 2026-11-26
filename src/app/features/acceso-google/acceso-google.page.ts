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
    // Cuenta con verificación en dos pasos: el servidor manda el token de verificación en el fragmento (#)
    const mfa = new URLSearchParams(location.hash.slice(1)).get('mfa');
    if (mfa) {
      sessionStorage.setItem('ds_mfa_pendiente', mfa);
      this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }
    this.auth.refrescar().subscribe({
      next: () => this.router.navigate(['/dominios'], { replaceUrl: true }),
      error: () => this.router.navigate(['/login'], { queryParams: { error: 'google' }, replaceUrl: true }),
    });
  }
}
