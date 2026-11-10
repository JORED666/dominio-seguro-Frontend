import { Analisis, Dominio, Hallazgo } from '../core/modelos';
import { Sev } from './severidad';

// Reglas de negocio de las alertas: sin Angular, solo datos de entrada y salida.

export type TipoAlerta = 'hallazgo' | 'caida' | 'mejora' | 'resuelto' | 'inactivo' | 'sin-analisis';

export interface Alerta {
  id: string;
  tipo: TipoAlerta;
  sev: Sev;
  dominioId: string;
  dominio: string;
  enlace: string[];
  titulo: string;
  detalle: string;
  recomendacion: string;
  categoria: string;
  desde: number; // desde cuándo se conoce (ms)
  nueva: boolean; // apareció en el análisis más reciente
}

const DIA = 864e5; // milisegundos en un día
const DIAS_SIN_ANALISIS = 7;
const CAMBIO_RELEVANTE = 10;

const relevantes = (a: Analisis): Hallazgo[] => (a.hallazgos ?? []).filter((x) => x.severidad !== 'info');
const clave = (x: Hallazgo) => x.categoria + '|' + x.titulo;

// Convierte el historial de un dominio en las alertas que merece
export function construirAlertas(d: Dominio, h: Analisis[]): Alerta[] {
  const base = { dominioId: d.id, dominio: d.nombreDominio, enlace: ['/dominios', d.id] };
  if (!h.length) {
    return [
      {
        ...base,
        enlace: ['/dominios'],
        id: `${d.id}|sin-analisis`,
        tipo: 'sin-analisis',
        sev: 'baja',
        titulo: 'Todavía no analizas este dominio',
        detalle: 'Sin un primer análisis no sabemos si su certificado, su reputación o sus puertos tienen problemas.',
        recomendacion: 'En Mis dominios pulsa «Primer análisis» en este dominio.',
        categoria: 'Pendiente',
        desde: new Date(d.creadoEn).getTime(),
        nueva: false,
      },
    ];
  }

  const out: Alerta[] = [];
  const ult = h[0];
  const prev = h[1];
  const fUlt = new Date(ult.fecha).getTime();
  const clavesPrev = new Set(prev ? relevantes(prev).map(clave) : []);
  const clavesUlt = new Set(relevantes(ult).map(clave));

  // Un hallazgo es una alerta mientras siga apareciendo; "desde" es la primera vez de la racha actual
  for (const x of relevantes(ult)) {
    let desde = fUlt;
    for (let j = 1; j < h.length; j++) {
      if (relevantes(h[j]).some((y) => clave(y) === clave(x))) desde = new Date(h[j].fecha).getTime();
      else break;
    }
    out.push({
      ...base,
      id: `${d.id}|h|${clave(x)}`,
      tipo: 'hallazgo',
      sev: x.severidad,
      titulo: x.titulo,
      detalle: x.descripcion,
      recomendacion: x.recomendacion,
      categoria: x.categoria,
      desde,
      nueva: !!prev && !clavesPrev.has(clave(x)),
    });
  }

  if (prev) {
    const delta = ult.puntaje - prev.puntaje;
    if (delta <= -CAMBIO_RELEVANTE) {
      out.push({
        ...base,
        id: `${d.id}|caida|${ult.id}`,
        tipo: 'caida',
        sev: delta <= -25 ? 'critica' : 'alta',
        titulo: `El puntaje bajó ${-delta} puntos`,
        detalle: `Pasó de ${prev.puntaje} a ${ult.puntaje} desde el análisis anterior.`,
        recomendacion: 'Revisa los hallazgos nuevos de este dominio: algo cambió en su configuración.',
        categoria: 'Tendencia',
        desde: fUlt,
        nueva: true,
      });
    } else if (delta >= CAMBIO_RELEVANTE) {
      out.push({
        ...base,
        id: `${d.id}|mejora|${ult.id}`,
        tipo: 'mejora',
        sev: 'ok',
        titulo: `El puntaje subió ${delta} puntos`,
        detalle: `Pasó de ${prev.puntaje} a ${ult.puntaje} desde el análisis anterior.`,
        recomendacion: '',
        categoria: 'Tendencia',
        desde: fUlt,
        nueva: true,
      });
    }
    for (const x of relevantes(prev)) {
      if (clavesUlt.has(clave(x))) continue;
      out.push({
        ...base,
        id: `${d.id}|resuelto|${clave(x)}|${ult.id}`,
        tipo: 'resuelto',
        sev: 'ok',
        titulo: `Resuelto: ${x.titulo}`,
        detalle: 'Ya no aparece en el análisis más reciente.',
        recomendacion: '',
        categoria: x.categoria,
        desde: fUlt,
        nueva: true,
      });
    }
  }

  const dias = (Date.now() - fUlt) / DIA;
  if (dias > DIAS_SIN_ANALISIS) {
    out.push({
      ...base,
      id: `${d.id}|inactivo`,
      tipo: 'inactivo',
      sev: 'media',
      titulo: `Hace ${Math.floor(dias)} días que no analizas este dominio`,
      detalle: 'Un certificado puede vencer o un puerto puede abrirse en cualquier momento.',
      recomendacion: 'Vuelve a analizarlo para confirmar que sigue en buen estado.',
      categoria: 'Mantenimiento',
      desde: fUlt,
      nueva: false,
    });
  }
  return out;
}
