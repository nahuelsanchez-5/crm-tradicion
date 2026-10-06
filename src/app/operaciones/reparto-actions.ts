"use server"

import { createServerClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import { requireSession } from "@/lib/auth-guard"
import { esUUIDValido } from "@/lib/validate"
import { mensajeErrorDB } from "@/lib/errores"
import {
  armarFilasValidadas,
  reconstruirDesdeFilas,
  type FilaReparto,
  type RepartoData,
} from "@/lib/reparto"

const SIN_TABLA = "Todavía no está creada la tabla del reparto en la base. Hay que correr el script docs/sql/A2_operacion_comisiones.sql en Supabase."

function esTablaFaltante(error: { code?: string } | null): boolean {
  // 42P01 = tabla inexistente (Postgres); PGRST205 = tabla fuera del esquema (PostgREST)
  return error?.code === "42P01" || error?.code === "PGRST205"
}

// Reemplaza el reparto de una operación. Inserta lo nuevo antes de borrar lo viejo: si algo falla, lo anterior queda intacto.
export async function guardarReparto(operacionId: string, data: RepartoData): Promise<{ error?: string; success?: true }> {
  await requireSession()
  if (!esUUIDValido(operacionId)) return { error: "ID de operación inválido" }

  const supabase = createServerClient()
  const { data: op, error: opErr } = await supabase
    .from("operaciones").select("comision_bruta").eq("id", operacionId).maybeSingle()
  if (opErr) return { error: mensajeErrorDB(opErr, "leer la operación") }
  if (!op) return { error: "Operación no encontrada" }

  const { filas, error } = armarFilasValidadas(Number(op.comision_bruta), data)
  if (error || !filas) return { error }

  const { data: previas, error: prevErr } = await supabase
    .from("operacion_comisiones").select("id").eq("operacion_id", operacionId)
  if (esTablaFaltante(prevErr)) return { error: SIN_TABLA }
  if (prevErr) return { error: mensajeErrorDB(prevErr) }

  const { error: insErr } = await supabase
    .from("operacion_comisiones").insert(filas.map((f) => ({ ...f, operacion_id: operacionId })))
  if (insErr) return { error: mensajeErrorDB(insErr) }

  const ids = (previas ?? []).map((p) => p.id as string)
  if (ids.length > 0) {
    const { error: delErr } = await supabase.from("operacion_comisiones").delete().in("id", ids)
    if (delErr) return { error: mensajeErrorDB(delErr) }
  }

  revalidatePath("/operaciones")
  revalidatePath("/agentes")
  return { success: true }
}

// Reparto guardado de una operación, listo para reabrir en el editor.
export async function obtenerReparto(operacionId: string): Promise<{ reparto?: RepartoData; guardado: boolean; error?: string }> {
  await requireSession()
  if (!esUUIDValido(operacionId)) return { guardado: false, error: "ID de operación inválido" }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("operacion_comisiones")
    .select("agente_id, agente_externo, rol, porcentaje, de_agente_id, monto_usd, informativo")
    .eq("operacion_id", operacionId)
  if (esTablaFaltante(error)) return { guardado: false, error: SIN_TABLA }
  if (error) return { guardado: false, error: mensajeErrorDB(error) }
  if (!data || data.length === 0) return { guardado: false }

  const filas: FilaReparto[] = data.map((r) => ({
    agente_id: r.agente_id as string | null,
    agente_externo: r.agente_externo as string | null,
    rol: r.rol as FilaReparto["rol"],
    porcentaje: r.porcentaje == null ? null : Number(r.porcentaje),
    de_agente_id: r.de_agente_id as string | null,
    monto_usd: Number(r.monto_usd),
    informativo: Boolean(r.informativo),
  }))
  return { reparto: reconstruirDesdeFilas(filas), guardado: true }
}
