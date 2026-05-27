"use server"

import { createServerClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

const MES  = 5
const ANIO = 2026

export interface AgenteFormData {
  nombre: string
  email: string
  telefono: string
  fecha_alta: string
  plan: string
  activo?: boolean
}

// ─────────────────────────────────────────────────────
//  CREAR AGENTE
// ─────────────────────────────────────────────────────
export async function crearAgente(data: AgenteFormData) {
  const supabase = createServerClient()

  const { data: agente, error } = await supabase
    .from("agentes")
    .insert({
      nombre:     data.nombre.trim(),
      email:      data.email.trim()    || null,
      telefono:   data.telefono.trim() || null,
      fecha_alta: data.fecha_alta,
      activo:     true,
    })
    .select("id")
    .single()

  if (error || !agente) {
    return { error: error?.message ?? "Error al crear el agente" }
  }

  // Plan del mes actual
  const { error: planError } = await supabase.from("planes_crm").insert({
    agente_id: agente.id,
    mes:       MES,
    anio:      ANIO,
    tipo_plan: data.plan,
    pagado:    false,
  })

  if (planError) return { error: planError.message }

  revalidatePath("/agentes")
  return { success: true }
}

// ─────────────────────────────────────────────────────
//  ACTUALIZAR AGENTE
// ─────────────────────────────────────────────────────
export async function actualizarAgente(id: string, data: AgenteFormData) {
  const supabase = createServerClient()

  // 1. Actualizar datos del agente
  const { error } = await supabase
    .from("agentes")
    .update({
      nombre:     data.nombre.trim(),
      email:      data.email.trim()    || null,
      telefono:   data.telefono.trim() || null,
      activo:     data.activo ?? true,
      fecha_baja: data.activo ? null : new Date().toISOString().split("T")[0],
    })
    .eq("id", id)

  if (error) return { error: error.message }

  // 2. Actualizar o crear plan del mes actual (sin tocar 'pagado')
  const { data: planExistente } = await supabase
    .from("planes_crm")
    .select("id")
    .eq("agente_id", id)
    .eq("mes", MES)
    .eq("anio", ANIO)
    .maybeSingle()

  if (planExistente) {
    await supabase
      .from("planes_crm")
      .update({ tipo_plan: data.plan })
      .eq("id", planExistente.id)
  } else {
    await supabase.from("planes_crm").insert({
      agente_id: id,
      mes:       MES,
      anio:      ANIO,
      tipo_plan: data.plan,
      pagado:    false,
    })
  }

  revalidatePath("/agentes")
  return { success: true }
}
