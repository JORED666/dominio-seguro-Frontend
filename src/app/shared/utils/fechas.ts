// Formato de fechas en español de México (el DatePipe de Angular está en inglés)

const aMs = (f: string | number | Date) => new Date(f).getTime();

export function fechaCorta(f: string | number | Date): string {
  return new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

// "hace 3 días", "hace 2 horas", "ayer"
export function hace(f: string | number | Date): string {
  const s = Math.max(0, (Date.now() - aMs(f)) / 1000);
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  if (s < 3600) return rtf.format(-Math.max(1, Math.round(s / 60)), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  return rtf.format(-Math.round(s / 86400), 'day');
}
