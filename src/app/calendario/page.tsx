import { createServerClient } from "@/lib/supabase"
import CalendarioClient from "./CalendarioClient"
import { hoyArgentina } from "@/lib/fecha"

export type EventoItem = {
  id: string
  title: string
  date: string
  backgroundColor: string
  borderColor: string
  textColor: string
  tipo: "cierre" | "mainstreet" | "inactiva"
  ofertaId?: string
}

export type OfertaInactiva = {
  id: string
  numero: number
  direccion: string
}

function nextMainstreetDate(fechaStr: string, today: Date): string {
  const alta = new Date(fechaStr + "T00:00:00")
  const candidate = new Date(alta)
  const t = new Date(today); t.setHours(0, 0, 0, 0)
  candidate.setFullYear(t.getFullYear())
  if (candidate <= t) candidate.setFullYear(t.getFullYear() + 1)
  return candidate.toISOString().split("T")[0]
}

export default async function CalendarioPage() {
  const supabase = createServerClient()
  const today = new Date()
  const todayStr = hoyArgentina()

  const fiveDaysAgo = new Date(today)
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)

  const [
    { data: cierres },
    { data: agentes },
    { data: inactivasRaw },
  ] = await Promise.all([
    supabase
      .from("ofertas")
      .select("id, numero, direccion, fecha_cierre")
      .eq("estado", "Cerradas")
      .not("fecha_cierre", "is", null),
    supabase
      .from("agentes")
      .select("id, nombre, fecha_mainstreet")
      .eq("activo", true)
      .not("fecha_mainstreet", "is", null),
    supabase
      .from("ofertas")
      .select("id, numero, direccion, updated_at")
      .neq("estado", "Cerradas")
      .neq("estado", "Caídas")
      .lt("updated_at", fiveDaysAgo.toISOString()),
  ])

  const eventos: EventoItem[] = [
    ...(cierres ?? []).map(c => ({
      id:              `cierre-${c.id}`,
      title:           String(c.direccion),
      date:            String(c.fecha_cierre),
      backgroundColor: "#22c55e",
      borderColor:     "#16a34a",
      textColor:       "#052e16",
      tipo:            "cierre" as const,
    })),
    ...(agentes ?? []).map(a => ({
      id:              `ms-${a.id}`,
      title:           `Mainstreet — ${a.nombre}`,
      date:            nextMainstreetDate(String(a.fecha_mainstreet), today),
      backgroundColor: "#3b82f6",
      borderColor:     "#1d4ed8",
      textColor:       "#eff6ff",
      tipo:            "mainstreet" as const,
    })),
    ...(inactivasRaw ?? []).map(o => ({
      id:              `inactiva-${o.id}`,
      title:           `Sin actividad — ${o.direccion}`,
      date:            todayStr,
      backgroundColor: "#f97316",
      borderColor:     "#c2410c",
      textColor:       "#fff7ed",
      tipo:            "inactiva" as const,
      ofertaId:        o.id,
    })),
  ]

  const ofertasInactivas: OfertaInactiva[] = (inactivasRaw ?? []).map(o => ({
    id:        o.id,
    numero:    o.numero as number,
    direccion: String(o.direccion),
  }))

  return (
    <CalendarioClient
      eventos={eventos}
      hoy={todayStr}
      ofertasInactivas={ofertasInactivas}
    />
  )
}
