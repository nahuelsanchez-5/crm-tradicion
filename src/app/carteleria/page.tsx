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

async function fetchCarteles(): Promise<CartelRow[]> {
  const params = new URLSearchParams()
  FIELD_IDS.forEach(id => params.append("fields[]", id))
  params.set("returnFieldsByFieldId", "true")
  params.set("sort[0][field]",     "fldClqD1zmj0AYlBn")
  params.set("sort[0][direction]", "asc")
  params.set("pageSize",           "100")   // Airtable v0 max = 100

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
    // Con returnFieldsByFieldId=true los singleSelect vuelven como string plano, no {name}
    return (json.records ?? []).map(r => ({
      id:            r.id,
      numero:        (r.fields["fldsAoewlr0711e3s"] as number)  ?? 0,
      direccion:     ((r.fields["fldjm8EB1HVvQeCSQ"] as string) ?? "").trim(),
      mlsId:         ((r.fields["fldvdpI7rmmvu3cym"] as string) ?? "").trim(),
      vencimiento:   (r.fields["fldnLaQjKRCD8vezt"]  as string) ?? "",
      diasRestantes: (r.fields["fldClqD1zmj0AYlBn"]  as number) ?? 0,
      tipo:          (r.fields["fldEhBVzBXTCu5mQC"]  as string) ?? "",
      agente:        (r.fields["fldyJFGEej2UzAUmp"]  as string) ?? "",
    }))
  } catch {
    return []
  }
}

export default async function CarteleriaPage() {
  const supabase = createServerClient()

  const now       = new Date()
  const year      = now.getFullYear()
  const month     = now.getMonth() + 1
  const startDate = `${year}-${String(month).padStart(2, "00")}-01`
  const endYear   = month === 12 ? year + 1 : year
  const endMonth  = month === 12 ? 1 : month + 1
  const endDate   = `${endYear}-${String(endMonth).padStart(2, "00")}-01`

  const [carteles, { data: agentesRaw }, { data: recuperadosRaw }] = await Promise.all([
    fetchCarteles(),
    supabase.from("agentes").select("nombre, telefono").eq("activo", true).order("nombre"),
    supabase.from("carteles_devueltos")
      .select("id, nro_cartel, direccion, agente, fecha_devolucion")
      .gte("fecha_devolucion", startDate)
      .lt("fecha_devolucion", endDate)
      .order("fecha_devolucion", { ascending: false }),
  ])

  const agentes = (agentesRaw ?? []).map(a => ({
    nombre:   a.nombre   as string,
    telefono: (a.telefono as string | null) ?? null,
  }))

  const recuperadosData = (recuperadosRaw ?? []).map(r => ({
    id:               r.id as string | number,
    nro_cartel:       r.nro_cartel as number,
    direccion:        r.direccion  as string,
    agente:           r.agente     as string,
    fecha_devolucion: r.fecha_devolucion as string,
  }))

  return (
    <CarteleriaClient
      carteles={carteles}
      agentes={agentes}
      recuperadosMes={recuperadosData.length}
      recuperadosData={recuperadosData}
    />
  )
}
