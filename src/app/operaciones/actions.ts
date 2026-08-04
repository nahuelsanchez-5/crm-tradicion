"use server"

import { createServerClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import { requireSession } from "@/lib/auth-guard"
import { esStringNoVacio, esFechaValida, esUUIDValido, esNumeroNoNegativo } from "@/lib/validate"

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

// Validación compartida por crear/actualizar. `agentes` puede ir vacío (op sin agente asignado).
function validarOperacion(data: OperacionFormData): string | null {
  if (!esFechaValida(data.fecha))               return "Fecha inválida"
  if (!esStringNoVacio(data.direccion))         return "La dirección no puede estar vacía"
  if (!esStringNoVacio(data.tipo))              return "El tipo de operación no puede estar vacío"
  if (!esNumeroNoNegativo(data.comision_bruta)) return "La comisión bruta debe ser un número mayor o igual a 0"
  if (!esNumeroNoNegativo(data.comision_neta))  return "La comisión neta debe ser un número mayor o igual a 0"
  return null
}

// ─────────────────────────────────────────────────────
//  CREAR OPERACIÓN
// ─────────────────────────────────────────────────────
export async function crearOperacion(data: OperacionFormData) {
  await requireSession()

  const err = validarOperacion(data)
  if (err) return { error: err }

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
  await requireSession()

  if (!esUUIDValido(id)) return { error: "ID de operación inválido" }
  const err = validarOperacion(data)
  if (err) return { error: err }

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
  await requireSession()

  if (!esUUIDValido(id)) return { error: "ID de operación inválido" }

  const supabase = createServerClient()
  const { error } = await supabase.from("operaciones").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/operaciones")
  revalidatePath("/")
  return {}
}
