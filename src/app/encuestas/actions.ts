"use server"

import { createServerClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

export interface EncuestaFormData {
  mes:          number
  anio:         number
  enviadas:     number
  respondidas:  number
  nps_promedio: number | null
}

export async function guardarEncuesta(data: EncuestaFormData) {
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
      .update({
        enviadas:     data.enviadas,
        respondidas:  data.respondidas,
        nps_promedio: data.nps_promedio,
      })
      .eq("id", existing.id)
    error = e?.message
  } else {
    const { error: e } = await supabase
      .from("encuestas")
      .insert({
        mes:          data.mes,
        anio:         data.anio,
        enviadas:     data.enviadas,
        respondidas:  data.respondidas,
        nps_promedio: data.nps_promedio,
      })
    error = e?.message
  }

  if (error) return { error }

  revalidatePath("/encuestas")
  return { success: true }
}
