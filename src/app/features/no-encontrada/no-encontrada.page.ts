import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-no-encontrada',
  imports: [RouterLink],
  templateUrl: './no-encontrada.page.html',
  styleUrl: './no-encontrada.page.css',
})
export class NoEncontrada {
  protected auth = inject(AuthService);
}
