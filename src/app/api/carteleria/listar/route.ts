import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth-guard"

const FIELD_IDS = [
  "fldsAoewlr0711e3s",   // Nº de cartel
  "fldjm8EB1HVvQeCSQ",   // Dirección
  "fldClqD1zmj0AYlBn",   // Días restantes (para ordenar)
  "fldEhBVzBXTCu5mQC",   // Tipo de propiedad
  "fldyJFGEej2UzAUmp",   // Agente
]

export async function GET(): Promise<NextResponse> {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  try {
    const params = new URLSearchParams()
    FIELD_IDS.forEach(id => params.append("fields[]", id))
    params.set("returnFieldsByFieldId", "true")
    params.set("sort[0][field]",     "fldClqD1zmj0AYlBn")
    params.set("sort[0][direction]", "asc")
    params.set("pageSize",           "100")

    const res = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_CARTELERIA_TABLE_ID}?${params}`,
      {
        headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` },
        cache:   "no-store",
      },
    )

    if (!res.ok) {
      return NextResponse.json({ error: `Airtable error ${res.status}` }, { status: 502 })
    }

    const json = await res.json() as { records?: Array<{ id: string; fields: Record<string, unknown> }> }

    const data = (json.records ?? []).map(r => ({
      id:        r.id,
      numero:    (r.fields["fldsAoewlr0711e3s"] as number)  ?? 0,
      direccion: ((r.fields["fldjm8EB1HVvQeCSQ"] as string) ?? "").trim(),
      tipo:      (r.fields["fldEhBVzBXTCu5mQC"]  as string) ?? "",
      agente:    (r.fields["fldyJFGEej2UzAUmp"]  as string) ?? "",
    }))

    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    )
  }
}
