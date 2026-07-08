// Diagnóstico de fórmulas KPI — consulta datos reales de Supabase
// Ejecutar: node scripts/audit-kpi-formulas.mjs

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://srjsrsbjixiexaxfwctv.supabase.co"
const SUPABASE_KEY = "sb_secret_rhxL1z4FSgcuzYh9JYqGDw_Jp-cEscO"
const AIRTABLE_TOKEN = "patWK7UkVUYRH41r3.a12e333e51454300f1c29e39a8b3aa0e11a7f07ed51286d2435012d33012054e"
const AIRTABLE_BASE  = "app2vymeCDGIhRAvz"
const AIRTABLE_TABLE = "tblZmN5YlUpWCJlj5"

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── helpers ──────────────────────────────────────────────────────────────────
function nextMonth(y, m) {
  return m === 12 ? `${y+1}-01-01` : `${y}-${String(m+1).padStart(2,"0")}-01`
}
function startOf(y, m) {
  return `${y}-${String(m).padStart(2,"0")}-01`
}
function getGroup(concepto) {
  const c = (concepto ?? "").toLowerCase()
  if (c.includes("fee"))                                                              return "FEE"
  if (c.includes("pro") || c.includes("crm") || c.includes("plan") || c.includes("licencia")) return "CRM"
  if (c.includes("mainstreet"))                                                       return "Mainstreet"
  return "Otros"
}
function pct(n, d) { return d === 0 ? 0 : (n / d) * 100 }
function fmt(n) { return n.toFixed(2) + "%" }

