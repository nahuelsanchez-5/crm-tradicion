import { createServerClient } from "@/lib/supabase"
import { notFound } from "next/navigation"
import OfertaDetalleClient from "./OfertaDetalleClient"
import type {
  OfertaDetalle,
  HistorialItem,
  ChecklistItem,
  AgenteSimple,
} from "./OfertaDetalleClient"

interface Props {
  params: Promise<{ id: string }>
}

export default async function OfertaDetallePage({ params }: Props) {
  const { id } = await params
  const supabase = createServerClient()

  const [
    { data: rawOferta },
    { data: rawHistorial },
    { data: rawChecklist },
    { data: rawAgentes },
  ] = await Promise.all([
    supabase
      .from("ofertas")
      .select(
        "id, numero, agente_vendedor_id, agente_comprador_id, agente_vendedor_externo, agente_comprador_externo, direccion, tipologia, tipo_operacion, tiene_reserva, monto_reserva_usd, monto_refuerzo_usd, monto_ofertado_usd, precio_publicacion_usd, precio_acordado_usd, valor_escritura_usd, fecha_oferta, fecha_cierre, estado, es_bis, numero_padre, comision_cobrada, checklist_completado, notas",
      )
      .eq("id", id)
      .single(),

    supabase
      .from("ofertas_historial")
      .select("id, oferta_id, tipo, descripcion, monto_usd, created_at")
      .eq("oferta_id", id)
      .order("created_at", { ascending: true }),

    supabase
      .from("ofertas_checklist")
      .select("id, oferta_id, item, completado, orden")
      .eq("oferta_id", id)
      .order("orden", { ascending: true }),

    supabase
      .from("agentes")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre"),
  ])

  if (!rawOferta) notFound()

  const oferta   = (rawOferta   as unknown) as OfertaDetalle
  const historial= ((rawHistorial  ?? []) as unknown) as HistorialItem[]
  const checklist= ((rawChecklist  ?? []) as unknown) as ChecklistItem[]
  const agentes  = ((rawAgentes    ?? []) as unknown) as AgenteSimple[]

  return (
    <OfertaDetalleClient
      oferta={oferta}
      historial={historial}
      checklist={checklist}
      agentes={agentes}
    />
  )
}
