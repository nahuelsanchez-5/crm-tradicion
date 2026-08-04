"use server"

import { createServerClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import { requireSession } from "@/lib/auth-guard"
import { esMontoValido, esStringNoVacio, esFechaValida, esUUIDValido } from "@/lib/validate"

function calcularEstado(monto_debe: number, monto_pagado: number): string {
  if (monto_pagado <= 0)              return "Pendiente"
  if (monto_pagado >= monto_debe)     return "Pagado"
  return "Parcial"
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
  if (!esStringNoVacio(data.concepto))   return { error: "El concepto no puede estar vacío" }
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

  if (error) return { error: error.message }

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
  if (!esStringNoVacio(data.concepto)) return { error: "El concepto no puede estar vacío" }
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

  if (error) return { error: error.message }

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

  if (data.agente_ids.length === 0) return { error: "Seleccioná al menos un agente" }
  if (!data.agente_ids.every(esUUIDValido)) return { error: "Hay un agente inválido en la selección" }
  if (!esFechaValida(data.fecha))      return { error: "Fecha inválida" }
  if (!esStringNoVacio(data.concepto)) return { error: "El concepto no puede estar vacío" }
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

  if (error) return { error: error.message }

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

  if (error) return { error: error.message }

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

  if (error) return { error: error.message }

  revalidatePath("/pagos")
  return { success: true }
}

// ─────────────────────────────────────────────────────
//  CREAR GASTO APLICANDO CRÉDITO
// ─────────────────────────────────────────────────────
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
  if (!esStringNoVacio(data.concepto))      return { error: "El concepto no puede estar vacío" }
  if (!esMontoValido(data.monto_debe))      return { error: "El monto debe ser un número mayor a 0" }
  if (!esMontoValido(data.credito_aplicado)) return { error: "El crédito a aplicar debe ser un número mayor a 0" }

  const supabase = createServerClient()

  // Consume "Saldo a favor" rows FIFO so the credit isn't double-counted in the balance.
  // Without this, the original deposit row (+credit) and the new monto_pagado (+credit) would
  // both add to the balance, making the agent appear to owe less than they actually do.
  const { data: saldos, error: saldosError } = await supabase
    .from("pagos")
    .select("id, monto_pagado")
    .eq("agente_id", data.agente_id)
    .eq("concepto", "Saldo a favor")
    .gt("monto_pagado", 0)
    .order("fecha", { ascending: true })
    .order("created_at", { ascending: true })

  if (saldosError) return { error: saldosError.message }

  let remaining = data.credito_aplicado
  for (const saldo of (saldos ?? [])) {
    if (remaining <= 0) break
    const use = Math.min(remaining, Number(saldo.monto_pagado))
    const newMonto = Number(saldo.monto_pagado) - use
    const { error } = newMonto === 0
      ? await supabase.from("pagos").delete().eq("id", saldo.id)
      : await supabase.from("pagos").update({ monto_pagado: newMonto }).eq("id", saldo.id)
    if (error) return { error: error.message }
    remaining -= use
  }

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

  if (error) return { error: error.message }

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
  if (!esStringNoVacio(data.estado)) return { error: "Estado inválido" }

  const supabase = createServerClient()

  const { error } = await supabase
    .from("pagos")
    .update({ monto_pagado: data.monto_pagado, estado: data.estado })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/pagos")
  return { success: true }
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
  if (data.aplicaciones.length === 0) return { error: "No hay aplicaciones para procesar" }
  if (!data.aplicaciones.every(a => esUUIDValido(a.pago_id) && esMontoValido(a.monto))) {
    return { error: "Hay una aplicación inválida (pago o monto)" }
  }

  const supabase = createServerClient()

  const totalAplicar = data.aplicaciones.reduce((s, a) => s + a.monto, 0)
  if (totalAplicar <= 0) return { error: "Nada para aplicar" }

  // Consumir "Saldo a favor" FIFO (misma lógica que crearGastoConCredito)
  const { data: saldos, error: saldosError } = await supabase
    .from("pagos")
    .select("id, monto_pagado")
    .eq("agente_id", data.agente_id)
    .eq("concepto", "Saldo a favor")
    .gt("monto_pagado", 0)
    .order("fecha", { ascending: true })
    .order("created_at", { ascending: true })

  if (saldosError) return { error: saldosError.message }

  const saldoDisponible = (saldos ?? []).reduce((s, x) => s + Number(x.monto_pagado), 0)
  if (totalAplicar > saldoDisponible + 0.01) {
    return { error: "El total a aplicar supera el saldo a favor disponible" }
  }

  let remaining = totalAplicar
  for (const saldo of (saldos ?? [])) {
    if (remaining <= 0) break
    const use = Math.min(remaining, Number(saldo.monto_pagado))
    const newMonto = Number(saldo.monto_pagado) - use
    const { error } = newMonto === 0
      ? await supabase.from("pagos").delete().eq("id", saldo.id)
      : await supabase.from("pagos").update({ monto_pagado: newMonto }).eq("id", saldo.id)
    if (error) return { error: error.message }
    remaining -= use
  }

  // Aplicar a cada pago pendiente seleccionado
  for (const ap of data.aplicaciones) {
    const { data: pago, error: fetchError } = await supabase
      .from("pagos")
      .select("monto_debe, monto_pagado")
      .eq("id", ap.pago_id)
      .single()

    if (fetchError || !pago) return { error: fetchError?.message ?? "Pago no encontrado" }

    const nuevoPagado = Number(pago.monto_pagado) + ap.monto
    const estado = nuevoPagado >= Number(pago.monto_debe) - 0.01 ? "Pagado" : "Parcial"

    const { error } = await supabase
      .from("pagos")
      .update({ monto_pagado: nuevoPagado, estado })
      .eq("id", ap.pago_id)

    if (error) return { error: error.message }
  }

  revalidatePath("/pagos")
  return { success: true }
}
