import { createServerClient } from "@/lib/supabase"
import EncuestasClient from "./EncuestasClient"

export interface RegistroRow {
  id:         string
  fecha:      string
  tipo:       string
  subtipo:    string | null
  referencia: string
  nps:        number | null
  comentario: string | null
  created_at: string
}

function mesKey(fechaStr: string): string {
  return fechaStr.substring(0, 7) // "YYYY-MM"
}

// Cuenta cuántas puntas de una operación fueron manejadas por agentes internos.
// Cada punta interna equivale a 1 encuesta esperada.
function contarPuntasInternas(agentesTexto: string, nombresInternos: Set<string>): number {
  // Caso "(2 puntas)": mismo agente en ambos lados
  const match2Puntas = agentesTexto.match(/^(.+?)\s*\(2 puntas\)$/i)
  if (match2Puntas) {
    const nombre = match2Puntas[1].trim()
    return nombresInternos.has(nombre) ? 2 : 0
  }
  // Caso "Agente1 / Agente2" (puede incluir externos: "Otra inmobiliaria: X", "Datero interior", etc.)
  const partes = agentesTexto.split("/").map(s => s.trim())
  return partes.filter(p => nombresInternos.has(p)).length
}

export default async function EncuestasPage() {
  const supabase  = createServerClient()
  const now       = new Date()
  const anio      = now.getFullYear()
  const mesActual = now.getMonth() + 1

  // Query last 6 months of individual records
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const desde = sixMonthsAgo.toISOString().split("T")[0]

  const { data: registros } = await supabase
    .from("encuestas_registros")
    .select("id, fecha, tipo, subtipo, referencia, nps, comentario, created_at")
    .gte("fecha", desde)
    .eq("eliminado", false)
    .order("fecha", { ascending: false })

  // Config: objetivo % de encuestas con NPS
  const { data: configObj } = await supabase
    .from("config")
    .select("valor")
    .eq("clave", "obj_encuestas_pct")
    .maybeSingle()

  const objetivoPct = parseInt(configObj?.valor ?? "60") || 60

  // Operaciones (Venta/Alquiler) de los últimos 6 meses + agentes internos.
  // Se cuentan las puntas internas reales (parseando el campo `agentes`) = encuestas esperadas por mes.
  const { data: operacionesData } = await supabase
    .from("operaciones")
    .select("fecha, tipo, agentes")
    .in("tipo", ["Venta", "Alquiler"])
    .gte("fecha", desde)

  const { data: agentesData } = await supabase
    .from("agentes")
    .select("nombre")

  const nombresInternos = new Set((agentesData ?? []).map(a => a.nombre))

  const opCountByMes: Record<string, number> = {}
  for (const op of (operacionesData ?? [])) {
    if (!op.agentes) continue
    const puntas = contarPuntasInternas(op.agentes, nombresInternos)
    const k = mesKey(op.fecha)
    opCountByMes[k] = (opCountByMes[k] ?? 0) + puntas
  }

  return (
    <EncuestasClient
      registros={(registros ?? []) as RegistroRow[]}
      objetivoPct={objetivoPct}
      mesActual={mesActual}
      anio={anio}
      opCountByMes={opCountByMes}
    />
  )
}
