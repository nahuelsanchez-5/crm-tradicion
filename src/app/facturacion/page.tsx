import { createServerClient } from "@/lib/supabase"
import { mesAnioArgentina } from "@/lib/fecha"
import { cargarObjetivosAnio } from "@/lib/objetivos-db"
import FacturacionClient, { FacturacionRow } from "./FacturacionClient"

export default async function FacturacionPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string }>
}) {
  const supabase = createServerClient()
  const hoy = mesAnioArgentina()

  // Solo se puede ver el año anterior, el actual y el siguiente (planificación)
  const { anio: anioParam } = await searchParams
  const pedido = parseInt(anioParam ?? "", 10)
  const anio = [hoy.anio - 1, hoy.anio, hoy.anio + 1].includes(pedido) ? pedido : hoy.anio

  const [objetivosAnio, { data: operacionesData }] = await Promise.all([
    // Objetivos del año: los meses terminados vienen fijos (y se guardan si faltaba alguno)
    cargarObjetivosAnio(supabase, anio),
    // Suma de comisiones por mes para pre-llenar "Facturación real".
    // Se suman TODOS los tipos de operación (no solo Venta) para coincidir con el
    // KPI "Facturación USD" del Dashboard, que también suma comision_bruta sin filtrar por tipo.
    supabase
      .from("operaciones")
      .select("fecha, comision_bruta")
      .gte("fecha", `${anio}-01-01`)
      .lt("fecha", `${anio + 1}-01-01`),
  ])

  const rows = objetivosAnio.filas.map(f => ({ ...f, objetivo_usd: Number(f.objetivo_usd ?? 0) })) as FacturacionRow[]

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
      anioActual={hoy.anio}
      mesActual={hoy.mes}
      objetivoAnual={objetivosAnio.objetivoAnual}
      objetivos={objetivosAnio.objetivos}
    />
  )
}
