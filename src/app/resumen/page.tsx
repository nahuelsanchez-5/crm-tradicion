import { createServerClient } from "@/lib/supabase"
import ResumenClient from "./ResumenClient"
import type { KpiRow } from "./ResumenClient"
import { fmtUSD } from "@/lib/format"
import { getEfectivoPagaFee } from "@/lib/fee"
import { limitesMesArgentina, mesAnioArgentina } from "@/lib/fecha"
import { CLAVE_OBJETIVO_ANUAL, calcObjetivoMes, parseObjetivoAnual, realDelMes } from "@/lib/objetivos"

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]

const MONTH_KEYS = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
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
  const hoy   = mesAnioArgentina()
  // parseInt("abc") = NaN: si el parámetro no es un número válido se usa el mes/año actual
  const anioParam = parseInt(anio ?? "", 10)
  const mesParam  = parseInt(mes  ?? "", 10)
  const year  = Number.isFinite(anioParam) ? Math.max(2020, Math.min(2099, anioParam)) : hoy.anio
  const month = Number.isFinite(mesParam)  ? Math.max(1,    Math.min(12,   mesParam))  : hoy.mes

  const supabase  = createServerClient()
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`
  const endDate   = nextMonthDate(year, month)

  const objCartelesMesKey = `obj_carteles_${MONTH_KEYS[month - 1]}`

  const [
    { data: pagos },
    { data: agentes },
    { data: encuestas },
    { data: operaciones },
    { data: configs },
    { data: factManual },
    { count: cartelesDevueltosCount },
  ] = await Promise.all([
    supabase.from("pagos")
      .select("agente_id, monto_debe, monto_pagado, estado, concepto")
      .gte("fecha", startDate).lt("fecha", endDate),
    supabase.from("agentes")
      .select("id, nombre, paga_fee, tipo_plan, activo, fecha_mainstreet, fecha_alta")
      .eq("activo", true),
    supabase.from("encuestas_registros")
      .select("nps")
      .gte("fecha", startDate).lt("fecha", endDate)
      .eq("eliminado", false),
    supabase.from("operaciones")
      .select("comision_bruta, agentes, tipo")
      .gte("fecha", startDate).lt("fecha", endDate),
    supabase.from("config")
      .select("clave, valor")
      .in("clave", [CLAVE_OBJETIVO_ANUAL, "obj_encuestas_pct", objCartelesMesKey]),
    supabase.from("facturacion")
      .select("real_usd")
      .eq("mes", month).eq("anio", year)
      .maybeSingle(),
    supabase.from("carteles_devueltos")
      .select("*", { count: "exact", head: true })
      .gte("fecha_devolucion", limitesMesArgentina(year, month).desde)
      .lt("fecha_devolucion", limitesMesArgentina(year, month).hasta),
  ])

  const cartelesCount = cartelesDevueltosCount ?? 0

  // ── Config values ────────────────────────────────────────
  const configMap    = Object.fromEntries((configs ?? []).map(c => [c.clave, c.valor]))
  const objFactAnual = parseObjetivoAnual(configMap[CLAVE_OBJETIVO_ANUAL])
  const objEncPct    = parseInt(configMap.obj_encuestas_pct       ?? "60")     || 60
  const objCartelesMes = parseInt(configMap[objCartelesMesKey]    ?? "0")      || 0

  // ── Cobros — fórmula ponderada: SUMA(cobrado)/SUMA(total) × 100 ─────────────
  const pagosData    = pagos ?? []
  const agentesData  = agentes ?? []
  const activos      = agentesData.filter(a => a.activo)

  // FEE: agentes que efectivamente pagan fee (override manual o cálculo 180 días + quincena)
  const agentesFee   = activos.filter(a => getEfectivoPagaFee(a.fecha_alta, a.paga_fee)).length

  // CRM: solo PRO y PRO+ — Bonificado (B QR, B Ofi) y sin plan NO cuentan
  const agenteCrmIds = new Set(
    activos.filter(a => a.tipo_plan === "PRO" || a.tipo_plan === "PRO+").map(a => a.id)
  )
  const agentesCrm   = agenteCrmIds.size

  // Mainstreet: solo agentes cuyo aniversario (mes de fecha_mainstreet) cae en el mes seleccionado
  const agentesMainstreet =
    activos.filter(a => a.fecha_mainstreet && new Date(a.fecha_mainstreet + "T00:00:00").getMonth() + 1 === month).length

  const feePagados  = new Set(pagosData.filter(p => getConceptGroup(p.concepto) === "FEE"        && p.estado === "Pagado").map(p => p.agente_id)).size
  // crmPagados solo cuenta agentes que efectivamente tienen plan PRO/PRO+
  const crmPagados  = new Set(pagosData.filter(p => getConceptGroup(p.concepto) === "CRM" && p.estado === "Pagado" && agenteCrmIds.has(p.agente_id)).map(p => p.agente_id)).size
  const mainPagados = new Set(pagosData.filter(p => getConceptGroup(p.concepto) === "Mainstreet" && p.estado === "Pagado").map(p => p.agente_id)).size

  // Individual pcts for display
  // Un grupo sin agentes esperados (ej: mes sin aniversarios Mainstreet) no entra en el cálculo
  const pctGrupo = (pagados: number, esperados: number) => esperados > 0 ? Math.round((pagados / esperados) * 100) : 0
  const feePct  = pctGrupo(feePagados,  agentesFee)
  const crmPct  = pctGrupo(crmPagados,  agentesCrm)
  const mainPct = pctGrupo(mainPagados, agentesMainstreet)

  // Ponderada: SUMA(cobrado) / SUMA(total) × 100
  const cobrosEsperados = agentesFee + agentesCrm + agentesMainstreet
  const cobrosRatio     = cobrosEsperados > 0 ? (feePagados + crmPagados + mainPagados) / cobrosEsperados : 0
  const cobrosPct       = Math.round(cobrosRatio * 100)
  // El bono se evalúa sobre el ratio exacto (99,5% redondeado a 100 no debe cobrar)
  const cobrosACobrar   = cobrosEsperados > 0 && cobrosRatio >= 1 ? 100 : 0

  // ── Cartelería — fórmula: recuperados / objetivo_mes × 100 ─────────────────
  const pctCartMes = objCartelesMes > 0
    ? Math.round((cartelesCount / objCartelesMes) * 100)
    : null

  const cartelesACobrar = objCartelesMes > 0 && cartelesCount >= objCartelesMes ? 100 : 0

  // ── Encuestas — denominador = puntas internas en operaciones de Venta/Alquiler ───────
  const encuestasData  = encuestas ?? []
  const totalEncuestas = encuestasData.length
  const npsValues      = encuestasData.filter(e => e.nps !== null).map(e => e.nps as number)
  const avgNps         = npsValues.length > 0 ? npsValues.reduce((a, b) => a + b, 0) / npsValues.length : null

  // Set de nombres internos (agentes activos de Tradición)
  const internos = new Set(
    agentesData.map(a => a.nombre as string).filter(Boolean)
  )

  // Sumar puntas internas en operaciones de tipo Venta o Alquiler del mes
  const totalEncuestasEsperadas = (operaciones ?? [])
    .filter(o => o.tipo === "Venta" || o.tipo === "Alquiler")
    .reduce((sum, o) => {
      const agStr = (o.agentes as string) ?? ""
      if (agStr.endsWith("(2 puntas)")) {
        const base = agStr.replace(/ \(2 puntas\)$/, "").trim()
        return sum + (internos.has(base) ? 2 : 0)
      }
      return sum + agStr.split(" / ").filter(p => internos.has(p.trim())).length
    }, 0)

  const tasaRespPct = totalEncuestasEsperadas > 0
    ? Math.round((totalEncuestas / totalEncuestasEsperadas) * 100)
    : 0
  const encACobrar  = totalEncuestasEsperadas > 0 && tasaRespPct >= objEncPct ? 100 : 0

  // ── Facturación ──────────────────────────────────────────
  // Misma regla que Dashboard y Facturación: carga manual si existe (>0), si no comisiones de Operaciones
  const comisiones     = (operaciones ?? []).reduce((s, o) => s + (Number(o.comision_bruta) || 0), 0)
  const comisionTotal  = realDelMes(factManual?.real_usd, comisiones)
  const objFactMensual = calcObjetivoMes(objFactAnual, month)
  const factRatio      = objFactMensual > 0 ? comisionTotal / objFactMensual : 0
  const factACobrar    = factRatio >= 1 ? 100 : 0

  const totalACobrar = cobrosACobrar + cartelesACobrar + encACobrar + factACobrar

  const kpis: KpiRow[] = [
    {
      label:    "Cobros",
      objetivo: "100% de cobranza (ponderado)",
      cumplido: `${cobrosPct}% (Fee ${feePagados}/${agentesFee} = ${feePct}%, CRM ${crmPagados}/${agentesCrm} = ${crmPct}%, MS ${mainPagados}/${agentesMainstreet} = ${mainPct}%)`,
      aCobrar:  cobrosACobrar,
    },
    {
      label:    "Cartelería",
      objetivo: objCartelesMes === 0
        ? "Sin objetivo definido"
        : `${objCartelesMes} carteles a recuperar`,
      cumplido: objCartelesMes === 0
        ? `${cartelesCount} recuperado${cartelesCount !== 1 ? "s" : ""} · no genera bono`
        : `${cartelesCount}/${objCartelesMes} recuperados (${pctCartMes}%)`,
      aCobrar:  cartelesACobrar,
    },
    {
      label:    "Encuestas",
      objetivo: totalEncuestasEsperadas === 0
        ? "Sin operaciones de venta o alquiler este mes"
        : `Tasa de respuesta ≥ ${objEncPct}%`,
      cumplido: totalEncuestasEsperadas === 0
        ? `${totalEncuestas} encuesta${totalEncuestas !== 1 ? "s" : ""} registrada${totalEncuestas !== 1 ? "s" : ""} · no genera bono`
        : `${tasaRespPct}% resp. (${totalEncuestas} enc. / ${totalEncuestasEsperadas} esp.)${avgNps !== null ? ` · NPS prom. ${avgNps.toFixed(1)}` : ""}`,
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
