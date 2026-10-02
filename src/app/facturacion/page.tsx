import { createServerClient } from "@/lib/supabase"
import { mesAnioArgentina } from "@/lib/fecha"
import { CLAVE_OBJETIVO_ANUAL, parseObjetivoAnual } from "@/lib/objetivos"
import FacturacionClient, { FacturacionRow } from "./FacturacionClient"

export default async function FacturacionPage() {
  const supabase = createServerClient()
  const { anio, mes } = mesAnioArgentina()

  const [{ data: raw }, { data: operacionesData }, { data: objConfig }] = await Promise.all([
    supabase
      .from("facturacion")
      .select("id, mes, anio, objetivo_usd, real_usd")
      .eq("anio", anio)
      .order("mes"),
    // Suma de comisiones por mes para pre-llenar "Facturación real".
    // Se suman TODOS los tipos de operación (no solo Venta) para coincidir con el
    // KPI "Facturación USD" del Dashboard, que también suma comision_bruta sin filtrar por tipo.
    supabase
      .from("operaciones")
      .select("fecha, comision_bruta")
      .gte("fecha", `${anio}-01-01`)
      .lt("fecha", `${anio + 1}-01-01`),
    supabase.from("config").select("valor").eq("clave", CLAVE_OBJETIVO_ANUAL).maybeSingle(),
  ])

  const rows = (raw ?? []) as FacturacionRow[]

  const comisionesPorMes: Record<string, number> = {}
  for (const op of (operacionesData ?? [])) {
    const [anioStr, mesStr] = op.fecha.split("-")
    const key = `${parseInt(mesStr)}-${anioStr}`
    comisionesPorMes[key] = (comisionesPorMes[key] ?? 0) + Number(op.comision_bruta ?? 0)
  }

  return (
    <FacturacionClient
      rows={rows}
      comisionesPorMes={comisionesPorMes}
      anio={anio}
      mesActual={mes}
      objetivoAnual={parseObjetivoAnual(objConfig?.valor)}
    />
  )
}