// ── fetch Airtable vencimientos ───────────────────────────────────────────────
async function fetchAirtableVencimientos() {
  const params = new URLSearchParams()
  params.append("fields[]", "fldnLaQjKRCD8vezt")   // vencimiento
  params.set("returnFieldsByFieldId", "true")
  params.set("pageSize", "100")
  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}?${params}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
    )
    if (!res.ok) return { ok: false, carteles: [], error: `Airtable ${res.status}` }
    const json = await res.json()
    const carteles = (json.records ?? []).map(r => ({
      vencimiento: r.fields["fldnLaQjKRCD8vezt"] ?? ""
    })).filter(c => c.vencimiento)
    return { ok: true, carteles }
  } catch (e) {
    return { ok: false, carteles: [], error: e.message }
  }
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════════")
  console.log("  AUDITORÍA DE FÓRMULAS KPI — datos reales Supabase")
  console.log("═══════════════════════════════════════════════════════════\n")

  // 1. Fetch base data (no date filter — need all for coverage analysis)
  const [
    { data: pagosAll },
    { data: agentes },
    { data: encuestasAll },
    { data: opAll },
    { data: cartelesDevAll },
    { data: configs },
  ] = await Promise.all([
    sb.from("pagos").select("agente_id, estado, concepto, fecha"),
    sb.from("agentes").select("id, paga_fee, licencia, activo").eq("activo", true),
    sb.from("encuestas_registros").select("nps, fecha").eq("eliminado", false),
    sb.from("operaciones").select("comision_bruta, fecha"),
    sb.from("carteles_devueltos").select("fecha_devolucion"),
    sb.from("config").select("clave, valor").in("clave", [
      "obj_facturacion_anual","obj_encuestas_nps","obj_carteles","obj_encuestas_pct"
    ]),
  ])

  // 2. Airtable fetch
  const { ok: atOk, carteles: atCarteles, error: atErr } = await fetchAirtableVencimientos()

  // Config
  const cfgMap = Object.fromEntries((configs ?? []).map(c => [c.clave, c.valor]))
  const objNps = parseFloat(cfgMap.obj_encuestas_nps ?? "8.0") || 8.0

  // Active agents
  const activos    = (agentes ?? [])
  const agentesFee = Math.max(activos.filter(a => a.paga_fee === true).length, 1)
  const agentesCrm = Math.max(activos.filter(a => a.paga_fee && a.licencia && a.licencia !== "---").length, 1)
  const agentesTotal = Math.max(activos.length, 1)

  console.log(`Agentes activos: ${activos.length}  (Fee: ${agentesFee}, CRM: ${agentesCrm}, Total MS: ${agentesTotal})`)
  console.log(`Config — objNps: ${objNps}  |  Airtable: ${atOk ? `${atCarteles.length} carteles activos` : `ERROR: ${atErr}` }\n`)

  // 3. Find months with any data
  const allDates = [
    ...(pagosAll ?? []).map(r => r.fecha?.substring(0,7)),
    ...(encuestasAll ?? []).map(r => r.fecha?.substring(0,7)),
    ...(opAll ?? []).map(r => r.fecha?.substring(0,7)),
    ...(cartelesDevAll ?? []).map(r => r.fecha_devolucion?.substring(0,7)),
  ].filter(Boolean)

  const monthsWithData = [...new Set(allDates)].sort().reverse()

  console.log(`Meses con algún dato: ${monthsWithData.slice(0,12).join(", ")}`)
  console.log()

  // 4. Per-month breakdown
  for (const mk of monthsWithData.slice(0, 8)) {
    const [y, m] = mk.split("-").map(Number)
    const start  = startOf(y, m)
    const end    = nextMonth(y, m)

    // Pagos del mes
    const pagos = (pagosAll ?? []).filter(p => p.fecha >= start && p.fecha < end)
    const feePag  = new Set(pagos.filter(p => getGroup(p.concepto) === "FEE"        && p.estado === "Pagado").map(p => p.agente_id)).size
    const crmPag  = new Set(pagos.filter(p => getGroup(p.concepto) === "CRM"        && p.estado === "Pagado").map(p => p.agente_id)).size
    const mainPag = new Set(pagos.filter(p => getGroup(p.concepto) === "Mainstreet" && p.estado === "Pagado").map(p => p.agente_id)).size

    // Cobros — fórmula actual (promedio simple)
    const feePct_i   = pct(feePag,  agentesFee)
    const crmPct_i   = pct(crmPag,  agentesCrm)
    const mainPct_i  = pct(mainPag, agentesTotal)
    const cobrosPctActual    = (feePct_i + crmPct_i + mainPct_i) / 3
    // Cobros — fórmula nueva (ponderada)
    const cobrosNumerador    = feePag + crmPag + mainPag
    const cobrosDenominador  = agentesFee + agentesCrm + agentesTotal
    const cobrosPctPonderado = pct(cobrosNumerador, cobrosDenominador)

    // Encuestas del mes
    const encs    = (encuestasAll ?? []).filter(e => e.fecha >= start && e.fecha < end)
    const npsVals = encs.filter(e => e.nps !== null).map(e => e.nps)
    const avgNps  = npsVals.length > 0 ? npsVals.reduce((a,b) => a+b, 0) / npsVals.length : null

    // Operaciones del mes
    const ops      = (opAll ?? []).filter(o => o.fecha >= start && o.fecha < end)
    const totalOps = ops.length

    // Tasa de respuesta
    const totalEnc  = encs.length
    const tasaResp  = totalOps > 0 ? pct(totalEnc, totalOps * 2) : 0

    // Cartelería del mes
    const cartDev   = (cartelesDevAll ?? []).filter(c =>
      c.fecha_devolucion >= start && c.fecha_devolucion < end
    ).length

    // Airtable: carteles con vencimiento DENTRO del mes seleccionado (aún activos)
    const atEnMes   = atOk ? atCarteles.filter(c =>
      c.vencimiento >= start && c.vencimiento < end
    ).length : null

    // Pendientes dinámicos = vencimientos en mes (aún activos) + recuperados ese mes
    const pendDinamico = atEnMes !== null ? atEnMes + cartDev : null
    const pctCartDin   = pendDinamico > 0 ? fmt(pct(cartDev, pendDinamico)) : "N/D (0 pendientes)"
    const pctCartConf  = parseInt(cfgMap.obj_carteles ?? "20") || 20
    const pctCartActual = fmt(cartDev >= pctCartConf ? 100 : pct(cartDev, pctCartConf) )

    // ── Print ──────────────────────────────────────────────
    console.log(`┌─ ${mk} ──────────────────────────────────────────────────────`)
    console.log(`│ COBROS`)
    console.log(`│   Fee:        ${feePag}/${agentesFee} = ${fmt(feePct_i)}`)
    console.log(`│   CRM:        ${crmPag}/${agentesCrm} = ${fmt(crmPct_i)}`)
    console.log(`│   Mainstreet: ${mainPag}/${agentesTotal} = ${fmt(mainPct_i)}`)
    console.log(`│   Promedio simple (HOY):     ${fmt(cobrosPctActual)}`)
    console.log(`│   Ponderado   (NUEVO):       ${fmt(cobrosPctPonderado)}  [${cobrosNumerador}/${cobrosDenominador}]`)
    console.log(`│   Diferencia: ${(cobrosPctPonderado - cobrosPctActual).toFixed(2)}pp`)
    console.log(`│`)
    console.log(`│ CARTELERÍA`)
    console.log(`│   Recuperados del mes:  ${cartDev}`)
    console.log(`│   Objetivo config:      ${pctCartConf}  →  actual-fórmula: ${cartDev}/${pctCartConf} = ${pctCartActual}`)
    if (atOk) {
      console.log(`│   Airtable venc en mes: ${atEnMes}  →  pendientes dinámico: ${atEnMes}+${cartDev}=${pendDinamico}`)
      console.log(`│   Fórmula dinámica:     ${cartDev}/${pendDinamico} = ${pctCartDin}`)
    } else {
      console.log(`│   Airtable: no disponible (${atErr})`)
    }
    console.log(`│`)
    console.log(`│ ENCUESTAS`)
    console.log(`│   Total encuestas:   ${totalEnc}`)
    console.log(`│   Operaciones:       ${totalOps}  →  esperadas: ${totalOps * 2}`)
    console.log(`│   Tasa respuesta:    ${fmt(tasaResp)}  (umbral ≥60% → ${tasaResp >= 60 ? "✓ USD 100" : "✗ USD 0"})`)
    console.log(`│   NPS promedio:      ${avgNps !== null ? avgNps.toFixed(2) + ` (${npsVals.length} con NPS / ${totalEnc} total)` : "—  (ninguna encuesta tiene NPS registrado)"}`)
    console.log(`│   Criterio actual:   NPS ${avgNps !== null ? avgNps.toFixed(2) : "—"} ≥ ${objNps}?  → ${avgNps !== null && avgNps >= objNps ? "✓ USD 100" : "✗ USD 0"}`)
    console.log(`└─────────────────────────────────────────────────────────────\n`)
  }

  // 5. Summary: which month has the most complete data
  console.log("═══ COBERTURA DE DATOS POR MES ═══════════════════════════════")
  console.log("Mes       Pagos  Ops  Encuestas  CartDev  AT-Venc-en-mes  Completo?")
  for (const mk of monthsWithData.slice(0, 8)) {
    const [y, m] = mk.split("-").map(Number)
    const start = startOf(y, m)
    const end   = nextMonth(y, m)
    const nPagos = (pagosAll ?? []).filter(p => p.fecha >= start && p.fecha < end).length
    const nOps   = (opAll ?? []).filter(o => o.fecha >= start && o.fecha < end).length
    const nEnc   = (encuestasAll ?? []).filter(e => e.fecha >= start && e.fecha < end).length
    const nCart  = (cartelesDevAll ?? []).filter(c => c.fecha_devolucion >= start && c.fecha_devolucion < end).length
    const nAt    = atOk ? atCarteles.filter(c => c.vencimiento >= start && c.vencimiento < end).length : "?"
    const full   = nPagos > 0 && nOps > 0 && nEnc > 0 ? "✓" : "—"
    console.log(`${mk}  ${String(nPagos).padStart(5)}  ${String(nOps).padStart(3)}  ${String(nEnc).padStart(9)}  ${String(nCart).padStart(7)}  ${String(nAt).padStart(14)}  ${full}`)
  }
}

main().catch(console.error)
