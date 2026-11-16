// Parte un texto en trozos para mostrar los enlaces https como enlaces (sin usar innerHTML)
export interface Trozo {
  texto: string;
  enlace: boolean;
}

const URL_HTTPS = /https:\/\/[^\s<>"']+/g;

export function trozosConEnlaces(texto: string): Trozo[] {
  const trozos: Trozo[] = [];
  let desde = 0;
  for (const m of texto.matchAll(URL_HTTPS)) {
    // sin el signo que cierra la frase (punto, coma...)
    const url = m[0].replace(/[.,;:)]+$/, '');
    const i = m.index ?? 0;
    if (i > desde) trozos.push({ texto: texto.slice(desde, i), enlace: false });
    trozos.push({ texto: url, enlace: true });
    desde = i + url.length;
  }
  if (desde < texto.length) trozos.push({ texto: texto.slice(desde), enlace: false });
  return trozos;
}
