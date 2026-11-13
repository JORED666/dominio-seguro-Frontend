import { Component, HostListener, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { DominiosStore } from './data/dominios.store';
import { CampanaAlertas } from './shared/layout/campana-alertas/campana-alertas';
import { Marca } from './shared/ui/marca/marca';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Marca, CampanaAlertas],
  templateUrl: './app.html',
})
export class App {
  protected auth = inject(AuthService);
  private datos = inject(DominiosStore);
  protected menuAbierto = signal(false);

  constructor() {
    // Al iniciar sesión se cargan los dominios y su historial: de ahí sale la campana de alertas
    effect(() => {
      if (this.auth.autenticado()) untracked(() => this.datos.cargarTodo().subscribe({ error: () => undefined }));
    });
  }

  protected alternarMenu(e: Event) {
    e.stopPropagation();
    this.menuAbierto.update((v) => !v);
  }

  // Se cierra al hacer clic en cualquier otro lado o con Escape
  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  protected cerrarMenu() {
    this.menuAbierto.set(false);
  }
}
