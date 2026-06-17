"use server"

import { createServerClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

export async function marcarSeguimiento(ofertaId: string): Promise<{ error?: string }> {
  const supabase = createServerClient()

  const { error } = await supabase.from("ofertas_historial").insert({
    oferta_id:   ofertaId,
    tipo:        "Seguimiento forzado",
    descripcion: "Seguimiento registrado desde Calendario",
    monto_usd:   null,
  })

  if (error) return { error: error.message }

  revalidatePath("/calendario")
  return {}
}
