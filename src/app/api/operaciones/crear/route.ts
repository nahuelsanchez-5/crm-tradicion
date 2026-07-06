import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getSession } from "@/lib/auth-guard"

const VALID_TIPOS = ["Venta", "Alquiler", "Alquiler Temporal", "Referido", "Otro"]

// POST /api/operaciones/crear
// Body: { oferta_id: string; precio_acordado_usd: number }
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  try {
    const body = (await req.json()) as { oferta_id?: string; precio_acordado_usd?: number }
    const { oferta_id, precio_acordado_usd } = body

    if (!oferta_id) {
      return NextResponse.json({ success: false, error: "oferta_id requerido" }, { status: 400 })
    }

    const supabase = createServerClient()

    // 1. Fetch oferta
    const { data: oferta, error: ofertaError } = await supabase
      .from("ofertas")
      .select("*")
      .eq("id", oferta_id)
      .single()

    if (ofertaError || !oferta) {
      return NextResponse.json(
        { success: false, error: ofertaError?.message ?? "Oferta no encontrada" },
        { status: 404 },
      )
    }

    const fecha = oferta.fecha_cierre ?? new Date().toISOString().split("T")[0]
    const base  = precio_acordado_usd ?? oferta.precio_acordado_usd ?? oferta.valor_escritura_usd ?? 0

    // 2. Dedup: if a record with same direccion + fecha already exists, skip silently
    const { data: existing } = await supabase
      .from("operaciones")
      .select("id")
      .eq("direccion", oferta.direccion)
      .eq("fecha", fecha)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Ya existe una operación con esa dirección y fecha" },
        { status: 409 },
      )
    }

    // 3. Resolve internal agent names
    const agentIds = ([oferta.agente_vendedor_id, oferta.agente_comprador_id] as (string | null)[])
      .filter((id): id is string => Boolean(id))
    const agentMap = new Map<string, string>()
    if (agentIds.length > 0) {
      const { data: agentRows } = await supabase
        .from("agentes")
        .select("id, nombre")
        .in("id", agentIds)
      for (const a of agentRows ?? []) {
        agentMap.set(a.id as string, a.nombre as string)
      }
    }

    const vName: string | null = oferta.agente_vendedor_id
      ? (agentMap.get(oferta.agente_vendedor_id) ?? "Desconocido")
      : (oferta.agente_vendedor_externo ?? null)

    const cName: string | null = oferta.agente_comprador_id
      ? (agentMap.get(oferta.agente_comprador_id) ?? "Desconocido")
      : (oferta.agente_comprador_externo ?? null)

    // 4. Build agentes string
    let agentesStr: string
    const sameInternal =
      oferta.agente_vendedor_id &&
      oferta.agente_comprador_id &&
      oferta.agente_vendedor_id === oferta.agente_comprador_id
    if (sameInternal) {
      agentesStr = `${vName} (2 puntas)`
    } else {
      const parts = ([vName, cName] as (string | null)[]).filter((n): n is string => Boolean(n))
      agentesStr = parts.length > 0 ? parts.join(" / ") : "Sin agente"
    }

    // 5. Commissions: +3% per internal agent
    let comision = 0
    if (oferta.agente_vendedor_id)  comision += (base as number) * 0.03
    if (oferta.agente_comprador_id) comision += (base as number) * 0.03
    comision = Math.round(comision)

    // 6. Normalize tipo
    const rawTipo = oferta.tipo_operacion as string
    const tipo = rawTipo === "Alquiler Temporario" ? "Alquiler Temporal"
               : VALID_TIPOS.includes(rawTipo) ? rawTipo
               : "Otro"

    // 7. Insert operacion
    const { error: insertError } = await supabase.from("operaciones").insert({
      fecha,
      direccion:      oferta.direccion,
      agentes:        agentesStr,
      tipo,
      comision_bruta: comision,
      comision_neta:  comision,
    })

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido"
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
