import { Component, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { Marca } from './shared/ui/marca/marca';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Marca],
  templateUrl: './app.html',
})
export class App {
  protected auth = inject(AuthService);
  protected menuAbierto = signal(false);

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
