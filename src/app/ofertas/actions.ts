"use server"

import { mensajeErrorDB } from "@/lib/errores"
import { createServerClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import { CHECKLIST_ITEMS } from "./checklist-items"
import { requireSession } from "@/lib/auth-guard"
import { hoyArgentina } from "@/lib/fecha"
import { esStringNoVacio, esFechaValida, esUUIDValido, esMontoValido, esNumeroNoNegativo, esEnteroPositivo, esUnoDe } from "@/lib/validate"
import { ESTADOS_OFERTA, TIPOLOGIAS_VALIDAS, TIPOS_OPERACION_OFERTA_VALIDOS } from "@/lib/constantes"
import { armarOperacionDeOferta } from "@/lib/cierre"
import { armarFilasValidadas, type FilaReparto, type RefExterno, type RefInterno } from "@/lib/reparto"

// ── Types ─────────────────────────────────────────────
export interface EditarOfertaData {
  direccion:                string
  tipologia:                string
  tipo_operacion:           string
  agente_vendedor_id:       string | null
  agente_comprador_id:      string | null
  agente_vendedor_externo:  string | null
  agente_comprador_externo: string | null
  monto_ofertado_usd:       number | null
  precio_publicacion_usd:   number | null
  precio_acordado_usd:      number | null
  valor_escritura_usd:      number | null
  monto_reserva_usd:        number | null
  monto_refuerzo_usd:       number | null
  tiene_reserva:            boolean
  es_bis:                   boolean
  numero_padre:             number | null
  notas:                    string | null
}

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
  await requireSession()

  if (!esEnteroPositivo(data.numero))          return { error: "Número de oferta inválido" }
  if (!esStringNoVacio(data.direccion))        return { error: "La dirección no puede estar vacía" }
  if (!esUnoDe(data.tipologia, TIPOLOGIAS_VALIDAS))                   return { error: "Tipología inválida" }
  if (!esUnoDe(data.tipo_operacion, TIPOS_OPERACION_OFERTA_VALIDOS))  return { error: "Tipo de operación inválido" }
  if (!esFechaValida(data.fecha_oferta))       return { error: "Fecha de oferta inválida" }
  if (data.agente_vendedor_id  && !esUUIDValido(data.agente_vendedor_id))  return { error: "Agente vendedor inválido" }
  if (data.agente_comprador_id && !esUUIDValido(data.agente_comprador_id)) return { error: "Agente comprador inválido" }
  if (data.monto_reserva_usd      != null && !esNumeroNoNegativo(data.monto_reserva_usd))      return { error: "Monto de reserva inválido" }
  if (data.monto_ofertado_usd     != null && !esNumeroNoNegativo(data.monto_ofertado_usd))     return { error: "Monto ofertado inválido" }
  if (data.precio_publicacion_usd != null && !esNumeroNoNegativo(data.precio_publicacion_usd)) return { error: "Precio de publicación inválido" }
  if (data.numero_padre           != null && !esEnteroPositivo(data.numero_padre))             return { error: "Número padre inválido" }

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

  if (error) return { error: mensajeErrorDB(error) }

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
  await requireSession()

  if (!esUUIDValido(id))              return { error: "ID de oferta inválido" }
  if (!esUnoDe(nuevoEstado, ESTADOS_OFERTA)) return { error: "Estado inválido" }
  if (monto != null && !esNumeroNoNegativo(monto)) return { error: "Monto inválido" }
  // Cerrar una oferta genera su operación y el reparto de comisiones: solo se hace con "Registrar cierre"
  // (cerrarOferta). Cambiar el estado a "Cerradas" a secas dejaba ofertas cerradas sin su comisión.
  if (nuevoEstado === "Cerradas") return { error: "Para cerrar una oferta usá «Registrar cierre» (hay que cargar precio y reparto)." }

  const supabase = createServerClient()

  const updates: Record<string, unknown> = { estado: nuevoEstado }

  const { error } = await supabase.from("ofertas").update(updates).eq("id", id)
  if (error) return { error: mensajeErrorDB(error) }

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
  await requireSession()

  if (!esUUIDValido(ofertaId))       return { error: "ID de oferta inválido" }
  if (!esStringNoVacio(tipo))        return { error: "El tipo de movimiento no puede estar vacío" }
  if (!esStringNoVacio(descripcion)) return { error: "La descripción no puede estar vacía" }
  if (monto != null && !esNumeroNoNegativo(monto)) return { error: "Monto inválido" }

  const supabase = createServerClient()

  const { error } = await supabase.from("ofertas_historial").insert({
    oferta_id:   ofertaId,
    tipo,
    descripcion,
    monto_usd:   monto ?? null,
  })

  if (error) return { error: mensajeErrorDB(error) }

  revalidatePath(`/ofertas/${ofertaId}`)
  return {}
}

