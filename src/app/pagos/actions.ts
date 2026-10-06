"use server"

import { mensajeErrorDB } from "@/lib/errores"
import { getConceptGroup } from "@/lib/conceptos"
import { ordenarPendientes, repartirPago, type CargoPendiente } from "@/lib/cobros"
import { createServerClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import { requireSession } from "@/lib/auth-guard"
import { esMontoValido, esStringNoVacio, esFechaValida, esUUIDValido, esUnoDe } from "@/lib/validate"

function calcularEstado(monto_debe: number, monto_pagado: number): string {
  if (monto_pagado <= 0)              return "Pendiente"
  if (monto_pagado >= monto_debe)     return "Pagado"
  return "Parcial"
}

const ESTADOS_PAGO = ["Pendiente", "Parcial", "Pagado"] as const
const CONCEPTO_SALDO_FAVOR = "Saldo a favor"

// Valida el concepto libre (incluye "Otro"): no vacío, acotado, y sin pisar el concepto
// reservado del crédito FIFO (un cargo llamado "Saldo a favor" generaría crédito falso).
function errorConcepto(c: unknown): string | null {
  if (!esStringNoVacio(c)) return "El concepto no puede estar vacío"
  if (c.trim().length > 120) return "El concepto es demasiado largo (máx. 120 caracteres)"
  if (c.trim().toLowerCase() === CONCEPTO_SALDO_FAVOR.toLowerCase()) return "\"Saldo a favor\" es un concepto reservado"
  return null
}

// ─────────────────────────────────────────────────────
//  CREAR PAGO
// ─────────────────────────────────────────────────────
export async function crearPago(data: {
  agente_id: string
  fecha: string
  concepto: string
  monto_debe: number
  monto_pagado: number
}) {
  await requireSession()

  if (!esUUIDValido(data.agente_id))     return { error: "Agente inválido" }
  if (!esFechaValida(data.fecha))        return { error: "Fecha inválida" }
  const errConceptoPago = errorConcepto(data.concepto)
  if (errConceptoPago)                   return { error: errConceptoPago }
  if (!esMontoValido(data.monto_debe))   return { error: "El monto debe ser un número mayor a 0" }
  if (!esMontoValido(data.monto_pagado)) return { error: "El monto pagado debe ser un número mayor a 0" }

  const supabase = createServerClient()

  const estado = calcularEstado(data.monto_debe, data.monto_pagado)

  const { error } = await supabase.from("pagos").insert({
    agente_id:    data.agente_id,
    fecha:        data.fecha,
    concepto:     data.concepto,
    monto_debe:   data.monto_debe,
    monto_pagado: data.monto_pagado,
    estado,
  })

  if (error) return { error: mensajeErrorDB(error) }

  revalidatePath("/pagos")
  return { success: true }
}

// ─────────────────────────────────────────────────────
//  CREAR GASTO
// ─────────────────────────────────────────────────────
export async function crearGasto(data: {
  agente_id: string
  fecha: string
  concepto: string
  monto_debe: number
}) {
  await requireSession()

  if (!esUUIDValido(data.agente_id))   return { error: "Agente inválido" }
  if (!esFechaValida(data.fecha))      return { error: "Fecha inválida" }
  const errConceptoGasto = errorConcepto(data.concepto)
  if (errConceptoGasto)                return { error: errConceptoGasto }
  if (!esMontoValido(data.monto_debe)) return { error: "El monto debe ser un número mayor a 0" }

  const supabase = createServerClient()

  const { error } = await supabase.from("pagos").insert({
    agente_id:    data.agente_id,
    fecha:        data.fecha,
    concepto:     data.concepto,
    monto_debe:   data.monto_debe,
    monto_pagado: 0,
    estado:       "Pendiente",
  })

  if (error) return { error: mensajeErrorDB(error) }

  revalidatePath("/pagos")
  return { success: true }
}

// ─────────────────────────────────────────────────────
//  CREAR GASTO RECURRENTE (múltiples agentes)
// ─────────────────────────────────────────────────────
export async function crearGastoRecurrente(data: {
  agente_ids: string[]
  fecha: string
  concepto: string
  monto_debe: number
}) {
  await requireSession()

  if (!Array.isArray(data.agente_ids) || data.agente_ids.length === 0) return { error: "Seleccioná al menos un agente" }
  if (!data.agente_ids.every(esUUIDValido)) return { error: "Hay un agente inválido en la selección" }
  if (new Set(data.agente_ids).size !== data.agente_ids.length) return { error: "Hay agentes repetidos en la selección" }
  if (!esFechaValida(data.fecha))      return { error: "Fecha inválida" }
  const errConceptoRec = errorConcepto(data.concepto)
  if (errConceptoRec)                  return { error: errConceptoRec }
  if (!esMontoValido(data.monto_debe)) return { error: "El monto debe ser un número mayor a 0" }

  const supabase = createServerClient()

  const rows = data.agente_ids.map(agente_id => ({
    agente_id,
    fecha:        data.fecha,
    concepto:     data.concepto,
    monto_debe:   data.monto_debe,
    monto_pagado: 0,
    estado:       "Pendiente",
  }))

  const { error } = await supabase.from("pagos").insert(rows)

  if (error) return { error: mensajeErrorDB(error) }

  revalidatePath("/pagos")
  return { success: true }
}

// ─────────────────────────────────────────────────────
//  ELIMINAR PAGO / GASTO
// ─────────────────────────────────────────────────────
export async function eliminarPago(id: string) {
  await requireSession()

  if (!esUUIDValido(id)) return { error: "ID inválido" }

  const supabase = createServerClient()

  const { error } = await supabase
    .from("pagos")
    .delete()
    .eq("id", id)

  if (error) return { error: mensajeErrorDB(error) }

  revalidatePath("/pagos")
  return { success: true }
}

// ─────────────────────────────────────────────────────
//  REGISTRAR SALDO A FAVOR
// ─────────────────────────────────────────────────────
export async function registrarSaldoFavor(data: {
  agente_id: string
  fecha: string
  monto: number
}) {
  await requireSession()

  if (!esUUIDValido(data.agente_id)) return { error: "Agente inválido" }
  if (!esFechaValida(data.fecha))    return { error: "Fecha inválida" }
  if (!esMontoValido(data.monto))    return { error: "El monto debe ser un número mayor a 0" }

  const supabase = createServerClient()

  const { error } = await supabase.from("pagos").insert({
    agente_id:    data.agente_id,
    fecha:        data.fecha,
    concepto:     "Saldo a favor",
    monto_debe:   0,
    monto_pagado: data.monto,
    estado:       "Pagado",
  })

  if (error) return { error: mensajeErrorDB(error) }

  revalidatePath("/pagos")
  return { success: true }
}

// ─────────────────────────────────────────────────────
//  CREAR GASTO APLICANDO CRÉDITO
// ─────────────────────────────────────────────────────
const EPS = 0.01
const round2 = (n: number) => Math.round(n * 100) / 100

type SupabaseServer = ReturnType<typeof createServerClient>
type SaldoRow = { id: string; monto_pagado: number | string }

// Créditos ("Saldo a favor") del agente en orden FIFO (más viejo primero)
async function leerSaldosFIFO(supabase: SupabaseServer, agenteId: string) {
  return supabase
    .from("pagos")
    .select("id, monto_pagado")
    .eq("agente_id", agenteId)
    .eq("concepto", "Saldo a favor")
    .gt("monto_pagado", 0)
    .order("fecha", { ascending: true })
    .order("created_at", { ascending: true })
}

// Descuenta `monto` de los créditos en orden FIFO. Devuelve el mensaje de error o null.
// Siempre se llama después de validar que el saldo alcanza.
async function consumirSaldosFIFO(supabase: SupabaseServer, saldos: SaldoRow[], monto: number): Promise<string | null> {
  let remaining = monto
  for (const saldo of saldos) {
    if (remaining <= 0.005) break
    const actual = Number(saldo.monto_pagado)
    const use = Math.min(remaining, actual)
    const nuevo = round2(actual - use)
    const { error } = nuevo <= 0
      ? await supabase.from("pagos").delete().eq("id", saldo.id)
      : await supabase.from("pagos").update({ monto_pagado: nuevo }).eq("id", saldo.id)
    if (error) return error.message
    remaining -= use
  }
  return null
}

export async function crearGastoConCredito(data: {
  agente_id: string
  fecha: string
  concepto: string
  monto_debe: number
  credito_aplicado: number
}) {
  await requireSession()

  if (!esUUIDValido(data.agente_id))        return { error: "Agente inválido" }
  if (!esFechaValida(data.fecha))           return { error: "Fecha inválida" }
  const errConceptoCred = errorConcepto(data.concepto)
  if (errConceptoCred)                      return { error: errConceptoCred }
  if (!esMontoValido(data.monto_debe))      return { error: "El monto debe ser un número mayor a 0" }
  if (!esMontoValido(data.credito_aplicado)) return { error: "El crédito a aplicar debe ser un número mayor a 0" }

  // El crédito no puede superar el cargo (sobrepago) ni el concepto reservado del FIFO
  if (data.credito_aplicado > data.monto_debe + EPS) return { error: "El crédito a aplicar no puede superar el monto del cargo" }

  const supabase = createServerClient()

  // Consume "Saldo a favor" rows FIFO so the credit isn't double-counted in the balance.
  // Without this, the original deposit row (+credit) and the new monto_pagado (+credit) would
  // both add to the balance, making the agent appear to owe less than they actually do.
  const { data: saldos, error: saldosError } = await leerSaldosFIFO(supabase, data.agente_id)

  if (saldosError) return { error: mensajeErrorDB(saldosError) }

  // Validar ANTES de tocar nada: el crédito debe existir (si no, se creaba plata de la nada)
  const saldoDisponible = (saldos ?? []).reduce((s, x) => s + Number(x.monto_pagado), 0)
  if (data.credito_aplicado > saldoDisponible + EPS) {
    return { error: "El crédito a aplicar supera el saldo a favor disponible" }
  }

  const consumoError = await consumirSaldosFIFO(supabase, saldos ?? [], data.credito_aplicado)
  if (consumoError) return { error: consumoError }

  // Single row: full original cargo + credit reflected as monto_pagado
  const estado = data.credito_aplicado >= data.monto_debe ? "Pagado" : "Parcial"

  const { error } = await supabase.from("pagos").insert({
    agente_id:    data.agente_id,
    fecha:        data.fecha,
    concepto:     data.concepto,
    monto_debe:   data.monto_debe,
    monto_pagado: data.credito_aplicado,
    estado,
  })

  if (error) return { error: mensajeErrorDB(error) }

  revalidatePath("/pagos")
  return { success: true }
}

// ─────────────────────────────────────────────────────
//  ACTUALIZAR PAGO PARCIAL
// ─────────────────────────────────────────────────────
export async function actualizarPago(
  id: string,
  data: { monto_pagado: number; estado: string }
) {
  await requireSession()

  if (!esUUIDValido(id)) return { error: "ID inválido" }
  // monto_pagado admite 0 (revertir un pago a pendiente), por eso no usamos esMontoValido
  if (typeof data.monto_pagado !== "number" || !isFinite(data.monto_pagado) || data.monto_pagado < 0) {
    return { error: "El monto pagado debe ser un número mayor o igual a 0" }
  }
  if (!esUnoDe(data.estado, ESTADOS_PAGO)) return { error: "Estado inválido" }

  const supabase = createServerClient()

  const { data: actual, error: fetchError } = await supabase
    .from("pagos")
    .select("concepto, monto_debe")
    .eq("id", id)
    .maybeSingle()
  if (fetchError) return { error: mensajeErrorDB(fetchError) }
  if (!actual) return { error: "Pago no encontrado" }

  // Las filas de crédito ("Saldo a favor") tienen monto_debe 0: se editan tal cual.
  // En los cargos el estado lo calcula el server (no se confía en el que manda el cliente)
  // y no se puede pagar de más.
  let estado: string = data.estado
  if (actual.concepto !== CONCEPTO_SALDO_FAVOR) {
    const debe = Number(actual.monto_debe)
    if (data.monto_pagado > debe + EPS) return { error: "El monto pagado no puede superar el monto del cargo" }
    estado = calcularEstado(debe - EPS, data.monto_pagado)
  }

  const { error } = await supabase
    .from("pagos")
    .update({ monto_pagado: data.monto_pagado, estado })
    .eq("id", id)

  if (error) return { error: mensajeErrorDB(error) }

  revalidatePath("/pagos")
  return { success: true }
}

// ─────────────────────────────────────────────────────
//  REGISTRAR UN PAGO SOBRE UN CARGO (se suma a lo ya pagado)
// ─────────────────────────────────────────────────────
// A diferencia de actualizarPago (que recibe el total acumulado), acá se informa solo el pago NUEVO:
// el server lo suma a lo que ya estaba pagado, controla que no se pase de lo que falta y recalcula el estado.
export async function registrarPagoEnCargo(id: string, monto: number) {
  await requireSession()

  if (!esUUIDValido(id))     return { error: "ID inválido" }
  if (!esMontoValido(monto)) return { error: "El pago debe ser un número mayor a 0" }

  const supabase = createServerClient()

  const { data: cargo, error: fetchError } = await supabase
    .from("pagos")
    .select("concepto, monto_debe, monto_pagado")
    .eq("id", id)
    .maybeSingle()
  if (fetchError) return { error: mensajeErrorDB(fetchError, "leer el cargo") }
  if (!cargo)     return { error: "Cargo no encontrado" }
  if (cargo.concepto === CONCEPTO_SALDO_FAVOR) return { error: "Esta fila es un saldo a favor, no un cargo" }

  const debe      = Number(cargo.monto_debe)
  const yaPagado  = Number(cargo.monto_pagado)
  const pendiente = round2(debe - yaPagado)

  if (pendiente <= EPS) return { error: "Este cargo ya está pagado por completo" }
  if (monto > pendiente + EPS) {
    return { error: `El pago (USD ${monto.toLocaleString("es-AR")}) supera lo que falta (USD ${pendiente.toLocaleString("es-AR")}). Si pagó de más, cargá el pago por lo que falta y el resto como saldo a favor.` }
  }

  const nuevoPagado = round2(yaPagado + monto)
  const estado = calcularEstado(debe - EPS, nuevoPagado)

  const { error } = await supabase
    .from("pagos")
    .update({ monto_pagado: nuevoPagado, estado })
    .eq("id", id)
  if (error) return { error: mensajeErrorDB(error) }

  revalidatePath("/pagos")
  return { success: true, pagado: nuevoPagado, queda: round2(Math.max(0, debe - nuevoPagado)), estado }
}

// ─────────────────────────────────────────────────────
//  REGISTRAR PAGO DE UN AGENTE (se aplica solo a sus cargos pendientes)
// ─────────────────────────────────────────────────────
// Botón general "Registrar Pago": elegís agente + concepto + cuánto pagó.
//  - Si el agente tiene cargos pendientes de ese concepto, el pago se aplica al más viejo primero.
//  - Si sobra, queda como saldo a favor (si no se acepta eso, no se guarda nada y se avisa).
//  - Si no hay ningún cargo pendiente de ese concepto, se registra como pago ya cobrado (como antes).
export async function registrarPagoAgente(data: {
  agente_id: string
  concepto: string
  monto: number
  fecha: string
  sobranteASaldoFavor: boolean
}) {
  await requireSession()

  if (!esUUIDValido(data.agente_id)) return { error: "Agente inválido" }
  if (!esFechaValida(data.fecha))    return { error: "Fecha inválida" }
  if (!esMontoValido(data.monto))    return { error: "El monto debe ser un número mayor a 0" }
  const errConcepto = errorConcepto(data.concepto)
  if (errConcepto) return { error: errConcepto }

  const supabase = createServerClient()

  const { data: filas, error: leerError } = await supabase
    .from("pagos")
    .select("id, concepto, fecha, monto_debe, monto_pagado")
    .eq("agente_id", data.agente_id)
  if (leerError) return { error: mensajeErrorDB(leerError, "leer los cargos del agente") }

  const grupo = getConceptGroup(data.concepto)
  const cargos: CargoPendiente[] = (filas ?? [])
    .filter((f) => f.concepto !== CONCEPTO_SALDO_FAVOR && getConceptGroup(f.concepto as string) === grupo)
    .map((f) => ({
      id: f.id as string, concepto: f.concepto as string, fecha: f.fecha as string,
      debe: Number(f.monto_debe), pagado: Number(f.monto_pagado),
    }))

  // Sin cargos pendientes de este concepto: queda registrado como pago ya cobrado
  if (ordenarPendientes(cargos).length === 0) {
    const { error } = await supabase.from("pagos").insert({
      agente_id: data.agente_id, fecha: data.fecha, concepto: data.concepto.trim(),
      monto_debe: data.monto, monto_pagado: data.monto, estado: "Pagado",
    })
    if (error) return { error: mensajeErrorDB(error) }
    revalidatePath("/pagos")
    return { success: true as const, modo: "sin_cargo" as const, aplicaciones: [], sobrante: 0 }
  }

  const rep = repartirPago(data.monto, cargos)
  // Validar antes de escribir: si sobra plata y no se aceptó dejarla como saldo a favor, no se toca nada
  if (rep.sobrante > 0 && !data.sobranteASaldoFavor) {
    return { error: `El pago supera lo que falta en sus cargos por USD ${rep.sobrante.toLocaleString("es-AR")}. Marcá que el resto quede como saldo a favor, o bajá el monto.` }
  }

  for (const ap of rep.aplicaciones) {
    const nuevoPagado = round2(ap.yaPagado + ap.aplicado)
    const cargo = cargos.find((c) => c.id === ap.id)!
    const estado = calcularEstado(cargo.debe - EPS, nuevoPagado)
    const { error } = await supabase.from("pagos").update({ monto_pagado: nuevoPagado, estado }).eq("id", ap.id)
    if (error) return { error: mensajeErrorDB(error) }
  }

  if (rep.sobrante > 0) {
    const { error } = await supabase.from("pagos").insert({
      agente_id: data.agente_id, fecha: data.fecha, concepto: CONCEPTO_SALDO_FAVOR,
      monto_debe: 0, monto_pagado: rep.sobrante, estado: "Pagado",
    })
    if (error) return { error: mensajeErrorDB(error) }
  }

  revalidatePath("/pagos")
  return { success: true as const, modo: "aplicado" as const, aplicaciones: rep.aplicaciones, sobrante: rep.sobrante }
}

// ─────────────────────────────────────────────────────
//  APLICAR SALDO A FAVOR A PENDIENTES EXISTENTES
// ─────────────────────────────────────────────────────
export async function aplicarCreditoAPendientes(data: {
  agente_id: string
  aplicaciones: Array<{ pago_id: string; monto: number }>
}) {
  await requireSession()

  if (!esUUIDValido(data.agente_id)) return { error: "Agente inválido" }
  if (!Array.isArray(data.aplicaciones) || data.aplicaciones.length === 0) return { error: "No hay aplicaciones para procesar" }
  if (!data.aplicaciones.every(a => esUUIDValido(a.pago_id) && esMontoValido(a.monto))) {
    return { error: "Hay una aplicación inválida (pago o monto)" }
  }
  const ids = data.aplicaciones.map(a => a.pago_id)
  if (new Set(ids).size !== ids.length) return { error: "Hay pagos repetidos en las aplicaciones" }

  const supabase = createServerClient()

  const totalAplicar = data.aplicaciones.reduce((s, a) => s + a.monto, 0)
  if (totalAplicar <= 0) return { error: "Nada para aplicar" }

  // ── Validar TODO antes de modificar nada ──────────────────────────────────
  const { data: saldos, error: saldosError } = await leerSaldosFIFO(supabase, data.agente_id)
  if (saldosError) return { error: mensajeErrorDB(saldosError) }

  const saldoDisponible = (saldos ?? []).reduce((s, x) => s + Number(x.monto_pagado), 0)
  if (totalAplicar > saldoDisponible + EPS) {
    return { error: "El total a aplicar supera el saldo a favor disponible" }
  }

  // Cada pago destino debe ser un cargo del MISMO agente (no un crédito) y no sobrepagarse
  const { data: destinos, error: destinosError } = await supabase
    .from("pagos")
    .select("id, agente_id, concepto, monto_debe, monto_pagado")
    .in("id", ids)
  if (destinosError) return { error: mensajeErrorDB(destinosError) }

  const destinoPorId = new Map((destinos ?? []).map(d => [d.id as string, d]))
  for (const ap of data.aplicaciones) {
    const d = destinoPorId.get(ap.pago_id)
    if (!d) return { error: "Pago no encontrado" }
    if (d.agente_id !== data.agente_id) return { error: "Un pago no pertenece al agente indicado" }
    if (d.concepto === "Saldo a favor") return { error: "No se puede aplicar crédito a una fila de saldo a favor" }
    const pendiente = Number(d.monto_debe) - Number(d.monto_pagado)
    if (ap.monto > pendiente + EPS) return { error: "El monto a aplicar supera lo que le falta pagar a un cargo" }
  }

  // ── Aplicar: primero a los cargos, después se consume el crédito ──────────
  // Si falla algo a mitad de camino, el saldo a favor todavía está intacto (no se pierde plata).
  for (const ap of data.aplicaciones) {
    const d = destinoPorId.get(ap.pago_id)!
    const nuevoPagado = round2(Number(d.monto_pagado) + ap.monto)
    const estado = nuevoPagado >= Number(d.monto_debe) - EPS ? "Pagado" : "Parcial"

    const { error } = await supabase
      .from("pagos")
      .update({ monto_pagado: nuevoPagado, estado })
      .eq("id", ap.pago_id)

    if (error) return { error: mensajeErrorDB(error) }
  }

  const consumoError = await consumirSaldosFIFO(supabase, saldos ?? [], totalAplicar)
  if (consumoError) return { error: consumoError }

  revalidatePath("/pagos")
  return { success: true }
}
