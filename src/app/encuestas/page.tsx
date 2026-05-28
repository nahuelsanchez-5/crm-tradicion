import { createServerClient } from "@/lib/supabase"
import EncuestasClient, { EncuestaRow } from "./EncuestasClient"

export default async function EncuestasPage() {
  const supabase = createServerClient()

  const { data: raw } = await supabase
    .from("encuestas")
    .select("id, mes, anio, enviadas, respondidas, nps_promedio")
    .eq("anio", 2026)
    .order("mes")

  const rows = (raw ?? []) as EncuestaRow[]

  return <EncuestasClient rows={rows} />
}
