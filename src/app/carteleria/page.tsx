import { createServerClient } from "@/lib/supabase"
import CarteleriaClient, { CartelRow } from "./CarteleriaClient"

// ── Field IDs de Airtable ─────────────────────────────
const FIELD_IDS = [
  "fldsAoewlr0711e3s",   // Nº de cartel
  "fldjm8EB1HVvQeCSQ",   // Dirección
  "fldvdpI7rmmvu3cym",   // MLS-ID
  "fldnLaQjKRCD8vezt",   // Vencimiento
  "fldClqD1zmj0AYlBn",   // Días restantes (fórmula, solo lectura)
  "fldEhBVzBXTCu5mQC",   // Tipo de propiedad
  "fldyJFGEej2UzAUmp",   // Agente
]

interface AirtableRecord {
  id:     string
  fields: Record<string, unknown>
}

interface AirtableSelectValue {
  name?: string
}

async function fetchCarteles(): Promise<CartelRow[]> {
  const params = new URLSearchParams()
  FIELD_IDS.forEach(id => params.append("fields[]", id))
  params.set("returnFieldsByFieldId", "true")
  params.set("sort[0][field]",        "fldClqD1zmj0AYlBn")
  params.set("sort[0][direction]",    "asc")
  params.set("pageSize",              "200")

  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_CARTELERIA_TABLE_ID}?${params}`,
      {
        headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` },
        cache: "no-store",
      },
    )

    if (!res.ok) return []

    const json = (await res.json()) as { records?: AirtableRecord[] }
    return (json.records ?? []).map(r => ({
      id:            r.id,
      numero:        (r.fields["fldsAoewlr0711e3s"] as number) ?? 0,
      direccion:     ((r.fields["fldjm8EB1HVvQeCSQ"] as string) ?? "").trim(),
      mlsId:         ((r.fields["fldvdpI7rmmvu3cym"] as string) ?? "").trim(),
      vencimiento:   (r.fields["fldnLaQjKRCD8vezt"] as string) ?? "",
      diasRestantes: (r.fields["fldClqD1zmj0AYlBn"] as number) ?? 0,
      tipo:          ((r.fields["fldEhBVzBXTCu5mQC"] as AirtableSelectValue)?.name) ?? "",
      agente:        ((r.fields["fldyJFGEej2UzAUmp"] as AirtableSelectValue)?.name) ?? "",
    }))
  } catch {
    return []
  }
}

export default async function CarteleriaPage() {
  const supabase = createServerClient()

  const [carteles, { data: agentesRaw }] = await Promise.all([
    fetchCarteles(),
    supabase.from("agentes").select("nombre").eq("activo", true).order("nombre"),
  ])

  const agentes = (agentesRaw ?? []).map(a => a.nombre as string)

  return <CarteleriaClient carteles={carteles} agentes={agentes} />
}
