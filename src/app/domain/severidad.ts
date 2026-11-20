import { Severidad } from '../core/modelos';

// "ok" no es una severidad de la API: marca las buenas noticias (mejoras y problemas resueltos)
export type Sev = Severidad | 'ok';

export const ORDEN_SEVERIDAD: Record<Sev, number> = { critica: 0, alta: 1, media: 2, baja: 3, info: 4, ok: 5 };

export const ETIQUETA_SEVERIDAD: Record<Sev, string> = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
  info: 'Info',
  ok: 'Buena noticia',
};

export const esGrave = (s: Sev) => s === 'critica' || s === 'alta';
