import { createServerClient } from "@/lib/supabase"
import PagosClient, { PagoRow, AgenteInfo } from "./PagosClient"

export default async function PagosPage() {
  const supabase = createServerClient()

  const [
    { data: pagosRaw },
    { data: agentesRaw },
    { data: configBonos },
  ] = await Promise.all([
    supabase
      .from("pagos")
      .select("id, agente_id, fecha, concepto, monto_debe, monto_pagado, estado, agentes(nombre)")
      .order("fecha", { ascending: false }),

    supabase
      .from("agentes")
      .select("id, nombre, telefono, activo, paga_fee, licencia")
      .eq("activo", true)
      .order("nombre"),

    supabase
      .from("config")
      .select("clave, valor")
      .in("clave", ["fee_mensual", "bono_pro", "bono_pro_plus"]),
  ])

  const pagos   = ((pagosRaw  ?? []) as unknown) as PagoRow[]
  const agentes = (agentesRaw ?? []) as AgenteInfo[]

  const bonos: Record<string, number> = { fee_mensual: 100, bono_pro: 500, bono_pro_plus: 800 }
  for (const row of (configBonos ?? [])) {
    const n = parseFloat(row.valor)
    if (!isNaN(n)) bonos[row.clave] = n
  }

  return (
    <PagosClient
      pagos={pagos}
      agentes={agentes}
      configBonos={bonos}
    />
  )
}
