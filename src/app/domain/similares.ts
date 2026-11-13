import { Dominio } from '../core/modelos';

// Dominios parecidos al tuyo (typosquatting). Sin Angular.
// IMPORTANTE: por ahora los estados son SIMULADOS. El backend aún no consulta DNS/WHOIS;
// cuando exista, bastará con que entregue objetos "Similar" y esta pantalla no cambia.
export const DATOS_DE_EJEMPLO = true;

export type Tecnica = 'omision' | 'repeticion' | 'intercambio' | 'homoglifo' | 'guion' | 'tld';
export type EstadoSimilar = 'activo' | 'registrado' | 'libre';
export type RiesgoSimilar = 'alto' | 'medio' | 'bajo';

export const ETIQUETA_TECNICA: Record<Tecnica, string> = {
  omision: 'Letra omitida',
  repeticion: 'Letra repetida',
  intercambio: 'Letras intercambiadas',
  homoglifo: 'Carácter parecido',
  guion: 'Guion agregado',
  tld: 'Otra terminación',
};

export const ETIQUETA_ESTADO: Record<EstadoSimilar, string> = {
  activo: 'Registrado y en uso',
  registrado: 'Registrado sin web',
  libre: 'Disponible',
};

export const ETIQUETA_RIESGO: Record<RiesgoSimilar, string> = { alto: 'Riesgo alto', medio: 'Riesgo medio', bajo: 'Riesgo bajo' };
export const ORDEN_RIESGO: Record<RiesgoSimilar, number> = { alto: 0, medio: 1, bajo: 2 };

export interface Similar {
  id: string;
  dominioId: string;
  original: string; // dominio que se protege
  nombre: string; // dominio parecido
  tecnica: Tecnica;
  estado: EstadoSimilar;
  riesgo: RiesgoSimilar;
  conCorreo: boolean; // tiene registros MX: podría enviar correos haciéndose pasar por ti
  conCertificado: boolean;
  detectadoEn: number; // ms
}

const HOMOGLIFOS: Record<string, string> = { o: '0', l: '1', i: 'l', a: '4', e: '3', m: 'rn', w: 'vv' };
const TLDS = ['com', 'net', 'org', 'mx', 'com.mx'];
const DIA = 864e5;

// Hash estable: el mismo dominio siempre produce los mismos resultados simulados
function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Variantes típicas que usan los suplantadores, a partir del nombre de un dominio
export function variantesDe(dominio: string): { nombre: string; tecnica: Tecnica }[] {
  const punto = dominio.indexOf('.');
  if (punto < 2) return [];
  const etiqueta = dominio.slice(0, punto);
  const tld = dominio.slice(punto + 1);
  const out: { nombre: string; tecnica: Tecnica }[] = [];
  const agrega = (e: string, t: string, tecnica: Tecnica) => {
    const nombre = `${e}.${t}`;
    if (nombre !== dominio && !out.some((v) => v.nombre === nombre)) out.push({ nombre, tecnica });
  };

  if (etiqueta.length > 3) agrega(etiqueta.slice(0, -2) + etiqueta.slice(-1), tld, 'omision');
  if (etiqueta.length > 3) agrega(etiqueta.slice(0, 1) + etiqueta.slice(2), tld, 'omision');
  agrega(etiqueta.slice(0, 2) + etiqueta[1] + etiqueta.slice(2), tld, 'repeticion');
  if (etiqueta.length > 2) agrega(etiqueta[0] + etiqueta[2] + etiqueta[1] + etiqueta.slice(3), tld, 'intercambio');
  for (let i = 0; i < etiqueta.length; i++) {
    const sust = HOMOGLIFOS[etiqueta[i]];
    if (sust) {
      agrega(etiqueta.slice(0, i) + sust + etiqueta.slice(i + 1), tld, 'homoglifo');
      break;
    }
  }
  if (etiqueta.length > 4) agrega(etiqueta.slice(0, Math.ceil(etiqueta.length / 2)) + '-' + etiqueta.slice(Math.ceil(etiqueta.length / 2)), tld, 'guion');
  for (const t of TLDS) if (t !== tld) agrega(etiqueta, t, 'tld');
  return out.slice(0, 7);
}

// Estado y riesgo simulados, estables por dominio
export function simularSimilares(dominios: Dominio[], ahora = Date.now()): Similar[] {
  const lista: Similar[] = [];
  for (const d of dominios) {
    for (const v of variantesDe(d.nombreDominio)) {
      const h = hash(v.nombre);
      const r = h % 10;
      const estado: EstadoSimilar = r < 3 ? 'libre' : r < 6 ? 'registrado' : 'activo';
      const conCorreo = estado === 'activo' && h % 3 !== 0;
      const riesgo: RiesgoSimilar = estado === 'activo' ? (conCorreo || v.tecnica === 'homoglifo' ? 'alto' : 'medio') : estado === 'registrado' ? 'medio' : 'bajo';
      lista.push({
        id: `${d.id}|${v.nombre}`,
        dominioId: d.id,
        original: d.nombreDominio,
        nombre: v.nombre,
        tecnica: v.tecnica,
        estado,
        riesgo,
        conCorreo,
        conCertificado: estado === 'activo' && h % 4 !== 0,
        detectadoEn: ahora - ((h >>> 8) % 20) * DIA - (h % 12) * 36e5,
      });
    }
  }
  return lista;
}

// Divide el dominio parecido en tramos para resaltar lo que cambió respecto al original
export function tramosDe(original: string, similar: string): { texto: string; cambio: boolean }[] {
  let i = 0;
  while (i < original.length && i < similar.length && original[i] === similar[i]) i++;
  let j = 0;
  while (j < original.length - i && j < similar.length - i && original[original.length - 1 - j] === similar[similar.length - 1 - j]) j++;
  const medio = similar.slice(i, similar.length - j);
  // Si falta una letra, no hay nada que resaltar en medio: se marcan las dos letras entre las que faltaba
  const hueco = medio === '' && i > 0 && j > 0;
  const tramos = hueco
    ? [
        { texto: similar.slice(0, i - 1), cambio: false },
        { texto: similar.slice(i - 1, i), cambio: true },
        { texto: similar.slice(i, i + 1), cambio: true },
        { texto: similar.slice(i + 1), cambio: false },
      ]
    : [
        { texto: similar.slice(0, i), cambio: false },
        { texto: medio, cambio: true },
        { texto: similar.slice(similar.length - j), cambio: false },
      ];
  return tramos.filter((t) => t.texto);
}
