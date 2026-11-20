import { Analisis, Dominio, Nivel } from '../core/modelos';

// Cálculos del historial: registros, series del gráfico y tendencias. Sin Angular.

export const DIA_MS = 864e5;

// Colores para distinguir dominios en el gráfico (distintos de los de severidad)
const COLORES = ['#8e99f5', '#38bdf8', '#c084fc', '#f472b6', '#2dd4bf', '#fb923c', '#a3e635'];

// Un análisis de cualquiera de los dominios, listo para mostrarse
export interface Registro {
  id: string;
  dominioId: string;
  dominio: string;
  color: string;
  fecha: number; // milisegundos
  puntaje: number;
  nivel: Nivel;
  delta: number | null; // contra el análisis anterior del mismo dominio
  graves: number;
  porCorregir: number;
  duracionMs: number;
}

export interface Punto {
  reg: Registro;
  x: number; // 0 a 1000 (coordenadas del SVG)
  y: number; // 0 a 100
}

export interface Serie {
  dominioId: string;
  dominio: string;
  color: string;
  d: string; // línea suave
  area: string; // relleno bajo la línea
  puntos: Punto[];
}

// Cada dominio conserva siempre el mismo color, según su posición en la lista completa
export function coloresDe(dominios: Dominio[]): Map<string, string> {
  return new Map(dominios.map((d, i) => [d.id, COLORES[i % COLORES.length]]));
}

// Posición vertical (0 a 100) de un puntaje, con un poco de margen arriba y abajo
export const yDe = (v: number) => 96 - v * 0.92;

// Aplana el historial de todos los dominios en una lista de registros
export function registrosDe(dominios: Dominio[], historialDe: (id: string) => Analisis[]): Registro[] {
  const colores = coloresDe(dominios);
  const regs: Registro[] = [];
  for (const d of dominios.filter((x) => x.nivel)) {
    // El historial llega del más nuevo al más viejo: el "anterior" de cada uno es el siguiente
    const h = historialDe(d.id);
    h.forEach((a, j) => {
      const hall = a.hallazgos ?? [];
      regs.push({
        id: a.id,
        dominioId: d.id,
        dominio: d.nombreDominio,
        color: colores.get(d.id)!,
        fecha: new Date(a.fecha).getTime(),
        puntaje: a.puntaje,
        nivel: a.nivel,
        delta: h[j + 1] ? a.puntaje - h[j + 1].puntaje : null,
        graves: hall.filter((x) => x.severidad === 'critica' || x.severidad === 'alta').length,
        porCorregir: hall.filter((x) => x.severidad !== 'info').length,
        duracionMs: a.duracionMs,
      });
    });
  }
  return regs;
}

// Una serie (línea + relleno) por dominio; xDe convierte una fecha a coordenada del SVG
export function armarSeries(registros: Registro[], xDe: (t: number) => number): Serie[] {
  const por = new Map<string, Registro[]>();
  for (const r of registros) por.set(r.dominioId, [...(por.get(r.dominioId) ?? []), r]);
  return [...por.values()].map((lista) => {
    const ord = [...lista].sort((a, b) => a.fecha - b.fecha);
    const puntos = ord.map((reg) => ({ reg, x: xDe(reg.fecha), y: yDe(reg.puntaje) }));
    const d = curvaSuave(puntos);
    const base = yDe(0).toFixed(1);
    const area = d ? `${d} L${puntos[puntos.length - 1].x.toFixed(1)},${base} L${puntos[0].x.toFixed(1)},${base} Z` : '';
    return { dominioId: ord[0].dominioId, dominio: ord[0].dominio, color: ord[0].color, d, area, puntos };
  });
}

// Cambio promedio entre el primer y el último análisis de cada dominio en el periodo
export function cambioPromedio(series: Serie[]): number | null {
  const cambios = series
    .filter((s) => s.puntos.length > 1)
    .map((s) => s.puntos[s.puntos.length - 1].reg.puntaje - s.puntos[0].reg.puntaje);
  return cambios.length ? Math.round(cambios.reduce((a, b) => a + b, 0) / cambios.length) : null;
}

// "Hoy", "Ayer" o la fecha completa, para agrupar la lista por día
export function etiquetaDia(ms: number): string {
  const inicio = (t: number) => new Date(new Date(t).setHours(0, 0, 0, 0)).getTime();
  const diff = Math.round((inicio(Date.now()) - inicio(ms)) / DIA_MS);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  const mismoAnio = new Date(ms).getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', ...(mismoAnio ? {} : { year: 'numeric' }) }).format(ms);
}

// Curva suave que nunca se sale del rango de los datos (interpolación monótona)
export function curvaSuave(p: { x: number; y: number }[]): string {
  const n = p.length;
  if (n < 2) return '';
  const f = (v: number) => v.toFixed(1);
  if (n === 2) return `M${f(p[0].x)},${f(p[0].y)} L${f(p[1].x)},${f(p[1].y)}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = p[i + 1].x - p[i].x;
    m[i] = dx[i] === 0 ? 0 : (p[i + 1].y - p[i].y) / dx[i];
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
    } else {
      const a = t[i] / m[i];
      const b = t[i + 1] / m[i];
      const s = a * a + b * b;
      if (s > 9) {
        const tau = 3 / Math.sqrt(s);
        t[i] = tau * a * m[i];
        t[i + 1] = tau * b * m[i];
      }
    }
  }
  let d = `M${f(p[0].x)},${f(p[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    d += ` C${f(p[i].x + dx[i] / 3)},${f(p[i].y + (t[i] * dx[i]) / 3)} ${f(p[i + 1].x - dx[i] / 3)},${f(p[i + 1].y - (t[i + 1] * dx[i]) / 3)} ${f(p[i + 1].x)},${f(p[i + 1].y)}`;
  }
  return d;
}
