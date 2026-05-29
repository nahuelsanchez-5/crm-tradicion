import { createServerClient } from "@/lib/supabase"
import PagosClient, { PagoRow, AgenteInfo } from "./PagosClient"

const DEFAULT_WA_MSG =
  "Hola [nombre], te recordamos que tenés un saldo pendiente de USD [monto] correspondiente a [mes]. Cualquier consulta estamos a disposición. REMAX Tradición"

export default async function PagosPage() {
  const supabase = createServerClient()

  const [
    { data: pagosRaw },
    { data: agentesRaw },
    { data: configWA },
  ] = await Promise.all([
    supabase
      .from("pagos")
      .select("id, agente_id, fecha, concepto, monto_debe, monto_pagado, estado, agentes(nombre)")
      .order("fecha", { ascending: false }),

    supabase
      .from("agentes")
      .select("id, nombre, telefono, activo, paga_fee")
      .order("nombre"),

    supabase
      .from("config")
      .select("valor")
      .eq("clave", "mensaje_whatsapp")
      .maybeSingle(),
  ])

  const pagos          = ((pagosRaw  ?? []) as unknown) as PagoRow[]
  const agentes        = (agentesRaw ?? []) as AgenteInfo[]
  const mensajeWhatsapp = configWA?.valor ?? DEFAULT_WA_MSG

  return (
    <PagosClient
      pagos={pagos}
      agentes={agentes}
      mensajeWhatsapp={mensajeWhatsapp}
    />
  )
}
