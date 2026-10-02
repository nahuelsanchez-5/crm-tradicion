export const dynamic = "force-dynamic"

import { getConfig } from "./actions"
import ConfiguracionClient from "./ConfiguracionClient"
import { createServerClient } from "@/lib/supabase"
import { limitesMesArgentina, mesAnioArgentina } from "@/lib/fecha"

export default async function ConfiguracionPage() {
  const supabase  = createServerClient()
  const { anio: year } = mesAnioArgentina()
  const startDate = limitesMesArgentina(year, 1).desde
  const endDate   = limitesMesArgentina(year, 12).hasta

  const [entries, { data: devueltosRaw }] = await Promise.all([
    getConfig(),
    supabase
      .from("carteles_devueltos")
      .select("fecha_devolucion")
      .gte("fecha_devolucion", startDate)
      .lt("fecha_devolucion", endDate),
  ])

  const devueltos = devueltosRaw ?? []
  // El mes de cada devolución se toma en hora Argentina (no por prefijo del string UTC)
  const recuperadosPorMes = Array.from({ length: 12 }, () => 0)
  for (const r of devueltos) {
    const mes = parseInt(
      new Date(r.fecha_devolucion as string).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).slice(5, 7),
      10,
    )
    if (mes >= 1 && mes <= 12) recuperadosPorMes[mes - 1]++
  }

  return <ConfiguracionClient initialEntries={entries} recuperadosPorMes={recuperadosPorMes} />
}
