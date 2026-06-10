"use server"

import { createServerClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

export interface AgenteFormData {
  nombre: string
  email: string
  telefono: string
  fecha_alta: string
  fecha_mainstreet?: string | null
  plan: string
  activo?: boolean
}

// ─────────────────────────────────────────────────────
//  CREAR AGENTE
// ─────────────────────────────────────────────────────
export async function crearAgente(data: AgenteFormData) {
  const supabase = createServerClient()

  const { error } = await supabase
    .from("agentes")
    .insert({
      nombre:           data.nombre.trim(),
      email:            data.email.trim()    || null,
      telefono:         data.telefono.trim() || null,
      fecha_alta:       data.fecha_alta,
      fecha_mainstreet: data.fecha_mainstreet || null,
      tipo_plan:        data.plan || null,
      activo:           true,
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/agentes")
  return { success: true }
}

// ─────────────────────────────────────────────────────
//  ACTUALIZAR PAGA_FEE
// ─────────────────────────────────────────────────────
export async function actualizarPagaFee(id: string, pagaFee: boolean) {
  const supabase = createServerClient()

  const { error } = await supabase
    .from("agentes")
    .update({ paga_fee: pagaFee })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/agentes")
  revalidatePath("/pagos")
  return { success: true }
}

// ─────────────────────────────────────────────────────
//  ACTUALIZAR AGENTE
// ─────────────────────────────────────────────────────
export async function actualizarAgente(id: string, data: AgenteFormData) {
  const supabase = createServerClient()

  const { error } = await supabase
    .from("agentes")
    .update({
      nombre:           data.nombre.trim(),
      email:            data.email.trim()    || null,
      telefono:         data.telefono.trim() || null,
      activo:           data.activo ?? true,
      fecha_alta:       data.fecha_alta,
      fecha_mainstreet: data.fecha_mainstreet || null,
      fecha_baja:       data.activo ? null : new Date().toISOString().split("T")[0],
      tipo_plan:        data.plan || null,
    })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/agentes")
  return { success: true }
}
