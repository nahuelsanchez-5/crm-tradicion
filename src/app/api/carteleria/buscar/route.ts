import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth-guard"

const FIELD_IDS = {
  nro:   "fldsAoewlr0711e3s",
  dir:   "fldjm8EB1HVvQeCSQ",
  tipo:  "fldEhBVzBXTCu5mQC",
  agente:"fldyJFGEej2UzAUmp",
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  try {
    const nro = req.nextUrl.searchParams.get("nro")
    const n   = Number(nro)
    if (!nro || !Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ found: false, error: "Número inválido" }, { status: 400 })
    }

    const params = new URLSearchParams()
    Object.values(FIELD_IDS).forEach(id => params.append("fields[]", id))
    params.set("returnFieldsByFieldId", "true")
    params.set("filterByFormula", `{Nº de cartel}=${n}`)
    params.set("pageSize", "1")

    const res = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_CARTELERIA_TABLE_ID}?${params}`,
      {
        headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` },
        cache:   "no-store",
      },
    )

    if (!res.ok) {
      return NextResponse.json({ found: false, error: `Airtable error ${res.status}` }, { status: 502 })
    }

    const json    = await res.json() as { records?: Array<{ id: string; fields: Record<string, unknown> }> }
    const records = json.records ?? []

    if (records.length === 0) {
      return NextResponse.json({ found: false })
    }

    const r = records[0]
    return NextResponse.json({
      found:              true,
      airtable_record_id: r.id,
      nro_cartel:         n,
      direccion:          ((r.fields[FIELD_IDS.dir]    as string) ?? "").trim(),
      agente:             ((r.fields[FIELD_IDS.agente] as string) ?? "").trim(),
      tipo_propiedad:     ((r.fields[FIELD_IDS.tipo]   as string) ?? "").trim(),
    })
  } catch (err) {
    return NextResponse.json(
      { found: false, error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    )
  }
}
