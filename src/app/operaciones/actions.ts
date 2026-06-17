"use server"

import { createServerClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

export interface OperacionFormData {
  fecha:              string
  direccion:          string
  agentes:            string
  tipo:               string
  comision_bruta:     number
  comision_neta:      number
  encuesta_comprador: boolean
  encuesta_vendedor:  boolean
}

// ─────────────────────────────────────────────────────
//  CREAR OPERACIÓN
// ─────────────────────────────────────────────────────
export async function crearOperacion(data: OperacionFormData) {
  const supabase = createServerClient()

  const { error } = await supabase.from("operaciones").insert({
    fecha:              data.fecha,
    direccion:          data.direccion,
    agentes:            data.agentes,
    tipo:               data.tipo,
    comision_bruta:     data.comision_bruta,
    comision_neta:      data.comision_neta,
    encuesta_comprador: data.encuesta_comprador,
    encuesta_vendedor:  data.encuesta_vendedor,
  })

  if (error) return { error: error.message }

  revalidatePath("/operaciones")
  return { success: true }
}

// ─────────────────────────────────────────────────────
//  ACTUALIZAR OPERACIÓN
// ─────────────────────────────────────────────────────
export async function actualizarOperacion(id: string, data: OperacionFormData) {
  const supabase = createServerClient()

  const { error } = await supabase
    .from("operaciones")
    .update({
      fecha:              data.fecha,
      direccion:          data.direccion,
      agentes:            data.agentes,
      tipo:               data.tipo,
      comision_bruta:     data.comision_bruta,
      comision_neta:      data.comision_neta,
      encuesta_comprador: data.encuesta_comprador,
      encuesta_vendedor:  data.encuesta_vendedor,
    })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/operaciones")
  return { success: true }
}

// ─────────────────────────────────────────────────────
//  ELIMINAR OPERACIÓN
// ─────────────────────────────────────────────────────
export async function eliminarOperacion(id: string): Promise<{ error?: string }> {
  const supabase = createServerClient()
  const { error } = await supabase.from("operaciones").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/operaciones")
  revalidatePath("/")
  return {}
}
