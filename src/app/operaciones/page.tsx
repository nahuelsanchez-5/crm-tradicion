import { createServerClient } from "@/lib/supabase"
import OperacionesClient from "./OperacionesClient"
import type { OperacionRow } from "./OperacionesClient"

export default async function OperacionesPage() {
  const supabase = createServerClient()

  const [{ data: raw, error }, { data: agentesRaw }] = await Promise.all([
    supabase
      .from("operaciones")
      .select("id, fecha, direccion, agentes, tipo, comision_bruta, comision_neta, encuesta_comprador, encuesta_vendedor")
      .order("fecha", { ascending: false }),
    supabase.from("agentes").select("nombre").eq("activo", true),
  ])

  let operaciones: OperacionRow[]
  if (error?.code === "42703") {
    // encuesta columns don't exist yet — query without them
    const { data: basic } = await supabase
      .from("operaciones")
      .select("id, fecha, direccion, agentes, tipo, comision_bruta, comision_neta")
      .order("fecha", { ascending: false })
    operaciones = (basic ?? []).map(r => ({
      ...(r as unknown as Omit<OperacionRow, "encuesta_comprador" | "encuesta_vendedor">),
      encuesta_comprador: null,
      encuesta_vendedor:  null,
    }))
  } else {
    operaciones = ((raw ?? []) as unknown) as OperacionRow[]
  }

  const agentesInternos = (agentesRaw ?? []).map(a => a.nombre as string)

  return <OperacionesClient operaciones={operaciones} agentesInternos={agentesInternos} />
}
