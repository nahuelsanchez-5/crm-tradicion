"use server"

import { createServerClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

export interface ConfigEntry {
  clave:   string
  valor:   string
  etiqueta: string
  grupo:   string
}

export async function guardarConfig(entries: ConfigEntry[]) {
  const supabase = createServerClient()

  const upserts = entries.map(e => ({
    clave:    e.clave,
    valor:    e.valor,
    etiqueta: e.etiqueta,
    grupo:    e.grupo,
  }))

  const { error } = await supabase
    .from("config")
    .upsert(upserts, { onConflict: "clave" })

  if (error) return { error: error.message }

  revalidatePath("/configuracion")
  revalidatePath("/")
  return { success: true }
}

export async function getConfig(): Promise<ConfigEntry[]> {
  const supabase = createServerClient()

  const { data } = await supabase
    .from("config")
    .select("clave, valor, etiqueta, grupo")
    .order("grupo")
    .order("clave")

  return (data ?? []) as ConfigEntry[]
}
