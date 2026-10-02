import { createServerClient } from "@/lib/supabase"
import AgentesClient from "./AgentesClient"
import { mesAnioArgentina } from "@/lib/fecha"

export default async function AgentesPage() {
  const supabase = createServerClient()
  const { mes, anio } = mesAnioArgentina()
  const mesStr  = `${anio}-${String(mes).padStart(2, "0")}`
  const anioStr = String(anio)

  const [
    agentesResult,
    { data: planes },
    { data: operaciones },
    { data: pagosMesRaw },
    { data: ofertasRaw },
  ] = await Promise.all([
    supabase
      .from("agentes")
      .select("id, nombre, email, telefono, fecha_alta, fecha_mainstreet, fecha_baja, activo, paga_fee, tipo_plan")
      .order("nombre"),

    supabase
      .from("planes_crm")
      .select("agente_id, tipo_plan, pagado")
      .eq("mes", mes)
      .eq("anio", anio),

    supabase
      .from("operaciones")
      .select("agentes, comision_bruta")
      .gte("fecha", `${anioStr}-01-01`)
      .lt("fecha", `${String(anio + 1)}-01-01`),

    supabase
      .from("pagos")
      .select("agente_id, concepto, monto_debe, monto_pagado, estado")
      .gte("fecha", `${mesStr}-01`)
      .lt("fecha", mes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, "0")}-01`),

    supabase
      .from("ofertas")
      .select("agente_vendedor_id, agente_vendedor_externo")
      .neq("estado", "Cerradas")
      .neq("estado", "Caídas"),
  ])

  // Fallback: si las columnas nuevas no existen aún en Supabase (migración pendiente),
  // hace un select básico para que los agentes sigan visibles.
  let agentes = agentesResult.data
  if (agentesResult.error?.code === '42703') {
    // 42703 = columna inexistente — intentar sin tipo_plan que puede ser la ausente
    const { data: basic } = await supabase
      .from("agentes")
      .select("id, nombre, email, telefono, fecha_alta, fecha_mainstreet, fecha_baja, activo, paga_fee")
      .order("nombre")
    agentes = (basic ?? []).map((a: Record<string, unknown>) => ({
      ...a, tipo_plan: null,
    })) as typeof agentes
  }

  const agentesConPlan = (agentes ?? []).map(a => ({
    ...a,
    plan: (planes ?? []).find(p => p.agente_id === a.id) ?? null,
  }))

  // Facturación del año por nombre de agente (vendedor = primer fragmento del campo agentes)
  const facturacionPorNombre: Record<string, number> = {}
  for (const op of (operaciones ?? [])) {
    const agStr = ((op.agentes as string) ?? "").trim()
    if (!agStr) continue
    // "Vendedor / Comprador" → "Vendedor"; "Nombre (2 puntas)" → "Nombre"
    const vendedor = agStr.split(" / ")[0].replace(/ \(2 puntas\)$/, "").trim()
    if (!vendedor) continue
    const k = vendedor.toLowerCase()
    facturacionPorNombre[k] = (facturacionPorNombre[k] ?? 0) + Number(op.comision_bruta ?? 0)
  }

  // Ofertas activas por nombre de agente
  const ofertasActivasNombre: Record<string, number> = {}
  const nombrePorId = new Map((agentes ?? []).map(a => [a.id as string, a.nombre as string]))
  for (const o of (ofertasRaw ?? [])) {
    const nombre = (o.agente_vendedor_id ? nombrePorId.get(o.agente_vendedor_id as string) : null)
      ?? (o.agente_vendedor_externo as string | null)
    if (nombre) {
      const k = nombre.toLowerCase().trim()
      ofertasActivasNombre[k] = (ofertasActivasNombre[k] ?? 0) + 1
    }
  }

  const pagosMes = (pagosMesRaw ?? []) as Array<{
    agente_id: string
    concepto: string
    monto_debe: number
    monto_pagado: number
    estado: string
  }>

  return (
    <AgentesClient
      agentes={agentesConPlan}
      mes={mes}
      anio={anio}
      facturacionPorNombre={facturacionPorNombre}
      pagosMes={pagosMes}
      ofertasActivasNombre={ofertasActivasNombre}
    />
  )
}
