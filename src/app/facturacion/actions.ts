"use server"

import { createServerClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import { requireSession } from "@/lib/auth-guard"

export interface FacturacionFormData {
  mes:          number
  anio:         number
  objetivo_usd: number
  real_usd:     number
}

// ─────────────────────────────────────────────────────
//  GUARDAR FACTURACIÓN (upsert por mes+año)
// ─────────────────────────────────────────────────────
export async function guardarFacturacion(data: FacturacionFormData) {
  await requireSession()
  const supabase = createServerClient()

  // Verificar si ya existe registro para ese mes/año
  const { data: existing } = await supabase
    .from("facturacion")
    .select("id")
    .eq("mes",  data.mes)
    .eq("anio", data.anio)
    .maybeSingle()

  let error: string | undefined

  if (existing) {
    const { error: e } = await supabase
      .from("facturacion")
      .update({ objetivo_usd: data.objetivo_usd, real_usd: data.real_usd })
      .eq("id", existing.id)
    error = e?.message
  } else {
    const { error: e } = await supabase
      .from("facturacion")
      .insert({
        mes:          data.mes,
        anio:         data.anio,
        objetivo_usd: data.objetivo_usd,
        real_usd:     data.real_usd,
      })
    error = e?.message
  }

  if (error) return { error }

  revalidatePath("/facturacion")
  return { success: true }
}
