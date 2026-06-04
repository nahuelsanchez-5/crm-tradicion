import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

// ── Config ────────────────────────────────────────────────────────────────────

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent"

// ── Types ─────────────────────────────────────────────────────────────────────

type Agente = { id: string; nombre: string }
type Oferta = { numero: number; direccion: string; estado: string }

interface GeminiIntent {
  intent: string
  params: Record<string, unknown>
  response: string
  requiresConfirmation: boolean
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(agentes: Agente[], ofertas: Oferta[]): string {
  const agentesStr =
    agentes.map((a) => `- ${a.nombre} (id: ${a.id})`).join("\n") || "Sin agentes activos"
  const ofertasStr =
    ofertas
      .map((o) => `- Oferta ${o.numero}: ${o.direccion} [${o.estado}]`)
      .join("\n") || "Sin ofertas activas"
  const ultimoNumero =
    ofertas.length > 0 ? Math.max(...ofertas.map((o) => o.numero)) : 0

  return `Sos el asistente inteligente de REMAX Tradición, inmobiliaria en Resistencia, Chaco, Argentina.
Tu trabajo es ayudar a Nahuel a gestionar la oficina de forma conversacional.
Respondé siempre en español rioplatense, de forma directa y sin rodeos.

CONTEXTO DINÁMICO:
Agentes activos:
${agentesStr}

Ofertas activas (no cerradas ni caídas):
${ofertasStr}
Último número de oferta: ${ultimoNumero}. El próximo número sería ${ultimoNumero + 1}.

ACCIONES DISPONIBLES — respondé SIEMPRE con un JSON válido, sin markdown, sin backticks, sin texto extra:

{ "intent": "crear_oferta", "params": { "numero": number, "direccion": string, "agente_vendedor_externo": string, "agente_comprador_externo": string, "tipologia": "Depto|Casa|PH|Terreno|Oficina|Cochera|Campo|Otro", "tipo_operacion": "Venta|Alquiler", "monto_ofertado_usd": number, "precio_publicacion_usd": number, "tiene_reserva": boolean, "monto_reserva_usd": number }, "response": string, "requiresConfirmation": true }

{ "intent": "cambiar_estado_oferta", "params": { "numero": number, "nuevo_estado": "Espera rta. vendedor|Espera rta. comprador|Aceptadas / Pre cierre|Cerradas|Caídas", "descripcion": string }, "response": string, "requiresConfirmation": true }

{ "intent": "registrar_pago", "params": { "agente_nombre": string, "concepto": "FEE mensual|Licencias CRM|Mainstreet|Otros", "monto_pagado": number, "fecha": "YYYY-MM-DD" }, "response": string, "requiresConfirmation": false }

{ "intent": "registrar_operacion", "params": { "fecha": "YYYY-MM-DD", "direccion": string, "agentes": string, "tipo": "Venta|Alquiler|Referido", "comision_bruta": number }, "response": string, "requiresConfirmation": false }

{ "intent": "registrar_encuesta", "params": { "tipo": "ESPONTANEA|MAILING", "referencia": string, "subtipo": "Comprador|Vendedor|null", "nps": number, "comentario": string }, "response": string, "requiresConfirmation": false }

{ "intent": "consultar", "params": { "query": string }, "response": string, "requiresConfirmation": false }

{ "intent": "no_entendido", "params": {}, "response": "pregunta de aclaración", "requiresConfirmation": false }

REGLAS:
- Para crear_oferta y cambiar_estado_oferta: siempre requiresConfirmation: true
- Para pagos, operaciones y encuestas: requiresConfirmation: false
- Si falta información crítica (dirección, agente, monto): usá intent "no_entendido" y preguntá
- Próximo número de oferta: ${ultimoNumero + 1}
- Resolvé nombres parciales buscando en la lista de agentes activos
- Si hay ambigüedad entre agentes: usá "no_entendido" y preguntá cuál
- Respondé ÚNICAMENTE con el JSON, sin ningún texto adicional`
}

// ── Gemini ────────────────────────────────────────────────────────────────────

async function callGemini(
  systemPrompt: string,
  history: { role: string; content: string }[],
  message: string
): Promise<GeminiIntent> {
  // System prompt inyectado como prefijo del primer mensaje de usuario.
  // Gemini v1 no soporta system_instruction, así que va concatenado al inicio.
  type GeminiContent = { role: string; parts: { text: string }[] }
  let contents: GeminiContent[]

  if (history.length === 0) {
    // Primera vuelta: system prompt + mensaje actual en un solo turno
    contents = [
      { role: "user", parts: [{ text: `${systemPrompt}\n\nUsuario: ${message}` }] },
    ]
  } else {
    // Vueltas siguientes: system prompt en el primer mensaje del historial,
    // resto del historial alternando user/model, y mensaje actual al final
    const [first, ...rest] = history
    contents = [
      { role: "user", parts: [{ text: `${systemPrompt}\n\nUsuario: ${first.content}` }] },
      ...rest.map((h) => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      })),
      { role: "user", parts: [{ text: message }] },
    ]
  }

  const apiKey = process.env.GEMINI_API_KEY ?? ""
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini ${res.status}: ${errText}`)
  }

  const data = await res.json()
  const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"
  // Strip markdown code blocks if present (safety net)
  const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()
  return JSON.parse(cleaned) as GeminiIntent
}

// ── Agent resolution ──────────────────────────────────────────────────────────

function findAgent(agentes: Agente[], name: string): Agente | undefined {
  if (!name?.trim()) return undefined
  const lower = name.toLowerCase().trim()
  return agentes.find((a) => {
    const aNombre = a.nombre.toLowerCase()
    // Exact match, contains, or first-name match
    return (
      aNombre === lower ||
      aNombre.includes(lower) ||
      lower.includes(aNombre.split(" ")[0])
    )
  })
}

// ── Action execution ──────────────────────────────────────────────────────────

async function executeAction(
  intent: string,
  params: Record<string, unknown>,
  agentes: Agente[]
): Promise<{ success: boolean; message: string; data?: unknown }> {
  const supabase = createServerClient()
  const today = new Date().toISOString().split("T")[0]

  switch (intent) {
    case "crear_oferta": {
      const vendNombre = params.agente_vendedor_externo as string | undefined
      const compNombre = params.agente_comprador_externo as string | undefined
      const vendInterno = vendNombre ? findAgent(agentes, vendNombre) : undefined
      const compInterno = compNombre ? findAgent(agentes, compNombre) : undefined

      const { data: oferta, error } = await supabase
        .from("ofertas")
        .insert({
          numero:                   params.numero,
          direccion:                params.direccion,
          agente_vendedor_id:       vendInterno?.id ?? null,
          agente_comprador_id:      compInterno?.id ?? null,
          agente_vendedor_externo:  !vendInterno ? (vendNombre ?? null) : null,
          agente_comprador_externo: !compInterno ? (compNombre ?? null) : null,
          tipologia:                params.tipologia,
          tipo_operacion:           params.tipo_operacion,
          tiene_reserva:            params.tiene_reserva ?? false,
          monto_reserva_usd:        params.monto_reserva_usd ?? null,
          monto_ofertado_usd:       params.monto_ofertado_usd ?? null,
          precio_publicacion_usd:   params.precio_publicacion_usd ?? null,
          fecha_oferta:             today,
          estado:                   "Espera rta. vendedor",
          es_bis:                   false,
          numero_padre:             null,
          notas:                    null,
          comision_cobrada:         false,
          checklist_completado:     false,
        })
        .select("id")
        .single()

      if (error || !oferta) {
        return { success: false, message: error?.message ?? "Error al crear la oferta" }
      }

      await supabase.from("ofertas_historial").insert({
        oferta_id:   oferta.id,
        tipo:        "Alta",
        descripcion: "Oferta creada desde asistente IA",
        monto_usd:   null,
      })

      return {
        success: true,
        message: `✅ Oferta ${params.numero} creada en "${params.direccion}"`,
        data: { id: oferta.id },
      }
    }

    case "cambiar_estado_oferta": {
      const numero = params.numero as number
      const nuevoEstado = params.nuevo_estado as string
      const descripcion = (params.descripcion as string) ?? ""

      const { data: oferta, error: fetchError } = await supabase
        .from("ofertas")
        .select("id")
        .eq("numero", numero)
        .single()

      if (fetchError || !oferta) {
        return { success: false, message: `No encontré la oferta ${numero}` }
      }

      const updates: Record<string, unknown> = { estado: nuevoEstado }
      if (nuevoEstado === "Cerradas") updates.fecha_cierre = today

      const { error } = await supabase.from("ofertas").update(updates).eq("id", oferta.id)
      if (error) return { success: false, message: error.message }

      await supabase.from("ofertas_historial").insert({
        oferta_id:   oferta.id,
        tipo:        "Cambio de estado",
        descripcion: `${nuevoEstado}${descripcion ? ` — ${descripcion}` : ""}`,
        monto_usd:   null,
      })

      return { success: true, message: `✅ Oferta ${numero} → "${nuevoEstado}"` }
    }

    case "registrar_pago": {
      const agente = findAgent(agentes, params.agente_nombre as string)
      if (!agente) {
        return { success: false, message: `No encontré al agente "${params.agente_nombre}"` }
      }

      const monto = params.monto_pagado as number
      const { error } = await supabase.from("pagos").insert({
        agente_id:    agente.id,
        fecha:        (params.fecha as string) ?? today,
        concepto:     params.concepto,
        monto_debe:   monto,
        monto_pagado: monto,
        estado:       "Pagado",
      })

      if (error) return { success: false, message: error.message }
      return {
        success: true,
        message: `✅ Pago de $${Number(monto).toLocaleString("es-AR")} registrado para ${agente.nombre}`,
      }
    }

    case "registrar_operacion": {
      const comision = params.comision_bruta as number
      const { error } = await supabase.from("operaciones").insert({
        fecha:              (params.fecha as string) ?? today,
        direccion:          params.direccion,
        agentes:            params.agentes,
        tipo:               params.tipo,
        comision_bruta:     comision,
        comision_neta:      comision,
        encuesta_comprador: false,
        encuesta_vendedor:  false,
      })

      if (error) return { success: false, message: error.message }
      return { success: true, message: `✅ Operación registrada: ${params.direccion}` }
    }

    case "registrar_encuesta": {
      const subtipo =
        !params.subtipo || params.subtipo === "null" ? null : (params.subtipo as string)
      const { error } = await supabase.from("encuestas_registros").insert({
        fecha:      today,
        tipo:       params.tipo,
        subtipo,
        referencia: params.referencia,
        nps:        params.nps,
        comentario: (params.comentario as string) || null,
      })

      if (error) return { success: false, message: error.message }
      return { success: true, message: `✅ Encuesta registrada (NPS: ${params.nps})` }
    }

    default:
      return { success: false, message: "Acción no reconocida" }
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Diagnóstico de env ────────────────────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY ?? ""
  console.log(
    "[ai-assistant] GEMINI_API_KEY presente:",
    !!apiKey,
    "| primeros 10 chars:",
    apiKey ? apiKey.slice(0, 10) + "..." : "(vacía)"
  )

  if (!apiKey) {
    console.error("[ai-assistant] GEMINI_API_KEY no está definida en el entorno")
    return NextResponse.json(
      { message: "GEMINI_API_KEY no configurada en el servidor." },
      { status: 500 }
    )
  }

  try {
    const body = await req.json()
    const supabase = createServerClient()

    // Fetch context in parallel every request to keep it fresh
    const [agentesRes, ofertasRes] = await Promise.all([
      supabase.from("agentes").select("id, nombre").eq("activo", true),
      supabase
        .from("ofertas")
        .select("numero, direccion, estado")
        .neq("estado", "Cerradas")
        .neq("estado", "Caídas")
        .order("numero", { ascending: false })
        .limit(50),
    ])

    const agentes: Agente[] = agentesRes.data ?? []
    const ofertas: Oferta[] = ofertasRes.data ?? []

    // Mode 1: Execute a confirmed action directly (no Gemini call)
    if (body.executeAction) {
      const { intent, params } = body.executeAction as {
        intent: string
        params: Record<string, unknown>
      }
      const result = await executeAction(intent, params, agentes)
      return NextResponse.json(result)
    }

    // Mode 2: Chat with Gemini
    const { message, history = [] } = body as {
      message: string
      history: { role: string; content: string }[]
    }

    if (!message?.trim()) {
      return NextResponse.json({ message: "Mensaje vacío." }, { status: 400 })
    }

    const systemPrompt = buildSystemPrompt(agentes, ofertas)
    const geminiResponse = await callGemini(systemPrompt, history, message)

    // Intents that have no side-effects to execute
    const NO_ACTION_INTENTS = ["consultar", "no_entendido"]
    const shouldExecute =
      !geminiResponse.requiresConfirmation &&
      !NO_ACTION_INTENTS.includes(geminiResponse.intent)

    if (shouldExecute) {
      const result = await executeAction(geminiResponse.intent, geminiResponse.params, agentes)
      return NextResponse.json({
        message: result.success
          ? `${geminiResponse.response}\n\n${result.message}`
          : `${geminiResponse.response}\n\n❌ ${result.message}`,
        intent: geminiResponse.intent,
        success: result.success,
      })
    }

    return NextResponse.json({
      message: geminiResponse.response,
      intent: geminiResponse.intent,
      params: geminiResponse.params,
      requiresConfirmation: geminiResponse.requiresConfirmation,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const errStack = err instanceof Error ? err.stack : undefined
    console.error("[ai-assistant] Error:", errMsg)
    if (errStack) console.error("[ai-assistant] Stack:", errStack)
    return NextResponse.json(
      {
        message: `Error del servidor: ${errMsg}`,
        debug: {
          error: errMsg,
          geminiModel: "gemini-1.5-flash",
          hasApiKey: !!process.env.GEMINI_API_KEY,
        },
      },
      { status: 500 }
    )
  }
}
