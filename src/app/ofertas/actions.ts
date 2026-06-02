"use server"

import { createServerClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import { CHECKLIST_ITEMS } from "./checklist-items"

// ── Types ─────────────────────────────────────────────
export interface OfertaFormData {
  numero: number
  direccion: string
  agente_vendedor_id: string | null
  agente_comprador_id: string | null
  agente_vendedor_externo: string | null
  agente_comprador_externo: string | null
  tipologia: string
  tipo_operacion: string
  tiene_reserva: boolean
  monto_reserva_usd: number | null
  monto_ofertado_usd: number | null
  precio_publicacion_usd: number | null
  fecha_oferta: string
  es_bis: boolean
  numero_padre: number | null
  notas: string | null
}

// ── Actions ───────────────────────────────────────────

export async function crearOferta(
  data: OfertaFormData,
): Promise<{ error?: string; id?: string }> {
  const supabase = createServerClient()

  const { data: oferta, error } = await supabase
    .from("ofertas")
    .insert({
      numero:                  data.numero,
      agente_vendedor_id:      data.agente_vendedor_id   || null,
      agente_comprador_id:     data.agente_comprador_id  || null,
      agente_vendedor_externo: data.agente_vendedor_externo || null,
      agente_comprador_externo:data.agente_comprador_externo || null,
      direccion:               data.direccion,
      tipologia:               data.tipologia,
      tipo_operacion:          data.tipo_operacion,
      tiene_reserva:           data.tiene_reserva,
      monto_reserva_usd:       data.monto_reserva_usd   ?? null,
      monto_ofertado_usd:      data.monto_ofertado_usd  ?? null,
      precio_publicacion_usd:  data.precio_publicacion_usd ?? null,
      fecha_oferta:            data.fecha_oferta,
      estado:                  "Espera rta. vendedor",
      es_bis:                  data.es_bis,
      numero_padre:            data.numero_padre         ?? null,
      notas:                   data.notas                || null,
      comision_cobrada:        false,
      checklist_completado:    false,
    })
    .select("id")
    .single()

  if (error) return { error: error.message }

  await supabase.from("ofertas_historial").insert({
    oferta_id:   oferta.id,
    tipo:        "Alta",
    descripcion: "Oferta creada",
    monto_usd:   null,
  })

  if (data.tipo_operacion === "Venta") {
    await supabase.from("ofertas_checklist").insert(
      CHECKLIST_ITEMS.map(ci => ({
        oferta_id:  oferta.id,
        item:       ci.item,
        completado: false,
        orden:      ci.orden,
      })),
    )
  }

  revalidatePath("/ofertas")
  return { id: oferta.id }
}

export async function cambiarEstado(
  id: string,
  nuevoEstado: string,
  descripcion: string,
  monto?: number | null,
): Promise<{ error?: string }> {
  const supabase = createServerClient()

  const updates: Record<string, unknown> = { estado: nuevoEstado }
  if (nuevoEstado === "Cerradas") {
    updates.fecha_cierre = new Date().toISOString().split("T")[0]
  }

  const { error } = await supabase.from("ofertas").update(updates).eq("id", id)
  if (error) return { error: error.message }

  await supabase.from("ofertas_historial").insert({
    oferta_id:   id,
    tipo:        "Cambio de estado",
    descripcion: `${nuevoEstado} — ${descripcion}`,
    monto_usd:   monto ?? null,
  })

  revalidatePath("/ofertas")
  revalidatePath(`/ofertas/${id}`)
  return {}
}

export async function agregarMovimiento(
  ofertaId: string,
  tipo: string,
  descripcion: string,
  monto?: number | null,
): Promise<{ error?: string }> {
  const supabase = createServerClient()

  const { error } = await supabase.from("ofertas_historial").insert({
    oferta_id:   ofertaId,
    tipo,
    descripcion,
    monto_usd:   monto ?? null,
  })

  if (error) return { error: error.message }

  revalidatePath(`/ofertas/${ofertaId}`)
  return {}
}

export async function toggleChecklist(
  checklistId: string,
  ofertaId: string,
  completado: boolean,
): Promise<{ error?: string }> {
  const supabase = createServerClient()

  const { error } = await supabase
    .from("ofertas_checklist")
    .update({ completado })
    .eq("id", checklistId)

  if (error) return { error: error.message }

  revalidatePath(`/ofertas/${ofertaId}`)
  return {}
}
