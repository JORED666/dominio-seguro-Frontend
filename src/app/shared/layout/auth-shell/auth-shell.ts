import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// Marco común de las pantallas de acceso (login y registro):
// marco redondeado, fondo con líneas decorativas y contenido centrado.
@Component({
  selector: 'app-auth-shell',
  imports: [RouterLink],
  templateUrl: './auth-shell.html',
  styleUrl: './auth-shell.css',
})
export class AuthShell {}
