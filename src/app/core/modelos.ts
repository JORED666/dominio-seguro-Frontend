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
  verificadoEn: string | null; // null: aún no demuestra que el dominio es suyo
}

// Registro DNS que el usuario debe publicar para demostrar que el dominio es suyo
export interface Verificacion {
  verificado: boolean;
  verificadoEn: string | null;
  registro: { tipo: string; nombre: string; valor: string };
}

export interface Hallazgo {
  id: string;
  categoria: string;
  severidad: Severidad;
  titulo: string;
  descripcion: string;
  recomendacion: string;
}

// Puntaje de una categoría (null = todavía sin evaluar)
export interface CategoriaPuntaje {
  id: string;
  nombre: string;
  peso: number;
  puntaje: number | null;
}

export interface Analisis {
  id: string;
  dominioId: string;
  fecha: string;
  puntaje: number;
  duracionMs: number;
  nivel: Nivel;
  categorias?: CategoriaPuntaje[] | null;
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
  reputacion?: { riesgo: number; nivel: string; asn: string | null } | null;
  exposicion?: { puertos: number[]; vulnerabilidades: string[] } | null;
}

// Extrae el mensaje de error que devuelve la API ({ "error": "..." })
export function mensajeError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'No se pudo conectar con el servidor. ¿Está encendida la API?';
    return err.error?.error ?? 'Ocurrió un error inesperado';
  }
  return 'Ocurrió un error inesperado';
}
