// Reparto de un pago entre los cargos pendientes de un agente.
// Lo usan la pantalla (vista previa en vivo) y el server (al guardar): así la cuenta que ves es la que se aplica.

export interface CargoPendiente {
  id: string
  concepto: string
  fecha: string
  debe: number
  pagado: number
}

export interface AplicacionPago {
  id: string
  concepto: string
  fecha: string
  aplicado: number     // cuánto de este pago va a este cargo
  yaPagado: number     // lo que ya tenía pagado antes
  falta: number        // lo que faltaba antes de este pago
  quedaDespues: number // lo que queda después de este pago
}

export interface ReparticionPago {
  aplicaciones: AplicacionPago[]
  sobrante: number     // lo que no entró en ningún cargo
}

const round2 = (n: number) => Math.round(n * 100) / 100
const EPS = 0.005

/** Cargos con algo por pagar, del más viejo al más nuevo. */
export function ordenarPendientes(cargos: CargoPendiente[]): CargoPendiente[] {
  return cargos
    .filter((c) => round2(c.debe - c.pagado) > EPS)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id))
}

/** Aplica `monto` a los cargos pendientes, del más viejo al más nuevo, sin pasarse de lo que falta en cada uno. */
export function repartirPago(monto: number, cargos: CargoPendiente[]): ReparticionPago {
  let resto = round2(monto)
  const aplicaciones: AplicacionPago[] = []
  for (const c of ordenarPendientes(cargos)) {
    if (resto <= EPS) break
    const falta = round2(c.debe - c.pagado)
    const aplicado = round2(Math.min(resto, falta))
    aplicaciones.push({
      id: c.id, concepto: c.concepto, fecha: c.fecha,
      aplicado, yaPagado: round2(c.pagado), falta, quedaDespues: round2(falta - aplicado),
    })
    resto = round2(resto - aplicado)
  }
  return { aplicaciones, sobrante: resto > EPS ? resto : 0 }
}
