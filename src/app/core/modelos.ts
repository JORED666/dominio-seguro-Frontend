import { HttpErrorResponse } from '@angular/common/http';

export type Nivel = 'bueno' | 'mejoras' | 'critico';
export type Severidad = 'critica' | 'alta' | 'media' | 'baja' | 'info';

export const ETIQUETA_NIVEL: Record<Nivel, string> = {
  bueno: 'Bueno',
  mejoras: 'Necesita mejoras',
  critico: 'Crítico',
};

export interface Dominio {
  id: string;
  nombreDominio: string;
  ultimoPuntaje: number | null;
  nivel: Nivel | null;
  creadoEn: string;
}

export interface Hallazgo {
  id: string;
  categoria: string;
  severidad: Severidad;
  titulo: string;
  descripcion: string;
  recomendacion: string;
}

export interface Analisis {
  id: string;
  dominioId: string;
  fecha: string;
  puntaje: number;
  duracionMs: number;
  nivel: Nivel;
  hallazgos: Hallazgo[];
}

export interface Certificado {
  protocolo: string;
  autorizado: boolean;
  error: string | null;
  emisor: string;
  venceEn: string | null;
  diasRestantes: number | null;
}

export interface ResultadoAnalisis extends Analisis {
  certificado: Certificado | null;
  subdominios: string[];
}

// Extrae el mensaje de error que devuelve la API ({ "error": "..." })
export function mensajeError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'No se pudo conectar con el servidor. ¿Está encendida la API?';
    return err.error?.error ?? 'Ocurrió un error inesperado';
  }
  return 'Ocurrió un error inesperado';
}
