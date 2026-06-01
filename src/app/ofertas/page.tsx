import { createServerClient } from "@/lib/supabase"
import OfertasClient from "./OfertasClient"
import type { OfertaRow, AgenteSimple } from "./OfertasClient"

export default async function OfertasPage() {
  const supabase = createServerClient()

  const [{ data: rawOfertas }, { data: rawAgentes }] = await Promise.all([
    supabase
      .from("ofertas")
      .select(
        "id, numero, agente_vendedor_id, agente_comprador_id, agente_vendedor_externo, agente_comprador_externo, direccion, tipologia, tipo_operacion, tiene_reserva, monto_reserva_usd, monto_ofertado_usd, precio_publicacion_usd, estado, fecha_oferta, es_bis, numero_padre",
      )
      .order("numero", { ascending: false }),

    supabase
      .from("agentes")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre"),
  ])

  const ofertas  = ((rawOfertas  ?? []) as unknown) as OfertaRow[]
  const agentes  = ((rawAgentes  ?? []) as unknown) as AgenteSimple[]

  return <OfertasClient ofertas={ofertas} agentes={agentes} />
}
