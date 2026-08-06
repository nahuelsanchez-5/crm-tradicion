import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth-guard"
import { createServerClient } from "@/lib/supabase"

// ── Field IDs de Airtable (mismos que carteleria/page.tsx) ──
const CARTEL_FIELD_IDS = [
  "fldsAoewlr0711e3s",   // Nº de cartel
  "fldjm8EB1HVvQeCSQ",   // Dirección
  "fldClqD1zmj0AYlBn",   // Días restantes (fórmula, solo lectura)
]

interface AirtableRecord {
  id:     string
  fields: Record<string, unknown>
}

interface CartelMin {
  id:            string
  numero:        number
  direccion:     string
  diasRestantes: number
}

// Réplica de fetchCarteles (carteleria/page.tsx), trayendo solo los 3 campos que
// necesita la alerta: numero, direccion y diasRestantes.
async function fetchCartelesMin(): Promise<CartelMin[]> {
  const params = new URLSearchParams()
  CARTEL_FIELD_IDS.forEach(id => params.append("fields[]", id))
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
    return (json.records ?? []).map(r => ({
      id:            r.id,
      numero:        (r.fields["fldsAoewlr0711e3s"] as number)  ?? 0,
      direccion:     ((r.fields["fldjm8EB1HVvQeCSQ"] as string) ?? "").trim(),
      diasRestantes: (r.fields["fldClqD1zmj0AYlBn"]  as number) ?? 0,
    }))
  } catch {
    return []
  }
}

// Réplica de nextMainstreetDate (agentes/AgentesClient.tsx): ignora el año,
// solo mes/día; si ya pasó este año, usa el del año siguiente.
function nextMainstreetDate(fechaStr: string): Date {
  const alta  = new Date(fechaStr + "T00:00:00")
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const candidate = new Date(alta)
  candidate.setFullYear(today.getFullYear())
  if (candidate < today) candidate.setFullYear(today.getFullYear() + 1)
  return candidate
}

export async function GET(): Promise<NextResponse> {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const supabase = createServerClient()

    // ── 1. Ofertas sin actividad +5 días (mismo cutoff5d que page.tsx) ──
    const cutoff5d = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

    const [
      { data: ofertasSinActividadRaw },
      carteles,
      { data: agentesRaw },
    ] = await Promise.all([
      supabase.from("ofertas")
        .select("id, numero, direccion, estado, updated_at")
        .neq("estado", "Cerradas")
        .neq("estado", "Caídas")
        .lt("updated_at", cutoff5d)
        .order("updated_at", { ascending: true }),
      // ── 2. Cartelería (mismo fetch que carteleria/page.tsx) ──
      fetchCartelesMin(),
      // ── 3. Mainstreet: agentes activos con fecha_mainstreet ──
      supabase.from("agentes")
        .select("nombre, fecha_mainstreet")
        .eq("activo", true)
        .not("fecha_mainstreet", "is", null)
        .order("nombre"),
    ])

    // ── 1. Ofertas ──
    const ofertasItems = ((ofertasSinActividadRaw ?? []) as Array<{
      id: string; numero: number; direccion: string; estado: string; updated_at: string
    }>).map(o => ({
      id:        o.id,
      numero:    o.numero,
      direccion: o.direccion,
      dias:      Math.floor((Date.now() - new Date(o.updated_at).getTime()) / (1000 * 60 * 60 * 24)),
      href:      `/ofertas/${o.id}`,
    }))

    // ── 2. Cartelería: vencidos (<0) + próximos (0–10), mismo criterio que CarteleriaClient ──
    const cartelItems = carteles
      .filter(c => c.diasRestantes < 0 || (c.diasRestantes >= 0 && c.diasRestantes <= 10))
      .map(c => ({
        id:            c.id,
        numero:        c.numero,
        direccion:     c.direccion,
        diasRestantes: c.diasRestantes,
        href:          "/carteleria",
      }))

    // ── 3. Mainstreet: próximo aniversario dentro de los próximos 7 días (inclusive) ──
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const mainstreetItems = ((agentesRaw ?? []) as Array<{ nombre: string; fecha_mainstreet: string | null }>)
      .filter(a => a.fecha_mainstreet)
      .map(a => {
        const date = nextMainstreetDate(a.fecha_mainstreet!)
        const diasFaltan = Math.round((date.getTime() - today.getTime()) / 86400000)
        return {
          nombre:     a.nombre,
          fecha:      date.toISOString().split("T")[0],
          diasFaltan,
          href:       "/agentes",
        }
      })
      .filter(a => a.diasFaltan >= 0 && a.diasFaltan <= 7)
      .sort((a, b) => a.diasFaltan - b.diasFaltan)

    const categorias = {
      ofertas:    { count: ofertasItems.length,    items: ofertasItems },
      carteleria: { count: cartelItems.length,     items: cartelItems },
      mainstreet: { count: mainstreetItems.length, items: mainstreetItems },
    }

    const total = categorias.ofertas.count + categorias.carteleria.count + categorias.mainstreet.count

    return NextResponse.json({ total, categorias })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    )
  }
}
