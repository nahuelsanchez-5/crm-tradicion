import { createServerClient } from "@/lib/supabase"
import PagosClient, { PagoRow, AgenteInfo } from "./PagosClient"

export default async function PagosPage() {
  const supabase = createServerClient()

  // Supabase corta cada consulta en 1000 filas: se pagina para no truncar en silencio el historial
  // (que alimenta cobranza, mora y el filtro "todos"). `id` desempata el orden entre páginas.
  async function traerTodosLosPagos() {
    const TAM = 1000
    const filas: unknown[] = []
    for (let desde = 0; ; desde += TAM) {
      const { data, error } = await supabase
        .from("pagos")
        .select("id, agente_id, fecha, concepto, monto_debe, monto_pagado, estado, agentes(nombre)")
        .order("fecha", { ascending: false })
        .order("id", { ascending: true })
        .range(desde, desde + TAM - 1)
      if (error) { console.error("[pagos] error al leer:", error.code, error.message); break }
      filas.push(...(data ?? []))
      if (!data || data.length < TAM) break
    }
    return { data: filas }
  }

  const [
    { data: pagosRaw },
    { data: agentesRaw },
    { data: configBonos },
  ] = await Promise.all([
    traerTodosLosPagos(),

    supabase
      .from("agentes")
      .select("id, nombre, telefono, activo, paga_fee, fecha_alta, fecha_mainstreet, tipo_plan")
      .order("nombre"),

    supabase
      .from("config")
      .select("clave, valor")
      .in("clave", ["fee_mensual", "bono_pro", "bono_pro_plus", "mensaje_whatsapp"]),
  ])

  const pagos   = ((pagosRaw  ?? []) as unknown) as PagoRow[]
  const agentes = (agentesRaw ?? []) as AgenteInfo[]

  const bonos: Record<string, number> = { fee_mensual: 100, bono_pro: 500, bono_pro_plus: 800 }
  for (const row of (configBonos ?? [])) {
    const n = parseFloat(row.valor)
    if (!isNaN(n)) bonos[row.clave] = n
  }

  const mensajeWhatsappTemplate = (configBonos ?? []).find(c => c.clave === "mensaje_whatsapp")?.valor
    ?? "Hola [nombre]! Te paso el resumen de [mes]:\n\n[detalle]\n\n[cierre]"

  return (
    <PagosClient
      pagos={pagos}
      agentes={agentes}
      configBonos={bonos}
      mensajeWhatsappTemplate={mensajeWhatsappTemplate}
    />
  )
}
