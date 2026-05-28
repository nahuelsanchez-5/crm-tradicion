"use server"

import { createServerClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

export interface CarteleriaFormData {
  mes:         number
  anio:        number
  entregados:  number
  recuperados: number
}

export async function guardarCarteleria(data: CarteleriaFormData) {
  const supabase = createServerClient()

  const { data: existing } = await supabase
    .from("carteleria")
    .select("id")
    .eq("mes",  data.mes)
    .eq("anio", data.anio)
    .maybeSingle()

  let error: string | undefined

  if (existing) {
    const { error: e } = await supabase
      .from("carteleria")
      .update({ entregados: data.entregados, recuperados: data.recuperados })
      .eq("id", existing.id)
    error = e?.message
  } else {
    const { error: e } = await supabase
      .from("carteleria")
      .insert({
        mes:         data.mes,
        anio:        data.anio,
        entregados:  data.entregados,
        recuperados: data.recuperados,
      })
    error = e?.message
  }

  if (error) return { error }

  revalidatePath("/carteleria")
  return { success: true }
}
