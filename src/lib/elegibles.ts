// A qué agentes corresponde cada gasto recurrente (para preseleccionarlos al cargarlo).
import { getEfectivoPagaFee } from "./fee"
import { getConceptGroup } from "./conceptos"

export interface AgenteElegible {
  id: string
  activo: boolean
  paga_fee: boolean | null
  fecha_alta: string
  tipo_plan: string | null
}
export interface PagoMin { agente_id: string; fecha: string; concepto: string }

export interface Elegibilidad {
  /** Agentes a los que corresponde el cargo y todavía no lo tienen en ese mes */
  sugeridos: string[]
  /** Agentes a los que correspondería pero ya tienen ese cargo en el mes (evita duplicar) */
  yaCargados: Set<string>
  /** Texto corto que explica el criterio, para mostrar en el modal */
  criterio: string
  /** Por qué entra (o no) cada agente activo en el FEE: antigüedad y regla aplicada. Solo para "FEE mensual". */
  motivos: Record<string, string>
}

const fmtDMY = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`

/** Explica la decisión de fee de un agente a la fecha del gasto (misma regla que getEfectivoPagaFee). */
export function motivoFee(a: AgenteElegible, fechaGasto: string, refDate: Date): string {
  if (a.paga_fee === true) return "Marcado manualmente: Paga FEE"
  if (a.paga_fee === false) return "Marcado manualmente: no paga FEE"
  const alta = new Date(a.fecha_alta + "T00:00:00")
  if (Number.isNaN(alta.getTime())) return "Fecha de alta inválida"
  const gasto = new Date(fechaGasto + "T00:00:00")
  const dias = Math.floor((gasto.getTime() - alta.getTime()) / 86_400_000)
  const cumple = new Date(alta); cumple.setDate(cumple.getDate() + 180)
  const entra = getEfectivoPagaFee(a.fecha_alta, null, refDate)
  if (dias >= 180) return entra ? `${dias} días de antigüedad` : `${dias} días · pasó los 180 pero la regla de quincena lo pasa al mes siguiente`
  return entra
    ? `${dias} días · cumple 180 el ${fmtDMY(cumple)} (primera quincena: paga este mes)`
    : `${dias} días · cumple 180 el ${fmtDMY(cumple)}`
}

/**
 * - "FEE mensual": agentes activos que pagan fee a la fecha del gasto (más de 180 días de antigüedad con la regla de
 *   quincena, o marcados manualmente "Paga FEE").
 * - "Licencia CRM PRO" / "PRO+": agentes activos con ese plan.
 * - "Otro": ninguno (se elige a mano).
 */
export function elegiblesParaGasto(
  concepto: string,
  fechaGasto: string,
  agentes: AgenteElegible[],
  pagos: PagoMin[],
): Elegibilidad {
  const [y, m] = fechaGasto.split("-").map(Number)
  const refDate = y && m ? new Date(y, m - 1, 1) : new Date()
  const activos = agentes.filter((a) => a.activo)

  let corresponden: AgenteElegible[] = []
  let criterio = "Elegí a mano los agentes a los que corresponde este cargo."
  if (concepto === "FEE mensual") {
    corresponden = activos.filter((a) => getEfectivoPagaFee(a.fecha_alta, a.paga_fee, refDate))
    criterio = "Agentes activos con más de 180 días de antigüedad, o marcados \"Paga FEE\"."
  } else if (concepto === "Licencia CRM PRO") {
    corresponden = activos.filter((a) => a.tipo_plan === "PRO")
    criterio = "Agentes activos con plan PRO."
  } else if (concepto === "Licencia CRM PRO+") {
    corresponden = activos.filter((a) => a.tipo_plan === "PRO+")
    criterio = "Agentes activos con plan PRO+."
  }

  // ¿Ya tiene este cargo en el mismo mes? (FEE: cualquier cargo de fee; licencias: el mismo concepto)
  const periodo = fechaGasto.slice(0, 7)
  const yaCargados = new Set<string>()
  for (const p of pagos) {
    if (!p.fecha.startsWith(periodo)) continue
    const mismo = concepto === "FEE mensual" ? getConceptGroup(p.concepto) === "FEE" : p.concepto === concepto
    if (mismo) yaCargados.add(p.agente_id)
  }

  const motivos: Record<string, string> = {}
  if (concepto === "FEE mensual") for (const a of activos) motivos[a.id] = motivoFee(a, fechaGasto, refDate)

  return {
    sugeridos: corresponden.filter((a) => !yaCargados.has(a.id)).map((a) => a.id),
    yaCargados,
    criterio,
    motivos,
  }
}
