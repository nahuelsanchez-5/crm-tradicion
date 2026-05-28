import { createServerClient } from "@/lib/supabase"
import FacturacionClient, { FacturacionRow } from "./FacturacionClient"

export default async function FacturacionPage() {
  const supabase = createServerClient()

  const { data: raw } = await supabase
    .from("facturacion")
    .select("id, mes, anio, objetivo_usd, real_usd")
    .eq("anio", 2026)
    .order("mes")

  const rows = (raw ?? []) as FacturacionRow[]

  return <FacturacionClient rows={rows} />
}
