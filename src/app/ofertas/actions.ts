"use server"

import { createServerClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

// ── Checklist (36 items) ─────────────────────────────
export const CHECKLIST_ITEMS: Array<{
  orden: number
  item: string
  categoria: "pre_sena" | "documentacion" | "post_cierre"
}> = [
  { orden: 1,  item: "Tipo USD y color de billete confirmado",               categoria: "pre_sena" },
  { orden: 2,  item: "Instrumento legal definido (Boleto/Escritura directa)", categoria: "pre_sena" },
  { orden: 3,  item: "Monto a escriturar acordado",                          categoria: "pre_sena" },
  { orden: 4,  item: "Libre de ocupantes confirmado",                        categoria: "pre_sena" },
  { orden: 5,  item: "Fecha de entrega definida",                            categoria: "pre_sena" },
  { orden: 6,  item: "Forma de pago definida (Contado/Cuotas/Crédito)",      categoria: "pre_sena" },
  { orden: 7,  item: "Revisión con legales",                                 categoria: "pre_sena" },
  { orden: 8,  item: "Revisión con escribanos",                              categoria: "pre_sena" },
  { orden: 9,  item: "Estado cuenta Secheep",                                categoria: "pre_sena" },
  { orden: 10, item: "Estado cuenta Sameep",                                 categoria: "pre_sena" },
  { orden: 11, item: "Impuestos municipales al día",                         categoria: "pre_sena" },
  { orden: 12, item: "Certificado Catastral",                                categoria: "pre_sena" },
  { orden: 13, item: "Cierre en RED REMAX",                                  categoria: "documentacion" },
  { orden: 14, item: "Facturación emitida",                                  categoria: "documentacion" },
  { orden: 15, item: "Carga en Drive",                                       categoria: "documentacion" },
  { orden: 16, item: "Cierre en Q&R",                                        categoria: "documentacion" },
  { orden: 17, item: "Encuesta experiencia REMAX comprador",                 categoria: "documentacion" },
  { orden: 18, item: "Encuesta experiencia REMAX vendedor",                  categoria: "documentacion" },
  { orden: 19, item: "Comisión cobrada completa",                            categoria: "documentacion" },
  { orden: 20, item: "Recibo firmado comprador",                             categoria: "documentacion" },
  { orden: 21, item: "Recibo firmado vendedor",                              categoria: "documentacion" },
  { orden: 22, item: "Documentación en carpeta física",                      categoria: "documentacion" },
  { orden: 23, item: "Notificación a administración",                        categoria: "post_cierre" },
  { orden: 24, item: "Actualización en planilla KPI",                        categoria: "post_cierre" },
  { orden: 25, item: "Feedback al agente",                                   categoria: "post_cierre" },
  { orden: 26, item: "Carta de agradecimiento enviada",                      categoria: "post_cierre" },
  { orden: 27, item: "Publicación dada de baja en portales",                 categoria: "post_cierre" },
  { orden: 28, item: "MLS actualizado",                                      categoria: "post_cierre" },
  { orden: 29, item: "Fotos archivadas en Drive",                            categoria: "post_cierre" },
  { orden: 30, item: "Contrato escaneado",                                   categoria: "post_cierre" },
  { orden: 31, item: "Boleto/Escritura escaneada",                           categoria: "post_cierre" },
  { orden: 32, item: "Liquidación de comisión enviada",                      categoria: "post_cierre" },
  { orden: 33, item: "Archivo en base histórica",                            categoria: "post_cierre" },
  { orden: 34, item: "Control de calidad completado",                        categoria: "post_cierre" },
  { orden: 35, item: "Nota interna registrada",                              categoria: "post_cierre" },
  { orden: 36, item: "Cierre confirmado en sistema",                         categoria: "post_cierre" },
]

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
