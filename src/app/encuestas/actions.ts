"use server"

import { createServerClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import { requireSession } from "@/lib/auth-guard"
import { esStringNoVacio, esFechaValida, esUUIDValido, esNumeroNoNegativo, esEnteroEnRango, esUnoDe } from "@/lib/validate"

// ── Migration note ──────────────────────────────────
// This module uses a new table. Run in Supabase SQL Editor:
//
// CREATE TABLE IF NOT EXISTS encuestas_registros (
//   id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   fecha       date NOT NULL DEFAULT CURRENT_DATE,
//   tipo        text NOT NULL,   -- 'ESPONTANEA' | 'MAILING'
//   subtipo     text,            -- 'Comprador' | 'Vendedor' (ESPONTANEA)
//   referencia  text NOT NULL,   -- oferta numero (ESPONTANEA) | agente nombre (MAILING)
//   nps         integer CHECK (nps >= -100 AND nps <= 100),
//   comentario  text,
//   created_at  timestamptz DEFAULT now()
// );

export interface RegistroEncuestaData {
  fecha:      string
  tipo:       "ESPONTANEA" | "MAILING"
  subtipo:    string | null
  referencia: string
  nps:        number | null
  comentario: string
}

export interface EditarEncuestaData {
  fecha:      string
  tipo:       "ESPONTANEA" | "MAILING"
  subtipo:    string | null
  referencia: string
  nps:        number | null
  comentario: string
}

export async function registrarEncuesta(data: RegistroEncuestaData) {
  await requireSession()

  if (!esFechaValida(data.fecha))                     return { error: "Fecha inválida" }
  if (!esUnoDe(data.tipo, ["ESPONTANEA", "MAILING"])) return { error: "Tipo de encuesta inválido" }
  if (!esStringNoVacio(data.referencia))              return { error: "La referencia no puede estar vacía" }
  if (data.nps != null && !esEnteroEnRango(data.nps, -100, 100)) return { error: "El NPS debe estar entre -100 y 100" }

  const supabase = createServerClient()

  const { error } = await supabase.from("encuestas_registros").insert({
    fecha:      data.fecha,
    tipo:       data.tipo,
    subtipo:    data.subtipo || null,
    referencia: data.referencia.trim(),
    nps:        data.nps,
    comentario: data.comentario.trim() || null,
  })

  if (error) return { error: error.message }

  revalidatePath("/encuestas")
  return { success: true }
}

export async function editarEncuesta(id: string, data: EditarEncuestaData) {
  await requireSession()

  if (!esUUIDValido(id))                              return { error: "ID de encuesta inválido" }
  if (!esFechaValida(data.fecha))                     return { error: "Fecha inválida" }
  if (!esUnoDe(data.tipo, ["ESPONTANEA", "MAILING"])) return { error: "Tipo de encuesta inválido" }
  if (!esStringNoVacio(data.referencia))              return { error: "La referencia no puede estar vacía" }
  if (data.nps != null && !esEnteroEnRango(data.nps, -100, 100)) return { error: "El NPS debe estar entre -100 y 100" }

  const supabase = createServerClient()
  const { error } = await supabase
    .from("encuestas_registros")
    .update({
      fecha:      data.fecha,
      tipo:       data.tipo,
      subtipo:    data.subtipo || null,
      referencia: data.referencia.trim(),
      nps:        data.nps,
      comentario: data.comentario.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("eliminado", false)
  if (error) return { error: error.message }
  revalidatePath("/encuestas")
  return { success: true }
}

export async function eliminarEncuesta(id: string) {
  await requireSession()

  if (!esUUIDValido(id)) return { error: "ID de encuesta inválido" }

  const supabase = createServerClient()
  const { error } = await supabase
    .from("encuestas_registros")
    .update({ eliminado: true, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/encuestas")
  return { success: true }
}

// ── Legacy — kept for backwards compat ──────────────
export interface EncuestaFormData {
  mes:          number
  anio:         number
  enviadas:     number
  respondidas:  number
  nps_promedio: number | null
}

export async function guardarEncuesta(data: EncuestaFormData) {
  await requireSession()

  if (!esEnteroEnRango(data.mes, 1, 12))         return { error: "Mes inválido" }
  if (!esEnteroEnRango(data.anio, 2000, 2100))   return { error: "Año inválido" }
  if (!esNumeroNoNegativo(data.enviadas))        return { error: "El total de enviadas debe ser un número mayor o igual a 0" }
  if (!esNumeroNoNegativo(data.respondidas))     return { error: "El total de respondidas debe ser un número mayor o igual a 0" }
  // nps_promedio es un promedio nullable que puede ser negativo (no aplica esNumeroNoNegativo)
  if (data.nps_promedio != null && (typeof data.nps_promedio !== "number" || !isFinite(data.nps_promedio))) {
    return { error: "NPS promedio inválido" }
  }

  const supabase = createServerClient()

  const { data: existing } = await supabase
    .from("encuestas")
    .select("id")
    .eq("mes",  data.mes)
    .eq("anio", data.anio)
    .maybeSingle()

  let error: string | undefined

  if (existing) {
    const { error: e } = await supabase
      .from("encuestas")
      .update({ enviadas: data.enviadas, respondidas: data.respondidas, nps_promedio: data.nps_promedio })
      .eq("id", existing.id)
    error = e?.message
  } else {
    const { error: e } = await supabase
      .from("encuestas")
      .insert({ mes: data.mes, anio: data.anio, enviadas: data.enviadas, respondidas: data.respondidas, nps_promedio: data.nps_promedio })
    error = e?.message
  }

  if (error) return { error }

  revalidatePath("/encuestas")
  return { success: true }
}
