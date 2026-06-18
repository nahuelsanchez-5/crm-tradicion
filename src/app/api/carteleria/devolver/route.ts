import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

const AIRTABLE_TABLE_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_CARTELERIA_TABLE_ID}`

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as {
      airtable_record_id?: string
      nro_cartel?:         number
      direccion?:          string
      agente?:             string
      tipo_propiedad?:     string
    }

    const { airtable_record_id, nro_cartel, direccion, agente, tipo_propiedad } = body

    if (!airtable_record_id || !nro_cartel) {
      return NextResponse.json({ success: false, error: "Datos incompletos" }, { status: 400 })
    }

    const supabase       = createServerClient()
    const fecha_devolucion = new Date().toISOString()

    // 1. INSERT en Supabase
    const { data: inserted, error: insertError } = await supabase
      .from("carteles_devueltos")
      .insert({ airtable_record_id, nro_cartel, direccion, agente, tipo_propiedad, fecha_devolucion })
      .select("id")
      .single()

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 })
    }

    // 2. DELETE en Airtable
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

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    )
  }
}
