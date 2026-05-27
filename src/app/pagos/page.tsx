import { createServerClient } from "@/lib/supabase"
import PagosClient, { PagoRow, AgenteSimple } from "./PagosClient"

export default async function PagosPage() {
  const supabase = createServerClient()

  const [{ data: pagosRaw }, { data: agentesRaw }] = await Promise.all([
    supabase
      .from("pagos")
      .select("id, agente_id, fecha, concepto, monto_debe, monto_pagado, estado, agentes(nombre)")
      .order("fecha", { ascending: false }),

    supabase
      .from("agentes")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre"),
  ])

  const pagos   = ((pagosRaw  ?? []) as unknown) as PagoRow[]
  const agentes = (agentesRaw ?? []) as AgenteSimple[]

  return <PagosClient pagos={pagos} agentes={agentes} />
}
