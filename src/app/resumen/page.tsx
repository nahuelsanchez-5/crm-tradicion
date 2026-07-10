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

// ── Airtable: carteles con vencimiento en el mes (aún activos) ───────────────
interface AirtableRecord {
  id: string
  fields: Record<string, unknown>
}

async function fetchAirtableVencimientosEnMes(start: string, end: string): Promise<number | null> {
  try {
    const params = new URLSearchParams()
    params.append("fields[]", "fldnLaQjKRCD8vezt")   // vencimiento
    params.set("returnFieldsByFieldId", "true")
    params.set("pageSize", "100")
    const res = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_CARTELERIA_TABLE_ID}?${params}`,
      { headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` }, cache: "no-store" }
    )
    if (!res.ok) return null
    const json = (await res.json()) as { records?: AirtableRecord[] }
    return (json.records ?? []).filter(r => {
      const venc = (r.fields["fldnLaQjKRCD8vezt"] as string) ?? ""
      return venc >= start && venc < end
    }).length
  } catch {
    return null
  }
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
    atVencEnMes,
  ] = await Promise.all([
    supabase.from("pagos")
      .select("agente_id, monto_debe, monto_pagado, estado, concepto")
      .gte("fecha", startDate).lt("fecha", endDate),
    supabase.from("agentes")
      .select("id, paga_fee, tipo_plan, activo")
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
      .in("clave", ["obj_facturacion_anual", "obj_encuestas_pct", "obj_carteles"]),
    supabase.from("carteles_devueltos")
      .select("*", { count: "exact", head: true })
      .gte("fecha_devolucion", startDate)
      .lt("fecha_devolucion", endDate),
    fetchAirtableVencimientosEnMes(startDate, endDate),
  ])

  const cartelesCount = cartelesDevueltosCount ?? 0

  // ── Config values ────────────────────────────────────────
  const configMap   = Object.fromEntries((configs ?? []).map(c => [c.clave, c.valor]))
  const objFactAnual = parseFloat(configMap.obj_facturacion_anual ?? "710000") || 710000
  const objEncPct    = parseInt(configMap.obj_encuestas_pct       ?? "60")     || 60
  const objCarteles  = parseInt(configMap.obj_carteles            ?? "20")     || 20

  // ── Cobros — fórmula ponderada: SUMA(cobrado)/SUMA(total) × 100 ─────────────
  const pagosData    = pagos ?? []
  const agentesData  = agentes ?? []
  const activos      = agentesData.filter(a => a.activo)

  // FEE: agentes con paga_fee = true
  const agentesFee   = Math.max(activos.filter(a => a.paga_fee === true).length, 1)

  // CRM: solo PRO y PRO+ — Bonificado (B QR, B Ofi) y sin plan NO cuentan
  const agenteCrmIds = new Set(
    activos.filter(a => a.tipo_plan === "PRO" || a.tipo_plan === "PRO+").map(a => a.id)
  )
  const agentesCrm   = Math.max(agenteCrmIds.size, 1)

  // Mainstreet: todos los activos
  const agentesTotal = Math.max(activos.length, 1)

  const feePagados  = new Set(pagosData.filter(p => getConceptGroup(p.concepto) === "FEE"        && p.estado === "Pagado").map(p => p.agente_id)).size
  // crmPagados solo cuenta agentes que efectivamente tienen plan PRO/PRO+
  const crmPagados  = new Set(pagosData.filter(p => getConceptGroup(p.concepto) === "CRM" && p.estado === "Pagado" && agenteCrmIds.has(p.agente_id)).map(p => p.agente_id)).size
  const mainPagados = new Set(pagosData.filter(p => getConceptGroup(p.concepto) === "Mainstreet" && p.estado === "Pagado").map(p => p.agente_id)).size

  // Individual pcts for display
  const feePct  = Math.round((feePagados  / agentesFee)   * 100)
  const crmPct  = Math.round((crmPagados  / agentesCrm)   * 100)
  const mainPct = Math.round((mainPagados / agentesTotal)  * 100)

  // Ponderada: SUMA(cobrado) / SUMA(total) × 100
  const cobrosPct    = Math.round(((feePagados + crmPagados + mainPagados) / (agentesFee + agentesCrm + agentesTotal)) * 100)
  const cobrosACobrar = cobrosPct >= 100 ? 100 : 0

  // ── Cartelería — fórmula dinámica: recuperados/pendientes × 100 ─────────────
  // pendientes del mes = carteles aún activos en Airtable con venc. en el mes + ya recuperados
  const pendientesTotales = atVencEnMes !== null ? atVencEnMes + cartelesCount : null
  const pctCartDin = pendientesTotales !== null && pendientesTotales > 0
    ? Math.round((cartelesCount / pendientesTotales) * 100)
    : null

  const cartelesACobrar = (() => {
    if (pctCartDin === null)         return cartelesCount >= objCarteles ? 100 : 0
    if (pendientesTotales === 0)     return cartelesCount >= objCarteles ? 100 : 0
    return pctCartDin >= 100 ? 100 : 0
  })()

  // ── Encuestas — tasa de respuesta: (enc.)/(ops×2) ≥ obj% ────────────────────
  const encuestasData  = encuestas ?? []
  const totalEncuestas = encuestasData.length
  const npsValues      = encuestasData.filter(e => e.nps !== null).map(e => e.nps as number)
  const avgNps         = npsValues.length > 0 ? npsValues.reduce((a, b) => a + b, 0) / npsValues.length : null
  const totalOps       = (operaciones ?? []).length
  const tasaRespPct    = totalOps > 0 ? Math.round((totalEncuestas / (totalOps * 2)) * 100) : 0
  const encACobrar     = tasaRespPct >= objEncPct ? 100 : 0

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
      objetivo: "100% de cobranza (ponderado)",
      cumplido: `${cobrosPct}% (Fee ${feePagados}/${agentesFee} = ${feePct}%, CRM ${crmPagados}/${agentesCrm} = ${crmPct}%, MS ${mainPagados}/${agentesTotal} = ${mainPct}%)`,
      aCobrar:  cobrosACobrar,
    },
    {
      label:    "Cartelería",
      objetivo: pendientesTotales !== null ? "100% de pendientes del mes" : `${objCarteles} carteles recuperados`,
      cumplido: pctCartDin !== null
        ? `${cartelesCount}/${pendientesTotales} recuperados (${pctCartDin}%)`
        : pendientesTotales === 0
          ? `Sin vencimientos este mes (${cartelesCount} recuperados igualmente)`
          : `${cartelesCount} cartel${cartelesCount !== 1 ? "es" : ""} recuperado${cartelesCount !== 1 ? "s" : ""}`,
      aCobrar:  cartelesACobrar,
    },
    {
      label:    "Encuestas",
      objetivo: `Tasa de respuesta ≥ ${objEncPct}%`,
      cumplido: totalEncuestas === 0 && totalOps === 0
        ? "Sin encuestas ni operaciones este mes"
        : `${tasaRespPct}% resp. (${totalEncuestas} enc. / ${totalOps * 2} esp.)${avgNps !== null ? ` · NPS prom. ${avgNps.toFixed(1)}` : ""}`,
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
