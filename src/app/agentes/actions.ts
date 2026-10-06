"use server"

import { mensajeErrorDB } from "@/lib/errores"
import { createServerClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import { requireSession } from "@/lib/auth-guard"
import { hoyArgentina } from "@/lib/fecha"
import { esStringNoVacio, esFechaValida, esUUIDValido, esEmailValido } from "@/lib/validate"

// Validación compartida por crear/actualizar agente. email/telefono/plan/fecha_mainstreet son opcionales.
function validarAgente(data: AgenteFormData): string | null {
  if (!esStringNoVacio(data.nombre))     return "El nombre no puede estar vacío"
  if (!esFechaValida(data.fecha_alta))   return "Fecha de alta inválida"
  if (data.email && data.email.trim() && !esEmailValido(data.email)) return "Email inválido"
  if (data.fecha_mainstreet && !esFechaValida(data.fecha_mainstreet)) return "Fecha de Mainstreet inválida"
  return null
}

export interface AgenteFormData {
  nombre: string
  email: string
  telefono: string
  fecha_alta: string
  fecha_mainstreet?: string | null
  plan: string
  activo?: boolean
  /** null = automático (180 días de antigüedad); true/false = marcado a mano; undefined = no se toca */
  paga_fee?: boolean | null
}

// ─────────────────────────────────────────────────────
//  CREAR AGENTE
// ─────────────────────────────────────────────────────
export async function crearAgente(data: AgenteFormData) {
  await requireSession()

  const err = validarAgente(data)
  if (err) return { error: err }

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
      // Explícito: un agente nuevo es "automático" salvo que se elija otra cosa (no depender del default de la base)
      paga_fee:         data.paga_fee ?? null,
    })

  if (error) {
    return { error: mensajeErrorDB(error) }
  }

  revalidatePath("/agentes")
  return { success: true }
}

// ─────────────────────────────────────────────────────
//  ACTUALIZAR PAGA_FEE
// ─────────────────────────────────────────────────────
export async function actualizarPagaFee(id: string, pagaFee: boolean | null) {
  await requireSession()

  if (!esUUIDValido(id)) return { error: "ID de agente inválido" }

  const supabase = createServerClient()

  const { error } = await supabase
    .from("agentes")
    .update({ paga_fee: pagaFee })
    .eq("id", id)

  if (error) return { error: mensajeErrorDB(error) }

  revalidatePath("/agentes")
  revalidatePath("/pagos")
  return { success: true }
}

// ─────────────────────────────────────────────────────
//  ACTUALIZAR AGENTE
// ─────────────────────────────────────────────────────
export async function actualizarAgente(id: string, data: AgenteFormData) {
  await requireSession()

  if (!esUUIDValido(id)) return { error: "ID de agente inválido" }
  const err = validarAgente(data)
  if (err) return { error: err }

  if (data.paga_fee !== undefined && data.paga_fee !== null && typeof data.paga_fee !== "boolean") {
    return { error: "Valor de Paga FEE inválido" }
  }

  const supabase = createServerClient()

  // Un solo valor para activo: antes `activo ?? true` y `activo ? ... : hoy` podían discrepar
  // (activo undefined dejaba al agente activo pero con fecha de baja de hoy).
  const activo = data.activo ?? true

  const { error } = await supabase
    .from("agentes")
    .update({
      nombre:           data.nombre.trim(),
      email:            data.email.trim()    || null,
      telefono:         data.telefono.trim() || null,
      activo,
      fecha_alta:       data.fecha_alta,
      fecha_mainstreet: data.fecha_mainstreet || null,
      fecha_baja:       activo ? null : hoyArgentina(),
      tipo_plan:        data.plan || null,
      // Solo si viene en el formulario; null vuelve al modo automático
      ...(data.paga_fee !== undefined ? { paga_fee: data.paga_fee } : {}),
    })
    .eq("id", id)

  if (error) return { error: mensajeErrorDB(error) }

  revalidatePath("/agentes")
  return { success: true }
}
