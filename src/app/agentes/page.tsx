import { createServerClient } from "@/lib/supabase"
import AgentesClient from "./AgentesClient"

export default async function AgentesPage() {
  const supabase = createServerClient()
  const now  = new Date()
  const mes  = now.getMonth() + 1
  const anio = now.getFullYear()
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
      .select("agente_vendedor, comision_bruta")
      .gte("fecha", `${anioStr}-01-01`)
      .lte("fecha", `${anioStr}-12-31`),

    supabase
      .from("pagos")
      .select("agente_id, concepto, monto_debe, monto_pagado, estado")
      .gte("fecha", `${mesStr}-01`)
      .lte("fecha", `${mesStr}-31`),

    supabase
      .from("ofertas")
      .select("agente_vendedor")
      .neq("estado", "Cerradas")
      .neq("estado", "Caídas"),
  ])

  // Fallback: si las columnas nuevas no existen aún en Supabase (migración pendiente),
  // hace un select básico para que los agentes sigan visibles.
  let agentes = agentesResult.data
  if (agentesResult.error?.code === '42703') {
    const { data: basic } = await supabase
      .from("agentes")
      .select("id, nombre, email, telefono, fecha_alta, fecha_baja, activo")
      .order("nombre")
    agentes = (basic ?? []).map((a: Record<string, unknown>) => ({
      ...a, fecha_mainstreet: null, paga_fee: null, tipo_plan: null,
    })) as typeof agentes
  }

  const agentesConPlan = (agentes ?? []).map(a => ({
    ...a,
    plan: (planes ?? []).find(p => p.agente_id === a.id) ?? null,
  }))

  // Facturación del año por nombre de agente (vendedor)
  const facturacionPorNombre: Record<string, number> = {}
  for (const op of (operaciones ?? [])) {
    if (op.agente_vendedor) {
      const k = (op.agente_vendedor as string).toLowerCase().trim()
      facturacionPorNombre[k] = (facturacionPorNombre[k] ?? 0) + Number(op.comision_bruta ?? 0)
    }
  }

  // Ofertas activas por nombre de agente
  const ofertasActivasNombre: Record<string, number> = {}
  for (const o of (ofertasRaw ?? [])) {
    if (o.agente_vendedor) {
      const k = (o.agente_vendedor as string).toLowerCase().trim()
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
