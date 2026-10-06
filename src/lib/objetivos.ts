// Objetivos de facturación: una única fuente para Dashboard, Facturación, Resumen y Configuración.

// Clave de la tabla `config` que guarda el objetivo anual (la edita Configuración).
export const CLAVE_OBJETIVO_ANUAL = "obj_anual_usd"
export const OBJETIVO_ANUAL_DEFAULT = 710_000

// Estacionalidad (índice 0 = Enero … 11 = Diciembre), suma = 100%
export const ESTACIONALIDAD_PCT = [4.72, 5.41, 7.12, 6.82, 8.41, 9.15, 8.66, 9.64, 9.42, 9.65, 9.78, 11.22]

/** Clave de config del objetivo anual de un año concreto (ej: obj_anual_usd_2027). */
export const claveObjetivoAnual = (anio: number) => `${CLAVE_OBJETIVO_ANUAL}_${anio}`

/**
 * Objetivo anual de un año a partir del mapa de config:
 *  1. la clave de ese año (obj_anual_usd_2027);
 *  2. año en curso sin clave propia: la clave histórica `obj_anual_usd` (el valor de siempre);
 *  3. año futuro sin cargar (planificación): el objetivo del año en curso, como proyección;
 *  4. año pasado sin clave propia: 0 = "sin objetivo". No se inventa uno con el valor de otro año.
 */
export function objetivoAnualDe(config: Record<string, string | null | undefined>, anio: number, anioActual: number): number {
  const delAnio = config[claveObjetivoAnual(anio)]
  if (delAnio != null && delAnio !== "") return parseObjetivoAnual(delAnio)
  if (anio === anioActual) return parseObjetivoAnual(config[CLAVE_OBJETIVO_ANUAL])
  if (anio > anioActual) return objetivoAnualDe(config, anioActual, anioActual)
  return 0
}

/** ¿El mes ya terminó (hora Argentina)? Un mes se cierra a las 00:00 del día 1 del mes siguiente. */
export function mesTerminado(anio: number, mes: number, hoy: { anio: number; mes: number }): boolean {
  return anio < hoy.anio || (anio === hoy.anio && mes < hoy.mes)
}

/** Valor de config → objetivo anual. Cae al default si falta, no es número o es <= 0. */
export function parseObjetivoAnual(valor: string | null | undefined): number {
  const n = parseFloat(valor ?? "")
  return Number.isFinite(n) && n > 0 ? n : OBJETIVO_ANUAL_DEFAULT
}

/** Objetivo del mes (1-12) = anual × estacionalidad, redondeado. */
export function calcObjetivoMes(objetivoAnual: number, mes: number): number {
  const pct = ESTACIONALIDAD_PCT[mes - 1]
  return pct === undefined ? 0 : Math.round((objetivoAnual * pct) / 100)
}

/**
 * Facturación real del mes: la carga manual (tabla `facturacion`) si es > 0;
 * si no, la suma de comisiones brutas de Operaciones.
 */
export function realDelMes(manualUsd: number | null | undefined, comisionesUsd: number): number {
  const manual = Number(manualUsd)
  return Number.isFinite(manual) && manual > 0 ? manual : comisionesUsd
}