export async function toggleChecklist(
  checklistId: string,
  ofertaId: string,
  completado: boolean,
): Promise<{ error?: string }> {
  await requireSession()

  if (!esUUIDValido(checklistId)) return { error: "ID de checklist inválido" }
  if (!esUUIDValido(ofertaId))    return { error: "ID de oferta inválido" }

  const supabase = createServerClient()

  const { error } = await supabase
    .from("ofertas_checklist")
    .update({ completado })
    .eq("id", checklistId)

  if (error) return { error: mensajeErrorDB(error) }

  revalidatePath(`/ofertas/${ofertaId}`)
  return {}
}

export async function registrarCierre(
  ofertaId: string,
  fecha: string,
  precioCierre: number,
): Promise<{ error?: string }> {
  await requireSession()

  if (!esUUIDValido(ofertaId))       return { error: "ID de oferta inválido" }
  if (!esFechaValida(fecha))         return { error: "Fecha de cierre inválida" }
  if (!esMontoValido(precioCierre))  return { error: "El precio de cierre debe ser un número mayor a 0" }

  const supabase = createServerClient()

  const { error: ofertaError } = await supabase
    .from("ofertas")
    .update({ estado: "Cerradas", fecha_cierre: fecha, valor_escritura_usd: precioCierre })
    .eq("id", ofertaId)
  if (ofertaError) return { error: mensajeErrorDB(ofertaError) }

  await supabase.from("ofertas_historial").insert({
    oferta_id:   ofertaId,
    tipo:        "Cambio de estado",
    descripcion: `Cerradas — Precio de cierre: USD ${Math.round(precioCierre).toLocaleString("es-AR")}`,
    monto_usd:   precioCierre,
  })

  revalidatePath("/ofertas")
  revalidatePath(`/ofertas/${ofertaId}`)
  revalidatePath("/operaciones")
  revalidatePath("/")
  return {}
}

// ─────────────────────────────────────────────────────
//  CERRAR OFERTA (todo o nada): oferta + historial + operación + reparto
// ─────────────────────────────────────────────────────
// Una sola transacción en la base (función cerrar_oferta, script A5). Si falla cualquier paso no queda nada a medias.
// Mientras la función no exista, se cae al método anterior en pasos separados.
export async function cerrarOferta(
  ofertaId: string,
  fecha: string,
  precio: number,
  reparto: { refInt?: RefInterno[]; refExt?: RefExterno[] },
): Promise<{ error?: string; aviso?: string; operacionId?: string }> {
  await requireSession()

  if (!esUUIDValido(ofertaId)) return { error: "ID de oferta inválido" }
  if (!esFechaValida(fecha))   return { error: "Fecha de cierre inválida" }
  if (!esMontoValido(precio))  return { error: "El precio de cierre debe ser un número mayor a 0" }

  const supabase = createServerClient()

  const { data: oferta, error: ofertaErr } = await supabase.from("ofertas").select("*").eq("id", ofertaId).maybeSingle()
  if (ofertaErr) return { error: mensajeErrorDB(ofertaErr, "leer la oferta") }
  if (!oferta)   return { error: "Oferta no encontrada" }
  if (oferta.estado === "Cerradas") return { error: "La oferta ya está cerrada" }

  // Nombres de los agentes internos para el texto de la operación
  const ids = [oferta.agente_vendedor_id, oferta.agente_comprador_id].filter((x): x is string => Boolean(x))
  const nombrePorId = new Map<string, string>()
  if (ids.length > 0) {
    const { data: ags } = await supabase.from("agentes").select("id, nombre").in("id", ids)
    for (const a of ags ?? []) nombrePorId.set(a.id as string, a.nombre as string)
  }

  // Operación y reparto: se calculan y validan en el server (el navegador solo manda los referidos)
  const op = armarOperacionDeOferta(oferta, nombrePorId, precio)
  const refInt = Array.isArray(reparto?.refInt) ? reparto.refInt : []
  const refExt = Array.isArray(reparto?.refExt) ? reparto.refExt : []
  const rep = op.puntas.length > 0
    ? armarFilasValidadas(op.comision, { puntas: op.puntas, refInt, refExt })
    : { filas: [] as FilaReparto[], error: undefined }
  if (rep.error || !rep.filas) return { error: rep.error ?? "Reparto inválido" }

  const descripcion = `Cerradas — Precio de cierre: USD ${Math.round(precio).toLocaleString("es-AR")}`
  const operacion = { fecha, direccion: oferta.direccion, agentes: op.agentes, tipo: op.tipo, comision_bruta: op.comision }

  const { data: opId, error: rpcErr } = await supabase.rpc("cerrar_oferta", {
    p_oferta_id: ofertaId, p_fecha: fecha, p_precio: precio, p_descripcion: descripcion,
    p_operacion: operacion, p_reparto: rep.filas,
  })

  if (!rpcErr) {
    revalidatePath("/ofertas"); revalidatePath(`/ofertas/${ofertaId}`); revalidatePath("/operaciones"); revalidatePath("/")
    return { operacionId: opId as string }
  }

  // La función todavía no existe en la base (falta correr el script A5): método anterior en pasos
  const sinFuncion = rpcErr.code === "PGRST202" || rpcErr.code === "42883"
  if (!sinFuncion) {
    console.error("[cierre] error en cerrar_oferta:", rpcErr.code, rpcErr.message)
    if ((rpcErr.message ?? "").includes("OFERTA_YA_CERRADA")) return { error: "La oferta ya está cerrada" }
    if (rpcErr.code === "23505") return { error: "Ya existe una operación para esta oferta" }
    return { error: mensajeErrorDB(rpcErr, "cerrar la oferta") }
  }

  console.error("[cierre] falta la función cerrar_oferta (script A5): se cierra en pasos separados")
  const cierre = await registrarCierre(ofertaId, fecha, precio)
  if (cierre.error) return { error: cierre.error }

  const { data: existente } = await supabase.from("operaciones").select("id").eq("direccion", oferta.direccion).eq("fecha", fecha).maybeSingle()
  if (existente) return { aviso: "La oferta se cerró, pero ya existía una operación con esa dirección y fecha: no se creó otra." }

  const { data: nueva, error: opErr } = await supabase.from("operaciones")
    .insert({ ...operacion, comision_neta: op.comision }).select("id").single()
  if (opErr || !nueva) return { error: `La oferta quedó cerrada pero no se pudo crear la operación: ${mensajeErrorDB(opErr)}` }

  if (rep.filas.length > 0) {
    const { error: repErr } = await supabase.from("operacion_comisiones").insert(rep.filas.map((f) => ({ ...f, operacion_id: nueva.id })))
    if (repErr) return { operacionId: nueva.id as string, aviso: "La operación se creó, pero no se pudo guardar el reparto. Podés cargarlo desde Operaciones." }
  }
  return { operacionId: nueva.id as string }
}

