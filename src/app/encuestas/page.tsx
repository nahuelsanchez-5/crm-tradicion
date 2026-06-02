import { createServerClient } from "@/lib/supabase"
import EncuestasClient from "./EncuestasClient"

export interface RegistroRow {
  id:         string
  fecha:      string
  tipo:       string
  subtipo:    string | null
  referencia: string
  nps:        number | null
  comentario: string | null
  created_at: string
}

export default async function EncuestasPage() {
  const supabase  = createServerClient()
  const now       = new Date()
  const anio      = now.getFullYear()
  const mesActual = now.getMonth() + 1

  // Query last 6 months of individual records
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const desde = sixMonthsAgo.toISOString().split("T")[0]

  const { data: registros } = await supabase
    .from("encuestas_registros")
    .select("id, fecha, tipo, subtipo, referencia, nps, comentario, created_at")
    .gte("fecha", desde)
    .order("fecha", { ascending: false })

  // Config: objetivo % de encuestas con NPS
  const { data: configObj } = await supabase
    .from("config")
    .select("valor")
    .eq("clave", "obj_encuestas_pct")
    .maybeSingle()

  const objetivoPct = parseInt(configObj?.valor ?? "60") || 60

  return (
    <EncuestasClient
      registros={(registros ?? []) as RegistroRow[]}
      objetivoPct={objetivoPct}
      mesActual={mesActual}
      anio={anio}
    />
  )
}
