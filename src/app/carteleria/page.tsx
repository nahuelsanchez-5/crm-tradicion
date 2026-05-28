import { createServerClient } from "@/lib/supabase"
import CarteleriaClient, { CarteleriaRow } from "./CarteleriaClient"

export default async function CarteleriaPage() {
  const supabase = createServerClient()

  const { data: raw } = await supabase
    .from("carteleria")
    .select("id, mes, anio, entregados, recuperados")
    .eq("anio", 2026)
    .order("mes")

  const rows = (raw ?? []) as CarteleriaRow[]

  return <CarteleriaClient rows={rows} />
}
