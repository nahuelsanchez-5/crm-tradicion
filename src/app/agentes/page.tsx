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
    operacionesResult,
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

    // Con el reparto de comisión (operacion_comisiones) si la tabla existe; si no, se cae al método anterior (más abajo)
    supabase
      .from("operaciones")
      .select("id, agentes, comision_bruta, operacion_comisiones(agente_id, monto_usd, informativo)")
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

  // Si la tabla del reparto todavía no existe, la consulta con relación falla: se reintenta sin ella
  type OpFila = {
    id?: string; agentes: string | null; comision_bruta: number
    operacion_comisiones?: { agente_id: string | null; monto_usd: number; informativo: boolean }[] | null
  }
  let operaciones: OpFila[] = (operacionesResult.data ?? []) as unknown as OpFila[]
  if (operacionesResult.error) {
    const { data: basicas } = await supabase
      .from("operaciones")
      .select("agentes, comision_bruta")
      .gte("fecha", `${anioStr}-01-01`)
      .lt("fecha", `${String(anio + 1)}-01-01`)
    operaciones = (basicas ?? []) as unknown as OpFila[]
  }

  // Facturación del año por nombre de agente. Si la operación tiene reparto se usa el reparto
  // (incluye referidos); si no, el método anterior (vendedor = primer fragmento del campo agentes).
  const facturacionPorNombre: Record<string, number> = {}
  const nombrePorAgenteId = new Map((agentes ?? []).map(a => [a.id as string, (a.nombre as string).toLowerCase().trim()]))
  for (const op of operaciones) {
    const reparto = (op.operacion_comisiones ?? []).filter(r => !r.informativo && r.agente_id)
    if (reparto.length > 0) {
      for (const r of reparto) {
        const k = nombrePorAgenteId.get(r.agente_id as string)
        if (k) facturacionPorNombre[k] = (facturacionPorNombre[k] ?? 0) + Number(r.monto_usd)
      }
      continue
    }
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
