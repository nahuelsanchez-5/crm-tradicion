import { mensajeErrorDB } from "@/lib/errores"
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getSession } from "@/lib/auth-guard"
import { hoyArgentina } from "@/lib/fecha"
import { esNumeroNoNegativo, esUUIDValido } from "@/lib/validate"
import { armarFilasValidadas, basesPorPunta, type FilaReparto, type Punta, type RefExterno, type RefInterno } from "@/lib/reparto"

const VALID_TIPOS = ["Venta", "Alquiler", "Alquiler Temporal", "Referido", "Otro"]

// POST /api/operaciones/crear
// Body: { oferta_id: string; precio_acordado_usd: number }
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  try {
    const body = (await req.json()) as {
      oferta_id?: string
      precio_acordado_usd?: number
      reparto?: { refInt?: RefInterno[]; refExt?: RefExterno[] }
    }
    const { oferta_id, precio_acordado_usd } = body

    if (!esUUIDValido(oferta_id)) {
      return NextResponse.json({ success: false, error: "oferta_id inválido" }, { status: 400 })
    }
    if (precio_acordado_usd != null && !esNumeroNoNegativo(precio_acordado_usd)) {
      return NextResponse.json({ success: false, error: "precio_acordado_usd inválido" }, { status: 400 })
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

    const fecha = oferta.fecha_cierre ?? hoyArgentina()
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

    // 6b. Reparto de la comisión entre agentes. Las puntas salen de la oferta (el cliente solo manda
    //     los referidos) y se valida ANTES de crear nada: si el reparto es inválido no queda una operación a medias.
    const puntas: Punta[] = []
    if (oferta.agente_vendedor_id)  puntas.push({ rol: "vendedor",  agenteId: oferta.agente_vendedor_id as string,  base: 0 })
    if (oferta.agente_comprador_id) puntas.push({ rol: "comprador", agenteId: oferta.agente_comprador_id as string, base: 0 })
    basesPorPunta(comision, puntas.length).forEach((b, i) => { puntas[i].base = b })

    const refInt = Array.isArray(body.reparto?.refInt) ? body.reparto!.refInt : []
    const refExt = Array.isArray(body.reparto?.refExt) ? body.reparto!.refExt : []
    const reparto = puntas.length > 0 ? armarFilasValidadas(comision, { puntas, refInt, refExt }) : { filas: [] as FilaReparto[] }
    if (reparto.error || !reparto.filas) {
      return NextResponse.json({ success: false, error: reparto.error ?? "Reparto inválido" }, { status: 400 })
    }

    // 7. Insert operacion
    const { data: opCreada, error: insertError } = await supabase.from("operaciones").insert({
      fecha,
      direccion:      oferta.direccion,
      agentes:        agentesStr,
      tipo,
      comision_bruta: comision,
      comision_neta:  comision,
    }).select("id").single()

    if (insertError || !opCreada) {
      return NextResponse.json({ success: false, error: mensajeErrorDB(insertError) }, { status: 500 })
    }

    // 8. Guardar el reparto. Si la tabla todavía no existe, la operación queda creada y se avisa
    //    (el reparto se puede cargar después desde Operaciones).
    let aviso: string | undefined
    if (reparto.filas.length > 0) {
      const { error: repError } = await supabase
        .from("operacion_comisiones")
        .insert(reparto.filas.map((f) => ({ ...f, operacion_id: opCreada.id })))
      if (repError) {
        console.error("[api] reparto no guardado:", repError.code, repError.message)
        aviso = repError.code === "42P01" || repError.code === "PGRST205"
          ? "La operación se creó, pero el reparto no se guardó: falta crear la tabla en la base (script A2 pendiente). Podés cargarlo después desde Operaciones."
          : "La operación se creó, pero no se pudo guardar el reparto. Podés cargarlo desde Operaciones."
      }
    }

    return NextResponse.json({ success: true, operacion_id: opCreada.id, aviso })
  } catch (err) {
    console.error("[api] error:", err)
    const msg = "Error interno"
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
