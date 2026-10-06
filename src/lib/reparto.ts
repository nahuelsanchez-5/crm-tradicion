// Reparto de la comisión bruta de una operación entre agentes.
//
// Modelo (definido con el dueño):
//  - Cada punta interna (vendedor / comprador) genera una comisión bruta (3% del precio).
//  - Si un agente REFIRIÓ al otro, el que recibió el referido le cede un % de SU punta al que refirió
//    (ej: Jelena refirió el comprador a Sapo → Sapo le cede 25% de su punta a Jelena).
//    Jelena factura su punta + lo cedido; Sapo factura su punta − lo cedido.
//  - El total que facturan los agentes SIEMPRE suma el bruto de la oficina (el referido no lo cambia).
//  - Un referido EXTERNO (otra oficina) es solo informativo: se anota cuánto se paga/recibe pero
//    no modifica la facturación bruta ni el reparto entre agentes.
//
// Módulo puro (sin imports de servidor): lo usan el editor, el cierre y las acciones del server.

export type RolReparto = "vendedor" | "comprador" | "referido_interno" | "referido_externo"

export interface Punta { rol: "vendedor" | "comprador"; agenteId: string; base: number }
/** `dePunta` = índice (en el array de puntas) de la punta de la que sale lo cedido */
export interface RefInterno { agenteId: string; porcentaje: number; dePunta: number }
export interface RefExterno { nombre: string; monto: number; porcentaje?: number | null }

export interface FilaReparto {
  agente_id: string | null
  agente_externo: string | null
  rol: RolReparto
  porcentaje: number | null
  de_agente_id: string | null
  monto_usd: number
  informativo: boolean
}

import { esUUIDValido } from "./validate"

export interface RepartoData { puntas: Punta[]; refInt: RefInterno[]; refExt: RefExterno[] }

export const round2 = (n: number) => Math.round(n * 100) / 100

/** Comisión por punta = comisión bruta total repartida en partes iguales entre las puntas internas. */
export function basesPorPunta(comisionBruta: number, cantidadPuntas: number): number[] {
  if (cantidadPuntas <= 0) return []
  const parte = round2(comisionBruta / cantidadPuntas)
  const bases = Array.from({ length: cantidadPuntas }, () => parte)
  // el centavo sobrante va a la primera punta para que la suma cierre exacto
  bases[0] = round2(bases[0] + (comisionBruta - parte * cantidadPuntas))
  return bases
}

export function validarReparto(puntas: Punta[], refInt: RefInterno[], refExt: RefExterno[]): string | null {
  if (puntas.length === 0) return "La operación no tiene puntas internas para repartir."
  for (const p of puntas) {
    if (!p.agenteId) return "Falta elegir el agente de una punta."
    if (!Number.isFinite(p.base) || p.base < 0) return "El monto de una punta es inválido."
  }
  const cedidoPct = puntas.map(() => 0)
  for (const r of refInt) {
    if (!r.agenteId) return "Falta elegir quién refirió."
    if (!Number.isFinite(r.porcentaje) || r.porcentaje <= 0 || r.porcentaje > 100) return "El % del referido debe estar entre 0 y 100."
    if (!Number.isInteger(r.dePunta) || r.dePunta < 0 || r.dePunta >= puntas.length) return "Elegí de qué punta se descuenta el referido."
    if (puntas[r.dePunta].agenteId === r.agenteId) return "Un agente no puede referirse a sí mismo."
    cedidoPct[r.dePunta] += r.porcentaje
  }
  if (cedidoPct.some((p) => p > 100)) return "Los referidos de una misma punta superan el 100%."
  for (const e of refExt) {
    if (!e.nombre.trim()) return "Falta el nombre del referido externo."
    if (!Number.isFinite(e.monto) || e.monto < 0) return "El monto del referido externo es inválido."
  }
  return null
}

export function calcularFilas(puntas: Punta[], refInt: RefInterno[], refExt: RefExterno[]): FilaReparto[] {
  const cedido = puntas.map(() => 0)
  const filasRef: FilaReparto[] = []
  for (const r of refInt) {
    const monto = round2((puntas[r.dePunta].base * r.porcentaje) / 100)
    cedido[r.dePunta] += monto
    filasRef.push({
      agente_id: r.agenteId, agente_externo: null, rol: "referido_interno",
      porcentaje: r.porcentaje, de_agente_id: puntas[r.dePunta].agenteId, monto_usd: monto, informativo: false,
    })
  }
  const filasPunta: FilaReparto[] = puntas.map((p, i) => ({
    agente_id: p.agenteId, agente_externo: null, rol: p.rol,
    porcentaje: null, de_agente_id: null, monto_usd: round2(p.base - cedido[i]), informativo: false,
  }))
  const filasExt: FilaReparto[] = refExt.map((e) => ({
    agente_id: null, agente_externo: e.nombre.trim().slice(0, 120), rol: "referido_externo",
    porcentaje: e.porcentaje ?? null, de_agente_id: null, monto_usd: round2(e.monto), informativo: true,
  }))
  return [...filasPunta, ...filasRef, ...filasExt]
}

