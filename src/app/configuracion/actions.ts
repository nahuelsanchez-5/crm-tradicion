"use server"

import { mensajeErrorDB } from "@/lib/errores"
import { createServerClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import { requireSession } from "@/lib/auth-guard"
import { esStringNoVacio, esArrayNoVacio } from "@/lib/validate"

export interface ConfigEntry {
  clave:   string
  valor:   string
  etiqueta: string
  grupo:   string
}

export async function guardarConfig(entries: ConfigEntry[]) {
  await requireSession()

  if (!esArrayNoVacio<ConfigEntry>(entries)) return { error: "No hay configuraciones para guardar" }
  // `valor` puede ir vacío (config en blanco); clave/etiqueta/grupo son requeridos.
  for (const e of entries) {
    if (!esStringNoVacio(e.clave) || !esStringNoVacio(e.etiqueta) || !esStringNoVacio(e.grupo)) {
      return { error: "Hay una configuración con datos inválidos" }
    }
    if (typeof e.valor !== "string" || e.valor.length > 2000) {
      return { error: `Valor inválido en "${e.etiqueta}"` }
    }
    if (!/^[a-z0-9_]{1,80}$/.test(e.clave)) {
      return { error: `Clave de configuración inválida: "${e.clave}"` }
    }
    // Montos, objetivos y porcentajes: solo números (punto decimal). Sin esto un "710.000" o "abc"
    // se guarda y los módulos que lo leen con parseFloat calculan mal (710.000 → 710).
    if (/^(obj_|bono_|fee_)/.test(e.clave) && e.valor.trim() !== "") {
      if (!/^\d+(\.\d+)?$/.test(e.valor.trim())) {
        return { error: `"${e.etiqueta}" debe ser un número sin separador de miles (ej: 710000 o 12.5)` }
      }
      if (e.clave.endsWith("_pct") && Number(e.valor) > 100) {
        return { error: `"${e.etiqueta}" no puede superar 100%` }
      }
    }
  }

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

  if (error) return { error: mensajeErrorDB(error) }

  revalidatePath("/configuracion")
  revalidatePath("/")
  return { success: true }
}

export async function getConfig(): Promise<ConfigEntry[]> {
  await requireSession()
  const supabase = createServerClient()

  const { data } = await supabase
    .from("config")
    .select("*")
    .order("grupo")
    .order("clave")

  return (data ?? []) as ConfigEntry[]
}
