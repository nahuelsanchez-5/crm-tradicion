import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getSession } from "@/lib/auth-guard"
import { ahoraArgentinaISO } from "@/lib/fecha"
import { esEnteroPositivo } from "@/lib/validate"

const AIRTABLE_TABLE_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_CARTELERIA_TABLE_ID}`

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  try {
    const body = await req.json() as {
      airtable_record_id?: string
      nro_cartel?:         number
      direccion?:          string
      agente?:             string
      tipo_propiedad?:     string
    }

    const { airtable_record_id, nro_cartel, direccion, agente, tipo_propiedad } = body

    if (!esEnteroPositivo(nro_cartel)) {
      return NextResponse.json({ success: false, error: "Número de cartel inválido" }, { status: 400 })
    }
    // El id de Airtable se concatena en la URL del DELETE: solo se acepta el formato real "rec…"
    if (airtable_record_id != null && !/^rec[A-Za-z0-9]{10,20}$/.test(airtable_record_id)) {
      return NextResponse.json({ success: false, error: "ID de Airtable inválido" }, { status: 400 })
    }
    for (const campo of [direccion, agente, tipo_propiedad]) {
      if (campo != null && (typeof campo !== "string" || campo.length > 300)) {
        return NextResponse.json({ success: false, error: "Datos inválidos" }, { status: 400 })
      }
    }

    const supabase         = createServerClient()
    // Hora Argentina (-03:00): con toISOString() un cartel devuelto después de las 21hs
    // del último día del mes contaba en el mes siguiente.
    const fecha_devolucion = ahoraArgentinaISO()

    // 1. INSERT en Supabase
    const { data: inserted, error: insertError } = await supabase
      .from("carteles_devueltos")
      .insert({ airtable_record_id: airtable_record_id ?? null, nro_cartel, direccion, agente, tipo_propiedad, fecha_devolucion })
      .select("id")
      .single()

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 })
    }

    // 2. DELETE en Airtable (solo si hay record_id)
    if (airtable_record_id) {
      const airtableRes = await fetch(`${AIRTABLE_TABLE_URL}/${airtable_record_id}`, {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` },
      })

      if (!airtableRes.ok) {
        // 3. Rollback: eliminar el registro de Supabase
        await supabase.from("carteles_devueltos").delete().eq("id", inserted.id)
        const errBody = await airtableRes.json().catch(() => ({})) as { error?: { message?: string } }
        const errMsg  = errBody.error?.message ?? `Error Airtable ${airtableRes.status}`
        return NextResponse.json({ success: false, error: errMsg }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    )
  }
}
