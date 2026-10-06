// Cómo se arma la operación (y las puntas del reparto) al cerrar una oferta. Única definición del cálculo.
import { basesPorPunta, type Punta } from "./reparto"

export interface OfertaParaCierre {
  direccion: string
  tipo_operacion: string
  agente_vendedor_id: string | null
  agente_comprador_id: string | null
  agente_vendedor_externo: string | null
  agente_comprador_externo: string | null
}

// Tipos válidos de la tabla `operaciones`
const TIPOS_VALIDOS = ["Venta", "Alquiler", "Alquiler Temporal", "Referido", "Otro"]

/** Comisión bruta de la oficina por cada punta interna (3% del precio). */
export const PORCENTAJE_COMISION_PUNTA = 0.03

export interface OperacionArmada {
  /** Texto de agentes de la operación: "Vendedor / Comprador" o "Nombre (2 puntas)" */
  agentes: string
  tipo: string
  /** Comisión bruta total (entera) = 3% por cada agente interno */
  comision: number
  /** Puntas internas con su comisión base (para el reparto) */
  puntas: Punta[]
}

export function armarOperacionDeOferta(oferta: OfertaParaCierre, nombrePorId: Map<string, string>, precio: number): OperacionArmada {
  const vName: string | null = oferta.agente_vendedor_id
    ? (nombrePorId.get(oferta.agente_vendedor_id) ?? "Desconocido")
    : (oferta.agente_vendedor_externo ?? null)
  const cName: string | null = oferta.agente_comprador_id
    ? (nombrePorId.get(oferta.agente_comprador_id) ?? "Desconocido")
    : (oferta.agente_comprador_externo ?? null)

  const mismoInterno =
    oferta.agente_vendedor_id && oferta.agente_comprador_id && oferta.agente_vendedor_id === oferta.agente_comprador_id
  let agentes: string
  if (mismoInterno) {
    agentes = `${vName} (2 puntas)`
  } else {
    const partes = [vName, cName].filter((n): n is string => Boolean(n))
    agentes = partes.length > 0 ? partes.join(" / ") : "Sin agente"
  }

  const puntas: Punta[] = []
  if (oferta.agente_vendedor_id)  puntas.push({ rol: "vendedor",  agenteId: oferta.agente_vendedor_id,  base: 0 })
  if (oferta.agente_comprador_id) puntas.push({ rol: "comprador", agenteId: oferta.agente_comprador_id, base: 0 })

  const comision = Math.round(precio * PORCENTAJE_COMISION_PUNTA * puntas.length)
  basesPorPunta(comision, puntas.length).forEach((b, i) => { puntas[i].base = b })

  const tipo = oferta.tipo_operacion === "Alquiler Temporario" ? "Alquiler Temporal"
             : TIPOS_VALIDOS.includes(oferta.tipo_operacion) ? oferta.tipo_operacion
             : "Otro"

  return { agentes, tipo, comision, puntas }
}
