// Dominios parecidos al tuyo (typosquatting). Sin Angular.
// El servidor los calcula consultando DNS; aquí solo se etiquetan y se muestran.
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
  libre: 'Sin registros',
};

export const ETIQUETA_RIESGO: Record<RiesgoSimilar, string> = { alto: 'Riesgo alto', medio: 'Riesgo medio', bajo: 'Riesgo bajo' };
export const ORDEN_RIESGO: Record<RiesgoSimilar, number> = { alto: 0, medio: 1, bajo: 2 };

// Forma en que responde el servidor
export interface SimilarApi {
  id: string;
  dominioId: string;
  nombre: string;
  tecnica: Tecnica;
  estado: EstadoSimilar;
  riesgo: RiesgoSimilar;
  conCorreo: boolean; // tiene registros MX: podría enviar correos haciéndose pasar por ti
  conCertificado: boolean;
  propio: boolean; // el usuario dijo que es suyo
  revisado: boolean;
  detectadoEn: string | null; // null: nunca ha tenido registros
  verificadoEn: string | null;
}

export interface Similar {
  id: string;
  dominioId: string;
  original: string; // dominio que se protege
  nombre: string; // dominio parecido
  tecnica: Tecnica;
  estado: EstadoSimilar;
  riesgo: RiesgoSimilar;
  conCorreo: boolean;
  conCertificado: boolean;
  propio: boolean;
  revisado: boolean;
  detectadoEn: number | null; // ms
}

export function aSimilar(s: SimilarApi, original: string): Similar {
  return {
    id: s.id,
    dominioId: s.dominioId,
    original,
    nombre: s.nombre,
    tecnica: s.tecnica,
    estado: s.estado,
    riesgo: s.riesgo,
    conCorreo: s.conCorreo,
    conCertificado: s.conCertificado,
    propio: s.propio,
    revisado: s.revisado,
    detectadoEn: s.detectadoEn ? Date.parse(s.detectadoEn) : null,
  };
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
