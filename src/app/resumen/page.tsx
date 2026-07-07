import { createServerClient } from "@/lib/supabase"
import ResumenClient from "./ResumenClient"
import type { KpiRow } from "./ResumenClient"

// Monthly seasonality fractions — sum ≈ 1.00
// Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep  Oct  Nov  Dec
const SEASON = [0.07, 0.07, 0.08, 0.08, 0.09, 0.07, 0.06, 0.08, 0.10, 0.11, 0.11, 0.08]

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]

function nextMonthDate(year: number, month: number) {
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`
}

function getConceptGroup(concepto: string): "FEE" | "CRM" | "Mainstreet" | "Otros" {
  const c = concepto.toLowerCase()
  if (c.includes("fee"))                                                              return "FEE"
  if (c.includes("pro") || c.includes("crm") || c.includes("plan") || c.includes("licencia")) return "CRM"
  if (c.includes("mainstreet"))                                                       return "Mainstreet"
  return "Otros"
}

export default async function ResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; anio?: string }>
}) {
  const { mes, anio } = await searchParams
  const now   = new Date()
  const year  = anio ? Math.max(2020, Math.min(2099, parseInt(anio))) : now.getFullYear()
  const month = mes  ? Math.max(1,    Math.min(12,   parseInt(mes)))  : now.getMonth() + 1

  const supabase  = createServerClient()
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`
  const endDate   = nextMonthDate(year, month)

  const [
    { data: pagos },
    { data: agentes },
    { data: encuestas },
    { data: operaciones },
    { data: configs },
    { count: cartelesDevueltosCount },
  ] = await Promise.all([
    supabase.from("pagos")
      .select("agente_id, monto_debe, monto_pagado, estado, concepto")
      .gte("fecha", startDate).lt("fecha", endDate),
    supabase.from("agentes")
      .select("id, paga_fee, licencia, activo")
      .eq("activo", true),
    supabase.from("encuestas_registros")
      .select("nps")
      .gte("fecha", startDate).lt("fecha", endDate)
      .eq("eliminado", false),
    supabase.from("operaciones")
      .select("comision_bruta")
      .gte("fecha", startDate).lt("fecha", endDate),
    supabase.from("config")
      .select("clave, valor")
      .in("clave", ["obj_facturacion_anual", "obj_encuestas_nps", "obj_carteles"]),
    supabase.from("carteles_devueltos")
      .select("*", { count: "exact", head: true })
      .gte("fecha_devolucion", startDate)
      .lt("fecha_devolucion", endDate),
  ])

  const cartelesCount = cartelesDevueltosCount ?? 0

  // ── Config values ────────────────────────────────────────
  const configMap = Object.fromEntries((configs ?? []).map(c => [c.clave, c.valor]))
  const objFactAnual  = parseFloat(configMap.obj_facturacion_anual ?? "710000") || 710000
  const objNps        = parseFloat(configMap.obj_encuestas_nps     ?? "8.0")    || 8.0
  const objCarteles   = parseInt(configMap.obj_carteles            ?? "20")     || 20

  // ── Cobros ───────────────────────────────────────────────
  const pagosData     = pagos   ?? []
  const agentesData   = agentes ?? []
  const activos       = agentesData.filter(a => a.activo)
  const agentesFee    = Math.max(activos.filter(a => a.paga_fee === true).length, 1)
  const agentesCrm    = Math.max(
    activos.filter(a => a.paga_fee && a.licencia && a.licencia !== "---").length, 1
  )
  const agentesTotal  = Math.max(activos.length, 1)

  const feePagados  = new Set(pagosData.filter(p => getConceptGroup(p.concepto) === "FEE"        && p.estado === "Pagado").map(p => p.agente_id)).size
  const crmPagados  = new Set(pagosData.filter(p => getConceptGroup(p.concepto) === "CRM"        && p.estado === "Pagado").map(p => p.agente_id)).size
  const mainPagados = new Set(pagosData.filter(p => getConceptGroup(p.concepto) === "Mainstreet" && p.estado === "Pagado").map(p => p.agente_id)).size

  const feePct   = Math.round((feePagados  / agentesFee)   * 100)
  const crmPct   = Math.round((crmPagados  / agentesCrm)   * 100)
  const mainPct  = Math.round((mainPagados / agentesTotal)  * 100)
  const cobrosPct = Math.round((feePct + crmPct + mainPct) / 3)
  const cobrosACobrar = cobrosPct >= 100 ? 100 : 0

  // ── Cartelería ───────────────────────────────────────────
  const cartelesACobrar = cartelesCount >= objCarteles ? 100 : 0

  // ── Encuestas NPS ────────────────────────────────────────
  const npsValues  = (encuestas ?? []).filter(e => e.nps !== null).map(e => e.nps as number)
  const avgNps     = npsValues.length > 0 ? npsValues.reduce((a, b) => a + b, 0) / npsValues.length : null
  const encACobrar = avgNps !== null && avgNps >= objNps ? 100 : 0

  // ── Facturación ──────────────────────────────────────────
  const comisionTotal  = (operaciones ?? []).reduce((s, o) => s + (Number(o.comision_bruta) || 0), 0)
  const objFactMensual = objFactAnual * SEASON[month - 1]
  const factRatio      = objFactMensual > 0 ? comisionTotal / objFactMensual : 0
  const factACobrar    = Math.round(Math.min(factRatio, 1) * 100)

  const totalACobrar = cobrosACobrar + cartelesACobrar + encACobrar + factACobrar

  function fmtUSD(n: number) {
    return `USD ${Math.round(n).toLocaleString("es-AR")}`
  }

  const kpis: KpiRow[] = [
    {
      label:    "Cobros",
      objetivo: "100% de cobranza",
      cumplido: `${cobrosPct}% prom. (FEE ${feePct}%, CRM ${crmPct}%, MS ${mainPct}%)`,
      aCobrar:  cobrosACobrar,
    },
    {
      label:    "Cartelería",
      objetivo: `${objCarteles} carteles recuperados`,
      cumplido: `${cartelesCount} cartel${cartelesCount !== 1 ? "es" : ""} recuperado${cartelesCount !== 1 ? "s" : ""}`,
      aCobrar:  cartelesACobrar,
    },
    {
      label:    "Encuestas NPS",
      objetivo: `NPS ≥ ${objNps.toFixed(1)}`,
      cumplido: avgNps !== null
        ? `NPS ${avgNps.toFixed(1)} (${npsValues.length} enc.)`
        : "Sin encuestas este mes",
      aCobrar:  encACobrar,
    },
    {
      label:    "Facturación",
      objetivo: fmtUSD(objFactMensual),
      cumplido: `${fmtUSD(comisionTotal)} (${Math.round(factRatio * 100)}%)`,
      aCobrar:  factACobrar,
    },
  ]

  return (
    <ResumenClient
      mes={`${MONTH_NAMES[month - 1]} ${year}`}
      kpis={kpis}
      totalACobrar={totalACobrar}
      selectedMonth={month}
      selectedYear={year}
    />
  )
}