/** Inverso de calcularFilas: reconstruye lo que se editó a partir de lo guardado (para reabrir un reparto). */
export function reconstruirDesdeFilas(filas: FilaReparto[]): { puntas: Punta[]; refInt: RefInterno[]; refExt: RefExterno[] } {
  const filasPunta = filas.filter((f) => f.rol === "vendedor" || f.rol === "comprador")
  const filasRef = filas.filter((f) => f.rol === "referido_interno")
  const puntas: Punta[] = filasPunta.map((f) => {
    // lo cedido por esta punta vuelve a sumarse para recuperar la base original
    const cedido = filasRef.filter((r) => r.de_agente_id === f.agente_id).reduce((s, r) => s + r.monto_usd, 0)
    return { rol: f.rol as "vendedor" | "comprador", agenteId: f.agente_id ?? "", base: round2(f.monto_usd + cedido) }
  })
  const refInt: RefInterno[] = filasRef.flatMap((r) => {
    const dePunta = puntas.findIndex((p) => p.agenteId === r.de_agente_id)
    return dePunta < 0 || !r.agente_id ? [] : [{ agenteId: r.agente_id, porcentaje: r.porcentaje ?? 0, dePunta }]
  })
  const refExt: RefExterno[] = filas
    .filter((f) => f.rol === "referido_externo")
    .map((f) => ({ nombre: f.agente_externo ?? "", monto: f.monto_usd, porcentaje: f.porcentaje }))
  return { puntas, refInt, refExt }
}

/** Suma de lo que se atribuye a agentes (sin las filas informativas). Debe igualar el bruto de la operación. */
export function totalAtribuido(filas: FilaReparto[]): number {
  return round2(filas.filter((f) => !f.informativo).reduce((s, f) => s + f.monto_usd, 0))
}

/** Valida y arma las filas. La suma de lo atribuido a agentes tiene que igualar el bruto de la operación. */
export function armarFilasValidadas(comisionBruta: number, data: RepartoData): { filas?: FilaReparto[]; error?: string } {
  if (!data || !Array.isArray(data.puntas) || !Array.isArray(data.refInt) || !Array.isArray(data.refExt)) {
    return { error: "Datos de reparto inválidos" }
  }
  if (data.puntas.length > 2 || data.refInt.length > 4 || data.refExt.length > 4) return { error: "Demasiadas filas de reparto" }
  if (!data.puntas.every((p) => (p.rol === "vendedor" || p.rol === "comprador") && esUUIDValido(p.agenteId))) {
    return { error: "Hay una punta sin agente o con datos inválidos" }
  }
  if (!data.refInt.every((r) => esUUIDValido(r.agenteId))) return { error: "Hay un referido con datos inválidos" }

  const errVal = validarReparto(data.puntas, data.refInt, data.refExt)
  if (errVal) return { error: errVal }

  const sumaPuntas = round2(data.puntas.reduce((s, p) => s + p.base, 0))
  if (Math.abs(sumaPuntas - comisionBruta) > 0.01) {
    return { error: `Las puntas suman USD ${sumaPuntas.toLocaleString("es-AR")} y la comisión bruta de la operación es USD ${comisionBruta.toLocaleString("es-AR")}. Tienen que coincidir.` }
  }
  const filas = calcularFilas(data.puntas, data.refInt, data.refExt)
  if (Math.abs(totalAtribuido(filas) - comisionBruta) > 0.01) return { error: "El reparto no cierra con la comisión bruta." }
  return { filas }
}

/** Facturación por agente (id → USD) a partir de las filas. */
export function facturacionPorAgente(filas: Pick<FilaReparto, "agente_id" | "monto_usd" | "informativo">[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const f of filas) {
    if (f.informativo || !f.agente_id) continue
    out[f.agente_id] = round2((out[f.agente_id] ?? 0) + f.monto_usd)
  }
  return out
}
