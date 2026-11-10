// Lectura y escritura segura de listas en localStorage (puede no existir o estar bloqueado)

export function leerLista(clave: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(clave) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function guardarLista(clave: string, lista: string[]): void {
  try {
    localStorage.setItem(clave, JSON.stringify(lista));
  } catch {
    /* sin almacenamiento: el cambio dura solo mientras la página siga abierta */
  }
}
