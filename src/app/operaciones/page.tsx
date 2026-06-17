import { createServerClient } from "@/lib/supabase"
import OperacionesClient from "./OperacionesClient"
import type { OperacionRow } from "./OperacionesClient"

export default async function OperacionesPage() {
  const supabase = createServerClient()

  const { data: raw, error } = await supabase
    .from("operaciones")
    .select("id, fecha, direccion, agentes, tipo, comision_bruta, comision_neta, encuesta_comprador, encuesta_vendedor")
    .order("fecha", { ascending: false })

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

  return <OperacionesClient operaciones={operaciones} />
}