// ─────────────────────────────────────────────────────
//  EDITAR OFERTA
// ─────────────────────────────────────────────────────
export async function editarOferta(id: string, data: EditarOfertaData): Promise<{ error?: string }> {
  await requireSession()

  if (!esUUIDValido(id))                     return { error: "ID de oferta inválido" }
  if (!esStringNoVacio(data.direccion))      return { error: "La dirección no puede estar vacía" }
  if (!esUnoDe(data.tipologia, TIPOLOGIAS_VALIDAS))                   return { error: "Tipología inválida" }
  if (!esUnoDe(data.tipo_operacion, TIPOS_OPERACION_OFERTA_VALIDOS))  return { error: "Tipo de operación inválido" }
  if (data.agente_vendedor_id  && !esUUIDValido(data.agente_vendedor_id))  return { error: "Agente vendedor inválido" }
  if (data.agente_comprador_id && !esUUIDValido(data.agente_comprador_id)) return { error: "Agente comprador inválido" }
  if (data.monto_ofertado_usd     != null && !esNumeroNoNegativo(data.monto_ofertado_usd))     return { error: "Monto ofertado inválido" }
  if (data.precio_publicacion_usd != null && !esNumeroNoNegativo(data.precio_publicacion_usd)) return { error: "Precio de publicación inválido" }
  if (data.precio_acordado_usd    != null && !esNumeroNoNegativo(data.precio_acordado_usd))    return { error: "Precio acordado inválido" }
  if (data.valor_escritura_usd    != null && !esNumeroNoNegativo(data.valor_escritura_usd))    return { error: "Valor de escritura inválido" }
  if (data.monto_reserva_usd      != null && !esNumeroNoNegativo(data.monto_reserva_usd))      return { error: "Monto de reserva inválido" }
  if (data.monto_refuerzo_usd     != null && !esNumeroNoNegativo(data.monto_refuerzo_usd))     return { error: "Monto de refuerzo inválido" }
  if (data.numero_padre           != null && !esEnteroPositivo(data.numero_padre))             return { error: "Número padre inválido" }

  const supabase = createServerClient()

  const { error } = await supabase
    .from("ofertas")
    .update({
      direccion:                data.direccion,
      tipologia:                data.tipologia,
      tipo_operacion:           data.tipo_operacion,
      agente_vendedor_id:       data.agente_vendedor_id,
      agente_comprador_id:      data.agente_comprador_id,
      agente_vendedor_externo:  data.agente_vendedor_externo,
      agente_comprador_externo: data.agente_comprador_externo,
      monto_ofertado_usd:       data.monto_ofertado_usd,
      precio_publicacion_usd:   data.precio_publicacion_usd,
      precio_acordado_usd:      data.precio_acordado_usd,
      valor_escritura_usd:      data.valor_escritura_usd,
      monto_reserva_usd:        data.monto_reserva_usd,
      monto_refuerzo_usd:       data.monto_refuerzo_usd,
      tiene_reserva:            data.tiene_reserva,
      es_bis:                   data.es_bis,
      numero_padre:             data.numero_padre,
      notas:                    data.notas,
    })
    .eq("id", id)

  if (error) return { error: mensajeErrorDB(error) }

  revalidatePath(`/ofertas/${id}`)
  revalidatePath("/ofertas")
  return {}
}
