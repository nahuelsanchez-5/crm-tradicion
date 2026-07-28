export const dynamic = "force-dynamic"

import { getConfig } from "./actions"
import ConfiguracionClient from "./ConfiguracionClient"
import { createServerClient } from "@/lib/supabase"

export default async function ConfiguracionPage() {
  const supabase  = createServerClient()
  const year      = new Date().getFullYear()
  const startDate = `${year}-01-01`
  const endDate   = `${year + 1}-01-01`

  const [entries, { data: devueltosRaw }] = await Promise.all([
    getConfig(),
    supabase
      .from("carteles_devueltos")
      .select("fecha_devolucion")
      .gte("fecha_devolucion", startDate)
      .lt("fecha_devolucion", endDate),
  ])

  const devueltos = devueltosRaw ?? []
  const recuperadosPorMes = Array.from({ length: 12 }, (_, i) => {
    const mes = String(i + 1).padStart(2, "0")
    return devueltos.filter(r =>
      (r.fecha_devolucion as string).startsWith(`${year}-${mes}`)
    ).length
  })

  return <ConfiguracionClient initialEntries={entries} recuperadosPorMes={recuperadosPorMes} />
}
