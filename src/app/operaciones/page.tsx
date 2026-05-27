import { createServerClient } from "@/lib/supabase"
import OperacionesClient from "./OperacionesClient"
import type { OperacionRow } from "./OperacionesClient"

export default async function OperacionesPage() {
  const supabase = createServerClient()

  const { data: raw } = await supabase
    .from("operaciones")
    .select("id, fecha, direccion, agentes, tipo, comision_bruta, comision_neta, encuesta_comprador, encuesta_vendedor")
    .order("fecha", { ascending: false })

  const operaciones = ((raw ?? []) as unknown) as OperacionRow[]

  return <OperacionesClient operaciones={operaciones} />
}
