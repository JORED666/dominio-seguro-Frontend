import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { mensajeError } from '../../core/modelos';
import { AlertasStore } from '../../data/alertas.store';
import { DominiosStore } from '../../data/dominios.store';
import { AlertaCard } from './componentes/alerta-card/alerta-card';
import { Alerta } from '../../domain/alertas';
import { ORDEN_SEVERIDAD, Sev, esGrave } from '../../domain/severidad';
import { crearAnimacion } from '../../shared/utils/animacion';

type Filtro = 'todas' | 'graves' | 'nuevas' | 'buenas';

@Component({
  selector: 'app-alertas',
  imports: [RouterLink, AlertaCard],
  templateUrl: './alertas.page.html',
  styleUrl: './alertas.page.css',
})
export class Alertas {
  private store = inject(DominiosStore);
  private alertasStore = inject(AlertasStore);

  filtros: { valor: Filtro; texto: string }[] = [
    { valor: 'todas', texto: 'Todas' },
    { valor: 'graves', texto: 'Graves' },
    { valor: 'nuevas', texto: 'Nuevas' },
    { valor: 'buenas', texto: 'Buenas noticias' },
  ];

  cargando = signal(true);
  error = signal('');
  leyenda = signal<{ id: string; nombre: string }[]>([]);
  alertas = this.alertasStore.todas;

  filtro = signal<Filtro>('todas');
  dominioSel = signal('');
  descartadas = this.alertasStore.descartadas;
  verDescartadas = signal(false);

  // Animación de entrada de los números
  private anim = crearAnimacion(900);
  k = this.anim.k;

  // Alertas del dominio elegido, separando activas y descartadas
  private delDominio = computed(() => {
    const d = this.dominioSel();
    return this.alertas().filter((a) => !d || a.dominioId === d);
  });

  private visibles = computed(() => {
    const desc = this.descartadas();
    const ver = this.verDescartadas();
    return this.delDominio().filter((a) => desc.includes(a.id) === ver);
  });

  cuentas = computed(() => {
    const l = this.delDominio().filter((a) => !this.descartadas().includes(a.id));
    const activas = l.filter((a) => a.sev !== 'ok');
    return {
      activas: activas.length,
      graves: activas.filter((a) => esGrave(a.sev)).length,
      nuevas: activas.filter((a) => a.nueva).length,
      buenas: l.filter((a) => a.sev === 'ok').length,
    };
  });

  private coincide(a: Alerta, f: Filtro): boolean {
    return f === 'todas' || (f === 'graves' && (esGrave(a.sev))) || (f === 'nuevas' && a.nueva && a.sev !== 'ok') || (f === 'buenas' && a.sev === 'ok');
  }

  cuentaFiltro(f: Filtro): number {
    return this.visibles().filter((a) => this.coincide(a, f)).length;
  }

  secciones = computed(() => {
    const f = this.filtro();
    const lista = this.visibles()
      .filter((a) => this.coincide(a, f))
      .sort((a, b) => ORDEN_SEVERIDAD[a.sev] - ORDEN_SEVERIDAD[b.sev] || b.desde - a.desde);
    const defs: { titulo: string; descripcion: string; sevs: Sev[] }[] = [
      { titulo: 'Requieren acción', descripcion: 'Problemas graves que conviene resolver cuanto antes.', sevs: ['critica', 'alta'] },
      { titulo: 'Conviene revisar', descripcion: 'No son urgentes, pero reducen tu puntaje.', sevs: ['media', 'baja'] },
      { titulo: 'Buenas noticias', descripcion: 'Mejoras y problemas que ya quedaron resueltos.', sevs: ['ok'] },
    ];
    return defs
      .map((d) => ({ titulo: d.titulo, descripcion: d.descripcion, items: lista.filter((a) => d.sevs.includes(a.sev)) }))
      .filter((s) => s.items.length > 0);
  });

  constructor() {
    this.cargar();
  }

  n(v: number): number {
    return this.anim.n(v);
  }

  descartar(id: string) {
    this.alertasStore.descartar(id);
  }

  restaurar(id: string) {
    this.alertasStore.restaurar(id);
    if (!this.descartadas().length) this.verDescartadas.set(false);
  }

  private cargar() {
    this.store.cargarLista().subscribe({
      next: (lista) => {
        this.leyenda.set(lista.map((d) => ({ id: d.id, nombre: d.nombreDominio })));
        this.store.cargarHistoriales(lista).subscribe(() => {
          this.cargando.set(false);
          this.anim.iniciar();
        });
      },
      error: (e) => {
        this.error.set(mensajeError(e));
        this.cargando.set(false);
      },
    });
  }
}
