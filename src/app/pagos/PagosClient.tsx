"use client"

import { useState, useMemo, useTransition, useEffect, useCallback, Fragment } from "react"
import { useRouter } from "next/navigation"
import { crearPago, actualizarPago, crearGasto, crearGastoRecurrente, eliminarPago, registrarSaldoFavor, crearGastoConCredito, aplicarCreditoAPendientes } from "./actions"
import { DollarSign, Loader2, MessageCircle, TrendingDown, TrendingUp, Repeat, CheckCircle2, Save, Trash2 } from "lucide-react"
import StatusBadge from "@/components/StatusBadge"
import { hoyArgentina } from "@/lib/fecha"
import Topbar from "@/components/Topbar"
import { fmtUSD } from "@/lib/format"
import { Backdrop, ModalHeader } from "@/components/Modal"
import { getEfectivoPagaFee } from "@/lib/fee"

// ── Constants ────────────────────────────────────────
const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]

const MONTHS_OPTIONS: Array<{ label: string; value: string }> = (() => {
  const opts: Array<{ label: string; value: string }> = [
    { label: "Todos los meses", value: "todos" },
  ]
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    opts.push({
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    })
  }
  return opts
})()

const CONCEPTOS_PAGO = ["FEE mensual", "Licencias CRM", "Mainstreet", "Otros"]

const CONCEPTOS_RECURRENTE = ["FEE mensual", "Licencia CRM PRO", "Licencia CRM PRO+"]

const CONCEPTO_CONFIG_KEY: Record<string, string> = {
  "FEE mensual":       "fee_mensual",
  "Licencia CRM PRO":  "bono_pro",
  "Licencia CRM PRO+": "bono_pro_plus",
}


// ── Types ────────────────────────────────────────────
export interface PagoRow {
  id: string
  agente_id: string
  fecha: string
  concepto: string
  monto_debe: number
  monto_pagado: number
  estado: string
  agentes: { nombre: string } | null
}

export interface AgenteInfo {
  id: string
  nombre: string
  telefono: string | null
  activo: boolean
  paga_fee: boolean | null
  fecha_alta: string
  fecha_mainstreet: string | null
  tipo_plan: string | null
}

interface NuevoForm {
  agente_id: string
  concepto: string
  monto_pagado: string
  fecha: string
}

interface GastoForm {
  agente_id: string
  concepto: string
  monto_debe: string
  fecha: string
  tipo: "Ordinario" | "Extraordinario"
}

interface GastoRecForm {
  concepto: string
  fecha: string
}

interface EditForm {
  monto_pagado: string
}

interface SaldoFavorForm {
  agente_id: string
  monto: string
  fecha: string
}

type CreditoOpcion = "todo" | "parcial" | "no"

// ── Helpers ──────────────────────────────────────────
function calcEstado(debe: number, pagado: number): string {
  if (pagado <= 0)    return "Pendiente"
  if (pagado >= debe) return "Pagado"
  return "Parcial"
}

function calcEstadoGeneral(totalDebe: number, totalPagado: number): string {
  const epsilon = 0.01
  if (totalDebe <= epsilon)               return "Pagado"
  if (totalPagado <= 0)                   return "Pendiente"
  if (totalPagado >= totalDebe - epsilon) return "Pagado"
  return "Parcial"
}

function getConceptGroup(concepto: string): "FEE" | "CRM" | "Mainstreet" | "BolsasVino" | "Otros" {
  const c = concepto.toLowerCase()
  if (c.includes("fee"))                                                          return "FEE"
  if (c.includes("pro") || c.includes("crm") || c.includes("plan") || c.includes("licencia")) return "CRM"
  if (c.includes("mainstreet"))                                                   return "Mainstreet"
  if (c.includes("bolsa") && c.includes("vino"))                                  return "BolsasVino"
  return "Otros"
}

function fmtFecha(fechaStr: string) {
  if (!fechaStr) return "—"
  const [a, m, d] = fechaStr.split("-")
  return `${parseInt(d)} ${MONTH_NAMES[parseInt(m) - 1].slice(0, 3)} ${a}`
}

function mesLabel(monthVal: string): string {
  if (monthVal === "todos") return "el período"
  const [y, m] = monthVal.split("-")
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`
}

// ── Sub-components ───────────────────────────────────
function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "#059669" : pct >= 50 ? "#D97706" : "var(--crm-accent)"
  return (
    <div style={{ width: "100%", height: "5px", borderRadius: "3px", background: "rgba(255,255,255,0.06)", overflow: "hidden", marginTop: "6px" }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: color, borderRadius: "3px", transition: "width 0.4s" }} />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={{
        display: "block", fontSize: "11px", fontWeight: 700,
        letterSpacing: "0.8px", textTransform: "uppercase" as const,
        color: "rgba(255,255,255,0.45)", marginBottom: "5px",
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <Field label={label}>
      <div style={{
        padding: "9px 12px", borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
        fontSize: "13px", color: "rgba(255,255,255,0.45)",
      }}>
        {value}
      </div>
    </Field>
  )
}


function filterBtnStyle(key: string, selected: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "5px 14px", borderRadius: "7px",
    fontSize: "12px", fontWeight: 500,
    cursor: "pointer", fontFamily: "inherit",
    transition: "all 0.15s",
  }
  if (!selected) return { ...base, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)" }
  const active: Record<string, React.CSSProperties> = {
    todos:     { border: "1px solid rgba(255,255,255,0.3)",   background: "rgba(255,255,255,0.12)", color: "var(--crm-text)" },
    Pagado:    { border: "1px solid rgba(74,222,128,0.4)",    background: "rgba(74,222,128,0.12)",  color: "#4ade80" },
    Parcial:   { border: "1px solid rgba(251,191,36,0.4)",    background: "rgba(251,191,36,0.12)",  color: "#fbbf24" },
    Pendiente: { border: "1px solid rgba(248,113,113,0.4)",   background: "rgba(248,113,113,0.12)", color: "#f87171" },
  }
  return { ...base, fontWeight: 700, ...(active[key] ?? active.todos) }
}

// ── KPI box component ────────────────────────────────
function KpiConcepto({
  label, x, y, pct, color, gradient: _g, onClick,
}: {
  label: string; x: number; y?: number; pct?: number; color: string; gradient: string; onClick?: () => void
}) {
  const colorMap: Record<string, { bg: string; text: string; bar: string }> = {
    "#E31837": { bg: "rgba(248,113,113,0.08)", text: "#f87171",  bar: "#f87171" },
    "#7C3AED": { bg: "rgba(167,139,250,0.08)", text: "#a78bfa",  bar: "#a78bfa" },
    "#0D9488": { bg: "rgba(45,212,191,0.08)",  text: "#2dd4bf",  bar: "#2dd4bf" },
    "#D97706": { bg: "rgba(251,191,36,0.08)",  text: "#fbbf24",  bar: "#fbbf24" },
    "#BE185D": { bg: "rgba(244,114,182,0.08)", text: "#f472b6",  bar: "#f472b6" },
  }
  const { bg, text, bar } = colorMap[color] ?? { bg: "rgba(255,255,255,0.06)", text: "rgba(255,255,255,0.6)", bar: "rgba(255,255,255,0.3)" }
  return (
    <div onClick={onClick} style={{ background: bg, borderRadius: "16px", border: "1px solid rgba(255,255,255,0.08)", padding: "20px", display: "flex", flexDirection: "column", gap: "10px", minHeight: "110px", cursor: onClick ? "pointer" : "default" }}>
      <p style={{ fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: text, margin: 0 }}>{label}</p>
      <div>
        <p style={{ fontSize: "30px", fontWeight: 700, color: text, lineHeight: 1, letterSpacing: "-0.025em", margin: 0 }}>
          {y !== undefined ? `${x}/${y}` : String(x)}
        </p>
        <p style={{ fontSize: "11px", fontWeight: 500, color: text, opacity: 0.7, marginTop: "2px", margin: 0 }}>cobrados</p>
      </div>
      {pct !== undefined && (
        <div>
          <div style={{ height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.08)", overflow: "hidden", marginTop: "4px" }}>
            <div style={{ height: "100%", borderRadius: "3px", background: bar, width: `${Math.min(100, pct)}%` }} />
          </div>
          <p style={{ fontSize: "11px", fontWeight: 700, marginTop: "4px", margin: 0, color: text }}>{pct}% cobranza</p>
        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
interface Props {
  pagos: PagoRow[]
  agentes: AgenteInfo[]
  configBonos: Record<string, number>
  mensajeWhatsappTemplate: string
}

export default function PagosClient({ pagos, agentes, configBonos, mensajeWhatsappTemplate }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const agentesActivos = agentes.filter(a => a.activo)

  // ── Filters ────────────────────────────────────────
  const [selectedEstado, setSelectedEstado] = useState("todos")
  const [selectedMonth, setSelectedMonth]   = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })
  const [detalleConcepto, setDetalleConcepto] = useState<"FEE" | "CRM" | "Mainstreet" | "BolsasVino" | "Otros" | null>(null)

  // ── Expanded row ───────────────────────────────────
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)

  // ── Modal ──────────────────────────────────────────
  type ModalT = "none" | "nuevo" | "editar" | "gasto" | "gasto_rec" | "saldo_favor"
  const [modal,        setModal]        = useState<ModalT>("none")
  const [selectedPago, setSelectedPago] = useState<PagoRow | null>(null)
  const [error,        setError]        = useState("")

  const todayStr = hoyArgentina()

  const [nuevoForm, setNuevoForm] = useState<NuevoForm>({
    agente_id:    agentesActivos[0]?.id ?? "",
    concepto:     CONCEPTOS_PAGO[0],
    monto_pagado: "",
    fecha:        todayStr,
  })

  const [gastoForm, setGastoForm] = useState<GastoForm>({
    agente_id: agentesActivos[0]?.id ?? "",
    concepto:  "",
    monto_debe: "",
    fecha:     todayStr,
    tipo:      "Ordinario",
  })

  const [gastoRec, setGastoRec] = useState<GastoRecForm>({
    concepto: CONCEPTOS_RECURRENTE[0],
    fecha:    todayStr,
  })
  const [selectedAgentesRec, setSelectedAgentesRec] = useState<Set<string>>(new Set())

  // ── Eliminar registro ──────────────────────────────
  const [deleteTarget,  setDeleteTarget]  = useState<PagoRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError,   setDeleteError]   = useState("")

  const [editForm, setEditForm] = useState<EditForm>({ monto_pagado: "0" })

  const [saldoFavorForm, setSaldoFavorForm] = useState<SaldoFavorForm>({
    agente_id: agentesActivos[0]?.id ?? "",
    monto: "",
    fecha: todayStr,
  })

  const [creditoOpcion,       setCreditoOpcion]       = useState<CreditoOpcion>("no")
  const [creditoParcialMonto, setCreditoParcialMonto] = useState("")

  const [saveSuccessNuevo, setSaveSuccessNuevo] = useState(false)
  const [saveSuccessGasto, setSaveSuccessGasto] = useState(false)

  // ── Aplicar saldo a favor a pendientes ─────────────
  const [aplicarCreditoAgente, setAplicarCreditoAgente] = useState<string | null>(null)
  const [aplicarModo, setAplicarModo] = useState<"todo" | "parcial">("todo")
  const [aplicarSeleccion, setAplicarSeleccion] = useState<Record<string, number>>({}) // pago_id -> monto
  const [aplicarLoading, setAplicarLoading] = useState(false)
  const [aplicarError, setAplicarError] = useState("")

  // ── Computed: KPI stats ────────────────────────────
  const kpiStats = useMemo(() => {
    const monthPagos = pagos.filter(p =>
      selectedMonth === "todos" || p.fecha.startsWith(selectedMonth)
    )

    const agentesActivosCount = agentesActivos.length
    const agentesFeeCount     = agentes.filter(a => getEfectivoPagaFee(a.fecha_alta, a.paga_fee)).length
    const agentesCrmCount     = agentes.filter(a =>
      a.activo && (a.tipo_plan === "PRO" || a.tipo_plan === "PRO+")
    ).length

    // FEE
    const feePagos  = monthPagos.filter(p => getConceptGroup(p.concepto) === "FEE")
    const feeCobrX  = new Set(feePagos.filter(p => p.estado === "Pagado").map(p => p.agente_id)).size
    const feePct    = agentesFeeCount > 0 ? Math.round((feeCobrX / agentesFeeCount) * 100) : 0

    // CRM — denominator: only agents with active license
    const crmPagos  = monthPagos.filter(p => getConceptGroup(p.concepto) === "CRM")
    const crmCobrX  = new Set(crmPagos.filter(p => p.estado === "Pagado").map(p => p.agente_id)).size
    const crmTotal  = agentesCrmCount > 0 ? agentesCrmCount : agentesActivosCount
    const crmPct    = crmTotal > 0 ? Math.round((crmCobrX / crmTotal) * 100) : 0

    // Mainstreet — denominador: agentes activos cuyo aniversario (mes de fecha_mainstreet) cae en el mes del filtro
    const refDate  = selectedMonth === "todos"
      ? new Date()
      : new Date(parseInt(selectedMonth.split("-")[0]), parseInt(selectedMonth.split("-")[1]) - 1, 1)
    const refMonth = refDate.getMonth() + 1

    const mainTotal = agentesActivos.filter(a => {
      if (!a.fecha_mainstreet) return false
      const m = parseInt(a.fecha_mainstreet.split("-")[1], 10)
      return m === refMonth
    }).length

    const mainPagos = monthPagos.filter(p => getConceptGroup(p.concepto) === "Mainstreet")
    const mainCobrX = new Set(mainPagos.filter(p => p.estado === "Pagado").map(p => p.agente_id)).size
    const mainPct   = mainTotal > 0 ? Math.round((mainCobrX / mainTotal) * 100) : 0

    // Bolsas de vinos
    const bolsasPagos  = monthPagos.filter(p => getConceptGroup(p.concepto) === "BolsasVino")
    const bolsasTotal  = bolsasPagos.length
    const bolsasCobrX  = bolsasPagos.filter(p => p.estado === "Pagado").length
    const bolsasPct    = bolsasTotal > 0 ? Math.round((bolsasCobrX / bolsasTotal) * 100) : 0

    // "Otros" ahora EXCLUYE BolsasVino (antes lo incluía sin querer, ya que getConceptGroup lo separaba mal)
    const otrosPagos  = monthPagos.filter(p => getConceptGroup(p.concepto) === "Otros")
    const otrosCobrX  = otrosPagos.filter(p => p.estado === "Pagado").length
    const otrosTotal  = otrosPagos.length

    const pctGeneral = Math.round((feePct + crmPct + mainPct) / 3)

    return {
      feeCobrX, feeTotal: agentesFeeCount, feePct,
      crmCobrX, crmTotal, crmPct,
      mainCobrX, mainTotal, mainPct,
      bolsasCobrX, bolsasTotal, bolsasPct,
      otrosCobrX, otrosTotal, pctGeneral,
    }
  }, [pagos, agentes, selectedMonth])

  // ── Detalle de agentes por concepto (para modal) ───
  const detalleConceptoData = useMemo(() => {
    if (!detalleConcepto) return []

    const monthPagos = pagos.filter(p =>
      selectedMonth === "todos" || p.fecha.startsWith(selectedMonth)
    )

    if (detalleConcepto === "Otros" || detalleConcepto === "BolsasVino") {
      const pagosDelGrupo = monthPagos.filter(p => getConceptGroup(p.concepto) === detalleConcepto)
      return pagosDelGrupo.map(p => {
        const ag = agentes.find(a => a.id === p.agente_id)
        const montoReal = p.estado === "Pagado" ? Number(p.monto_pagado) : Number(p.monto_debe)
        return { nombre: ag?.nombre ?? "—", estado: p.estado, monto: montoReal as number | null, concepto: p.concepto }
      }).sort((a, b) => a.nombre.localeCompare(b.nombre))
    }

    // Para FEE, CRM, Mainstreet: universo = todos los agentes elegibles, con o sin pago
    let elegibles: typeof agentes = []
    if (detalleConcepto === "FEE") {
      elegibles = agentes.filter(a => getEfectivoPagaFee(a.fecha_alta, a.paga_fee))
    } else if (detalleConcepto === "CRM") {
      elegibles = agentes.filter(a => a.activo && (a.tipo_plan === "PRO" || a.tipo_plan === "PRO+"))
    } else if (detalleConcepto === "Mainstreet") {
      const refDate = selectedMonth === "todos"
        ? new Date()
        : new Date(parseInt(selectedMonth.split("-")[0]), parseInt(selectedMonth.split("-")[1]) - 1, 1)
      const refMonth = refDate.getMonth() + 1
      elegibles = agentesActivos.filter(a => {
        if (!a.fecha_mainstreet) return false
        const m = parseInt(a.fecha_mainstreet.split("-")[1], 10)
        return m === refMonth
      })
    }

    const pagosDelConcepto = monthPagos.filter(p => getConceptGroup(p.concepto) === detalleConcepto)

    return elegibles.map(a => {
      const pago = pagosDelConcepto.find(p => p.agente_id === a.id)
      return {
        nombre: a.nombre,
        estado: pago?.estado ?? "Pendiente",
        monto: (pago?.monto_debe ?? null) as number | null,
        concepto: pago?.concepto ?? "—",
      }
    }).sort((a, b) => {
      // Pendientes primero
      if (a.estado === "Pagado" && b.estado !== "Pagado") return 1
      if (a.estado !== "Pagado" && b.estado === "Pagado") return -1
      return a.nombre.localeCompare(b.nombre)
    })
  }, [detalleConcepto, pagos, agentes, agentesActivos, selectedMonth])

  // ── En mora: agentes con deuda pendiente > 15 días ─
  const enMoraAgentes = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 15)
    const cutoffStr = cutoff.toISOString().split("T")[0]
    const set = new Set<string>()
    for (const p of pagos) {
      if ((p.estado === "Pendiente" || p.estado === "Parcial") && p.fecha < cutoffStr) {
        set.add(p.agente_id)
      }
    }
    return set
  }, [pagos])

  // ── Computed: agentes view ─────────────────────────
  const agentesPagos = useMemo(() => {
    const monthPagos = pagos.filter(p =>
      selectedMonth === "todos" || p.fecha.startsWith(selectedMonth)
    )

    const grouped = new Map<string, PagoRow[]>()
    for (const p of monthPagos) {
      const arr = grouped.get(p.agente_id) ?? []
      arr.push(p)
      grouped.set(p.agente_id, arr)
    }

    const rows = agentes.map(info => {
      const agentePagos = grouped.get(info.id) ?? []
      if (agentePagos.length === 0) {
        return {
          agente_id: info.id,
          nombre: info.nombre,
          telefono: info.telefono ?? null,
          activo: info.activo,
          saldo: 0,
          totalDebe: 0,
          totalPagado: 0,
          estadoGral: "Sin movimientos",
          ultimoMov: "",
          pagos: [] as PagoRow[],
        }
      }
      const totalDebe   = agentePagos.reduce((s, p) => s + Number(p.monto_debe),   0)
      const totalPagado = agentePagos.reduce((s, p) => s + Number(p.monto_pagado), 0)
      const saldo       = totalDebe - totalPagado
      const estadoGral  = calcEstadoGeneral(totalDebe, totalPagado)
      const ultimoMov   = agentePagos.reduce((mx, p) => p.fecha > mx ? p.fecha : mx, "")
      return {
        agente_id: info.id,
        nombre: info.nombre,
        telefono: info.telefono ?? null,
        activo: info.activo,
        saldo,
        totalDebe,
        totalPagado,
        estadoGral,
        ultimoMov,
        pagos: agentePagos,
      }
    })

    return rows
      .filter(r => selectedEstado === "todos" || r.estadoGral === selectedEstado)
      .sort((a, b) => {
        if (a.activo !== b.activo) return a.activo ? -1 : 1
        return b.saldo - a.saldo
      })
  }, [pagos, agentes, selectedMonth, selectedEstado])

  // ── Saldo a favor por agente (todos los pagos) ────
  const saldoPorAgente = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of pagos) {
      const cur = map.get(p.agente_id) ?? 0
      map.set(p.agente_id, cur + Number(p.monto_pagado) - Number(p.monto_debe))
    }
    return map
  }, [pagos])

  const saldoGastoAgente = useMemo(() =>
    Math.max(0, saldoPorAgente.get(gastoForm.agente_id) ?? 0),
    [saldoPorAgente, gastoForm.agente_id]
  )

  // ── Real-time form estado ──────────────────────────
  const nuevoEstado = useMemo(() => {
    const pagado = parseFloat(nuevoForm.monto_pagado) || 0
    return pagado > 0 ? "Pagado" : "Pendiente"
  }, [nuevoForm.monto_pagado])

  const editEstado = useMemo(() => {
    if (!selectedPago) return "Pendiente"
    return calcEstado(Number(selectedPago.monto_debe), parseFloat(editForm.monto_pagado) || 0)
  }, [selectedPago, editForm.monto_pagado])

  // ── Auto-fill monto for gasto recurrente ──────────
  const gastoRecMonto = useMemo(() => {
    const key = CONCEPTO_CONFIG_KEY[gastoRec.concepto]
    return key ? (configBonos[key] ?? 0) : 0
  }, [gastoRec.concepto, configBonos])

  // ── Keyboard ───────────────────────────────────────
  const closeModal = useCallback(() => { setModal("none"); setError("") }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal() }
    if (modal !== "none") document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [modal, closeModal])

  // ── Open modals ────────────────────────────────────
  function openNuevo(preAgente?: string) {
    setNuevoForm({
      agente_id:    preAgente ?? agentesActivos[0]?.id ?? "",
      concepto:     CONCEPTOS_PAGO[0],
      monto_pagado: "",
      fecha:        todayStr,
    })
    setError("")
    setModal("nuevo")
  }

  function openGasto(preAgente?: string) {
    setGastoForm({
      agente_id: preAgente ?? agentesActivos[0]?.id ?? "",
      concepto:  "",
      monto_debe: "",
      fecha:     todayStr,
      tipo:      "Ordinario",
    })
    setCreditoOpcion("no")
    setCreditoParcialMonto("")
    setError("")
    setModal("gasto")
  }

  function openSaldoFavor() {
    setSaldoFavorForm({
      agente_id: agentesActivos[0]?.id ?? "",
      monto:     "",
      fecha:     todayStr,
    })
    setError("")
    setModal("saldo_favor")
  }

  function openGastoRec() {
    setGastoRec({ concepto: CONCEPTOS_RECURRENTE[0], fecha: todayStr })
    setSelectedAgentesRec(new Set())
    setError("")
    setModal("gasto_rec")
  }

  function openEditar(p: PagoRow) {
    setSelectedPago(p)
    setEditForm({ monto_pagado: String(Number(p.monto_pagado)) })
    setError("")
    setModal("editar")
  }

  // ── WhatsApp — mensaje detallado ───────────────────
  function openWhatsApp(nombre: string, telefono: string | null, agentePagos: PagoRow[], saldo: number) {
    if (!telefono) return

    const mes = mesLabel(selectedMonth)

    const detalle = agentePagos
      .filter(p => p.concepto !== "Saldo a favor")
      .map(p => {
        const debe   = Number(p.monto_debe)
        const pagado = Number(p.monto_pagado)
        const resta  = debe - pagado
        if (p.estado === "Pagado" || resta <= 0) {
          return `- ${p.concepto} — ${fmtUSD(debe > 0 ? debe : pagado)} ✔`
        }
        if (pagado > 0) {
          return `- ${p.concepto} — pagaste ${fmtUSD(pagado)} de ${fmtUSD(debe)}. Te quedan ${fmtUSD(resta)}.`
        }
        return `- ${p.concepto} — pendiente ${fmtUSD(debe)}.`
      })
      .join("\n")

    const agenteId   = agentePagos[0]?.agente_id ?? ""
    const saldoFavor = saldoPorAgente.get(agenteId) ?? 0

    const cierre = saldo > 0
      ? `Cuando puedas, avisanos para coordinar. Gracias!`
      : saldoFavor > 0
        ? `Tenés ${fmtUSD(saldoFavor)} a favor para el próximo mes. Gracias!`
        : `Todo al día. Gracias!`

    const totalDebe = agentePagos.reduce((s, p) => s + Number(p.monto_debe), 0)

    const msg = mensajeWhatsappTemplate
      .replace(/\[nombre\]/g, nombre)
      .replace(/\[monto\]/g, fmtUSD(saldo > 0 ? saldo : totalDebe))
      .replace(/\[mes\]/g, mes)
      .replace(/\[detalle\]/g, detalle)
      .replace(/\[cierre\]/g, cierre)

    const num = telefono.replace(/\D/g, "")
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank")
  }

  // ── Submit handlers ────────────────────────────────
  function handleNuevo(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const pagado = parseFloat(nuevoForm.monto_pagado) || 0
    if (pagado <= 0) { setError("El monto debe ser mayor a 0"); return }

    startTransition(async () => {
      const result = await crearPago({
        agente_id:    nuevoForm.agente_id,
        fecha:        nuevoForm.fecha,
        concepto:     nuevoForm.concepto,
        monto_debe:   pagado,
        monto_pagado: pagado,
      })
      if (result.error) setError(result.error)
      else { setSaveSuccessNuevo(true); setTimeout(() => { setSaveSuccessNuevo(false); closeModal(); router.refresh() }, 1000) }
    })
  }

  function handleGasto(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const debe = parseFloat(gastoForm.monto_debe) || 0
    if (debe <= 0) { setError("El monto debe ser mayor a 0"); return }
    if (!gastoForm.concepto.trim()) { setError("Ingresá un concepto"); return }

    const conceptoFinal = `${gastoForm.tipo === "Extraordinario" ? "[Ext] " : ""}${gastoForm.concepto}`

    let creditoAplicar = 0
    if (creditoOpcion === "todo" && saldoGastoAgente > 0) {
      creditoAplicar = Math.min(saldoGastoAgente, debe)
    } else if (creditoOpcion === "parcial" && saldoGastoAgente > 0) {
      creditoAplicar = Math.min(parseFloat(creditoParcialMonto) || 0, saldoGastoAgente, debe)
    }
    if (creditoAplicar < 0) creditoAplicar = 0

    startTransition(async () => {
      let result
      if (creditoAplicar > 0) {
        result = await crearGastoConCredito({
          agente_id:        gastoForm.agente_id,
          fecha:            gastoForm.fecha,
          concepto:         conceptoFinal,
          monto_debe:       debe,
          credito_aplicado: creditoAplicar,
        })
      } else {
        result = await crearGasto({
          agente_id:  gastoForm.agente_id,
          fecha:      gastoForm.fecha,
          concepto:   conceptoFinal,
          monto_debe: debe,
        })
      }
      if (result.error) setError(result.error)
      else { setSaveSuccessGasto(true); setTimeout(() => { setSaveSuccessGasto(false); closeModal(); router.refresh() }, 1000) }
    })
  }

  function handleSaldoFavor(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const monto = parseFloat(saldoFavorForm.monto) || 0
    if (monto <= 0) { setError("El monto debe ser mayor a 0"); return }

    startTransition(async () => {
      const result = await registrarSaldoFavor({
        agente_id: saldoFavorForm.agente_id,
        fecha:     saldoFavorForm.fecha,
        monto,
      })
      if (result.error) setError(result.error)
      else { closeModal(); router.refresh() }
    })
  }

  function handleGastoRec(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (selectedAgentesRec.size === 0) { setError("Seleccioná al menos un agente"); return }
    if (gastoRecMonto <= 0) { setError("El monto del concepto no está configurado"); return }

    startTransition(async () => {
      const result = await crearGastoRecurrente({
        agente_ids: Array.from(selectedAgentesRec),
        fecha:      gastoRec.fecha,
        concepto:   gastoRec.concepto,
        monto_debe: gastoRecMonto,
      })
      if (result.error) setError(result.error)
      else { closeModal(); router.refresh() }
    })
  }

  function handleEditar(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!selectedPago) return
    const pagado = parseFloat(editForm.monto_pagado) || 0

    startTransition(async () => {
      const result = await actualizarPago(selectedPago.id, {
        monto_pagado: pagado,
        estado:       editEstado,
      })
      if (result.error) setError(result.error)
      else { closeModal(); router.refresh() }
    })
  }

  async function handleConfirmEliminar() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setDeleteError("")
    const result = await eliminarPago(deleteTarget.id)
    setDeleteLoading(false)
    if (result.error) {
      setDeleteError(result.error)
    } else {
      setDeleteTarget(null)
      router.refresh()
    }
  }

  function ErrorBox() {
    if (!error) return null
    return (
      <div style={{
        background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)",
        borderRadius: "8px", padding: "10px 12px",
        fontSize: "12.5px", color: "#f87171", marginBottom: "14px",
      }}>
        ⚠️ {error}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      <Topbar moduleName="Cuentas" />

      {/* ── Page Header ──────────────────────────── */}
      <div className="crm-page-header flex-shrink-0" style={{ justifyContent: "flex-end", position: "sticky", top: "62px", zIndex: 15 }}>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => openSaldoFavor()}
            style={{
              background: "rgba(74,222,128,0.1)", color: "#4ade80",
              border: "1px solid rgba(74,222,128,0.3)",
              padding: "8px 16px", borderRadius: "9px",
              fontSize: "13px", fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            <TrendingUp size={14} /> Saldo a favor
          </button>
          <button
            onClick={() => openGasto()}
            style={{
              background: "var(--crm-surface-2)", color: "var(--crm-text)",
              border: "1px solid rgba(255,255,255,0.08)",
              padding: "8px 16px", borderRadius: "9px",
              fontSize: "13px", fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            <TrendingDown size={14} color="var(--crm-accent)" /> Registrar gasto
          </button>
          <button
            onClick={() => openNuevo()}
            style={{
              background: "linear-gradient(135deg,#E31837 0%,var(--crm-accent-hover) 100%)",
              color: "white", border: "none",
              padding: "8px 18px", borderRadius: "9px",
              fontSize: "13px", fontWeight: 700, cursor: "pointer",
              boxShadow: "0 2px 10px rgba(227,24,55,0.35)",
              fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span> Registrar Pago
          </button>
        </div>
      </div>

      {/* ── Scrollable content ────────────────────── */}
      <div className="flex-1 overflow-auto p-5 md:p-6">

        {/* ── KPI boxes (4 conceptos) ───────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-5">
          <KpiConcepto
            label="FEE mensual"
            x={kpiStats.feeCobrX}
            y={kpiStats.feeTotal}
            pct={kpiStats.feePct}
            color="#E31837"
            gradient="linear-gradient(135deg,#E31837 0%,#9B0F26 100%)"
            onClick={() => setDetalleConcepto("FEE")}
          />
          <KpiConcepto
            label="Licencias CRM"
            x={kpiStats.crmCobrX}
            y={kpiStats.crmTotal}
            pct={kpiStats.crmPct}
            color="#7C3AED"
            gradient="linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)"
            onClick={() => setDetalleConcepto("CRM")}
          />
          <KpiConcepto
            label="Mainstreet"
            x={kpiStats.mainCobrX}
            y={kpiStats.mainTotal}
            pct={kpiStats.mainPct}
            color="#0D9488"
            gradient="linear-gradient(135deg,#0D9488 0%,#0F766E 100%)"
            onClick={() => setDetalleConcepto("Mainstreet")}
          />
          <KpiConcepto
            label="Bolsas de vinos"
            x={kpiStats.bolsasCobrX}
            y={kpiStats.bolsasTotal}
            pct={kpiStats.bolsasPct}
            color="#BE185D"
            gradient="linear-gradient(135deg,#BE185D 0%,#831843 100%)"
            onClick={() => setDetalleConcepto("BolsasVino")}
          />
          <KpiConcepto
            label="Otros"
            x={kpiStats.otrosCobrX}
            y={kpiStats.otrosTotal}
            color="#D97706"
            gradient="linear-gradient(135deg,#D97706 0%,#B45309 100%)"
            onClick={() => setDetalleConcepto("Otros")}
          />
        </div>

        {/* ── % general ──────────────────────────────── */}
        <div className="crm-card" style={{
          display: "flex", alignItems: "center", gap: "16px",
          padding: "12px 20px", marginBottom: "16px", overflow: "visible",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
            <DollarSign size={14} color="#E31837" />
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--crm-text)" }}>
              Cobranza general: <strong style={{
                color: kpiStats.pctGeneral >= 80 ? "#059669" : kpiStats.pctGeneral >= 50 ? "#D97706" : "var(--crm-accent)"
              }}>{kpiStats.pctGeneral}%</strong>
            </span>
            <div style={{ flex: 1, maxWidth: "200px" }}>
              <ProgressBar pct={kpiStats.pctGeneral} />
            </div>
          </div>
          <span style={{ fontSize: "11px", color: "#94A3B8" }}>
            Promedio FEE + CRM + Mainstreet
          </span>
        </div>

        {/* ── Filtros ──────────────────────────────── */}
        <div className="crm-card" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 18px", marginBottom: "16px", overflow: "visible",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#94A3B8", marginRight: "4px" }}>
              ESTADO
            </span>
            {(["todos", "Pagado", "Parcial", "Pendiente"] as const).map(e => (
              <button
                key={e}
                onClick={() => setSelectedEstado(e)}
                style={filterBtnStyle(e, selectedEstado === e)}
              >
                {e === "todos" ? "Todos" : e}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#94A3B8" }}>MES</span>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              style={{
                padding: "6px 10px", borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.08)", fontSize: "12.5px",
                fontWeight: 500, color: "var(--crm-text)", background: "rgba(255,255,255,0.06)",
                cursor: "pointer", fontFamily: "inherit", outline: "none",
              }}
            >
              {MONTHS_OPTIONS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <span style={{ fontSize: "12px", color: "#94A3B8", whiteSpace: "nowrap" }}>
              {agentesPagos.length} agente{agentesPagos.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* ── Tabla por agente ─────────────────────── */}
        <div className="crm-card">
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E31837" }} />
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--crm-text)" }}>
                Estado de cobros por agente
              </span>
            </div>
            {agentesPagos.length === 0 && (
              <span style={{ fontSize: "12px", color: "#94A3B8" }}>Sin resultados</span>
            )}
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-white/[0.06]">
            {agentesPagos.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>
                No hay registros para el filtro seleccionado.
              </div>
            ) : (
              agentesPagos.map((ag, i) => {
                const isExpanded = expandedAgent === ag.agente_id
                const enMora     = enMoraAgentes.has(ag.agente_id)
                const showSeparator = !ag.activo && (i === 0 || agentesPagos[i - 1].activo)
                return (
                  <Fragment key={ag.agente_id}>
                    {showSeparator && (
                      <div style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "8px 16px",
                        background: "rgba(255,255,255,0.02)",
                        borderTop: "1px solid rgba(255,255,255,0.08)",
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                      }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "rgba(255,255,255,0.3)" }}>
                          Cuentas inactivas
                        </span>
                        <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
                      </div>
                    )}
                    <div style={{ opacity: ag.activo ? 1 : 0.5 }}>
                    <div
                      onClick={() => setExpandedAgent(isExpanded ? null : ag.agente_id)}
                      className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-white/[0.03]"
                    >
                      <span style={{
                        fontSize: "11px", color: "rgba(255,255,255,0.45)",
                        transform: isExpanded ? "rotate(90deg)" : "none",
                        display: "inline-block", transition: "transform 0.15s",
                      }}>▶</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--crm-text)" }}>{ag.nombre}</span>
                          {enMora && (
                            <span style={{
                              background: "rgba(248,113,113,0.12)", color: "#f87171",
                              border: "1px solid rgba(248,113,113,0.3)",
                              padding: "1px 7px", borderRadius: "12px",
                              fontSize: "10px", fontWeight: 700,
                            }}>EN MORA</span>
                          )}
                        </div>
                        <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>{fmtFecha(ag.ultimoMov)}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span style={{ fontSize: "13px", fontWeight: 700, color: Math.round(ag.saldo * 100) / 100 > 0 ? "var(--crm-accent)" : "#4ade80" }}>
                          {Math.round(ag.saldo * 100) / 100 > 0 ? `- ${fmtUSD(Math.round(Math.abs(ag.saldo) * 100) / 100)}` : ag.saldo < 0 ? `+ ${fmtUSD(Math.round(Math.abs(ag.saldo) * 100) / 100)}` : fmtUSD(0)}
                        </span>
                        <StatusBadge estado={ag.estadoGral} />
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 16px" }}>
                        <div className="flex gap-3 mb-3 flex-wrap" style={{ fontSize: "12px" }}>
                          <span><span style={{ color: "rgba(255,255,255,0.45)" }}>Pagado: </span><strong style={{ color: "#059669" }}>{fmtUSD(ag.totalPagado)}</strong></span>
                          <span><span style={{ color: "rgba(255,255,255,0.45)" }}>Pendiente: </span><strong style={{ color: "var(--crm-accent)" }}>{fmtUSD(Math.max(0, ag.saldo))}</strong></span>
                        </div>
                        {ag.pagos.map((p, pi) => (
                          <div key={p.id} style={{
                            background: p.concepto === "Saldo a favor" ? "rgba(74,222,128,0.06)" : "rgba(255,255,255,0.03)",
                            borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)",
                            padding: "10px 12px", marginBottom: pi < ag.pagos.length - 1 ? "8px" : 0,
                          }}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                {p.concepto === "Saldo a favor" ? (
                                  <span style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", padding: "2px 9px", borderRadius: "12px", fontSize: "11px", fontWeight: 700 }}>Saldo a favor</span>
                                ) : (
                                  <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--crm-text)" }}>{p.concepto}</div>
                                )}
                                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>{fmtFecha(p.fecha)}</div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <StatusBadge estado={p.estado} />
                                {p.concepto === "Saldo a favor"
                                  ? <span style={{ fontSize: "12px", fontWeight: 700, color: "#059669" }}>+{fmtUSD(Number(p.monto_pagado))}</span>
                                  : <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--crm-accent)" }}>{fmtUSD(Number(p.monto_debe))}</span>
                                }
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                              {p.estado !== "Pagado" && (
                                <button
                                  onClick={() => openEditar(p)}
                                  className="flex-1 min-h-[38px]"
                                  style={{
                                    padding: "6px 12px", borderRadius: "7px",
                                    border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.06)",
                                    fontSize: "12px", fontWeight: 600, color: "var(--crm-text)",
                                    cursor: "pointer", fontFamily: "inherit",
                                  }}
                                >
                                  Registrar pago
                                </button>
                              )}
                              <button
                                onClick={() => { setDeleteTarget(p); setDeleteError("") }}
                                title="Eliminar registro"
                                style={{
                                  width: "38px", height: "38px", borderRadius: "7px",
                                  border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  cursor: "pointer", color: "#f87171", flexShrink: 0,
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-3 mt-3 flex-wrap">
                          {ag.telefono && (
                            <button
                              onClick={() => openWhatsApp(ag.nombre, ag.telefono, ag.pagos, ag.saldo)}
                              style={{
                                background: "#25D366", border: "none", borderRadius: "8px",
                                padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px",
                                cursor: "pointer", color: "white", fontSize: "12px", fontWeight: 600,
                                fontFamily: "inherit",
                              }}
                            >
                              <MessageCircle size={14} /> WhatsApp
                            </button>
                          )}
                          {ag.estadoGral !== "Pagado" && (
                            <button
                              onClick={() => openNuevo(ag.agente_id)}
                              style={{
                                padding: "8px 16px", borderRadius: "8px",
                                border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.06)",
                                fontSize: "12px", fontWeight: 600, color: "var(--crm-text)",
                                cursor: "pointer", fontFamily: "inherit",
                              }}
                            >
                              Registrar pago
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  </Fragment>
                )
              })
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {["Agente", "Último movimiento", "Saldo del mes", "Estado", "WhatsApp", ""].map(h => (
                    <th key={h} style={{
                      padding: "10px 16px", textAlign: "left",
                      fontSize: "10.5px", fontWeight: 700,
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.8px", color: "#94A3B8",
                      whiteSpace: "nowrap",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agentesPagos.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>
                      No hay registros para el filtro seleccionado.
                    </td>
                  </tr>
                ) : (
                  agentesPagos.map((ag, i) => {
                    const isExpanded = expandedAgent === ag.agente_id
                    const isLast     = i === agentesPagos.length - 1
                    const enMora     = enMoraAgentes.has(ag.agente_id)
                    const showSeparator = !ag.activo && (i === 0 || agentesPagos[i - 1].activo)
                    return (
                      <Fragment key={ag.agente_id}>
                        {showSeparator && (
                          <tr>
                            <td colSpan={6} style={{ padding: 0 }}>
                              <div style={{
                                display: "flex", alignItems: "center", gap: "10px",
                                padding: "8px 16px",
                                background: "rgba(255,255,255,0.02)",
                                borderTop: "1px solid rgba(255,255,255,0.08)",
                                borderBottom: "1px solid rgba(255,255,255,0.05)",
                              }}>
                                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "rgba(255,255,255,0.3)" }}>
                                  Cuentas inactivas
                                </span>
                                <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
                              </div>
                            </td>
                          </tr>
                        )}
                        {/* ── Main row ── */}
                        <tr
                          onClick={() => setExpandedAgent(isExpanded ? null : ag.agente_id)}
                          style={{
                            borderBottom: (isLast && !isExpanded) ? "none" : "1px solid rgba(255,255,255,0.06)",
                            cursor: "pointer",
                            background: isExpanded ? "rgba(255,255,255,0.05)" : "var(--crm-surface-2)",
                            transition: "background 0.1s",
                            opacity: ag.activo ? 1 : 0.5,
                          }}
                        >
                          <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: "13px", color: "var(--crm-text)", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{
                                fontSize: "11px", color: "rgba(255,255,255,0.45)", fontWeight: 400,
                                transform: isExpanded ? "rotate(90deg)" : "none",
                                display: "inline-block", transition: "transform 0.15s",
                              }}>▶</span>
                              {ag.nombre}
                              {enMora && (
                                <span style={{
                                  background: "rgba(248,113,113,0.12)", color: "#f87171",
                                  border: "1px solid rgba(248,113,113,0.3)",
                                  padding: "1px 7px", borderRadius: "12px",
                                  fontSize: "10px", fontWeight: 700, marginLeft: "4px",
                                }}>
                                  EN MORA
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: "12px", color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>
                            {fmtFecha(ag.ultimoMov)}
                          </td>
                          <td style={{
                            padding: "12px 16px", fontWeight: 700, fontSize: "13px", whiteSpace: "nowrap",
                            color: Math.round(ag.saldo * 100) / 100 > 0 ? "var(--crm-accent)" : "#4ade80",
                          }}>
                            {Math.round(ag.saldo * 100) / 100 > 0 ? `- ${fmtUSD(Math.round(Math.abs(ag.saldo) * 100) / 100)}` : ag.saldo < 0 ? `+ ${fmtUSD(Math.round(Math.abs(ag.saldo) * 100) / 100)}` : fmtUSD(0)}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <StatusBadge estado={ag.estadoGral} />
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            {ag.telefono ? (
                              <button
                                onClick={e => { e.stopPropagation(); openWhatsApp(ag.nombre, ag.telefono, ag.pagos, ag.saldo) }}
                                title="Enviar WhatsApp"
                                style={{
                                  background: "#25D366", border: "none", borderRadius: "8px",
                                  width: "32px", height: "32px", display: "flex",
                                  alignItems: "center", justifyContent: "center",
                                  cursor: "pointer", color: "white", flexShrink: 0,
                                }}
                              >
                                <MessageCircle size={15} />
                              </button>
                            ) : (
                              <span style={{ color: "#CBD5E1", fontSize: "12px" }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            {ag.estadoGral !== "Pagado" && (
                              <button
                                onClick={e => { e.stopPropagation(); openNuevo(ag.agente_id) }}
                                style={{
                                  padding: "5px 14px", borderRadius: "7px",
                                  border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.06)",
                                  fontSize: "12px", fontWeight: 600, color: "var(--crm-text)",
                                  cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                                }}
                              >
                                Registrar pago
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* ── Expanded detail ── */}
                        {isExpanded && (
                          <tr style={{ borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.06)" }}>
                            <td colSpan={6} style={{ padding: 0 }}>
                              <div style={{
                                background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.06)",
                                padding: "16px 24px",
                              }}>
                                {/* Summary strip */}
                                <div style={{
                                  display: "flex", gap: "20px", marginBottom: "12px",
                                  fontSize: "12.5px",
                                }}>
                                  <span>
                                    <span style={{ color: "rgba(255,255,255,0.45)" }}>Total pagado: </span>
                                    <strong style={{ color: "#059669" }}>{fmtUSD(ag.totalPagado)}</strong>
                                  </span>
                                  <span>
                                    <span style={{ color: "rgba(255,255,255,0.45)" }}>Total pendiente: </span>
                                    <strong style={{ color: "var(--crm-accent)" }}>{fmtUSD(Math.max(0, ag.saldo))}</strong>
                                  </span>
                                  <span>
                                    <span style={{ color: "rgba(255,255,255,0.45)" }}>Estado: </span>
                                    <StatusBadge estado={ag.estadoGral} />
                                  </span>
                                  {saldoPorAgente.get(ag.agente_id) && saldoPorAgente.get(ag.agente_id)! > 0 && (
                                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                      <span style={{ color: "rgba(255,255,255,0.45)" }}>Saldo a favor: </span>
                                      <strong style={{ color: "#4ade80" }}>{fmtUSD(saldoPorAgente.get(ag.agente_id)!)}</strong>
                                      <button
                                        onClick={e => {
                                          e.stopPropagation()
                                          setAplicarCreditoAgente(ag.agente_id)
                                          setAplicarModo("todo")
                                          setAplicarSeleccion({})
                                          setAplicarError("")
                                        }}
                                        style={{
                                          padding: "3px 12px", borderRadius: "7px",
                                          border: "1px solid rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.1)",
                                          color: "#4ade80", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                                        }}
                                      >
                                        Aplicar
                                      </button>
                                    </span>
                                  )}
                                </div>

                                {/* Movement detail */}
                                <table style={{ width: "100%", borderCollapse: "collapse", background: "rgba(255,255,255,0.02)", borderRadius: "10px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                                  <thead>
                                    <tr style={{ background: "rgba(255,255,255,0.06)" }}>
                                      {["Fecha", "Concepto", "Cargo", "Pagado", "Estado", ""].map(h => (
                                        <th key={h} style={{
                                          padding: "8px 14px", textAlign: "left",
                                          fontSize: "10px", fontWeight: 700,
                                          textTransform: "uppercase" as const,
                                          letterSpacing: "0.7px", color: "#94A3B8",
                                        }}>
                                          {h}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ag.pagos.map((p, pi) => {
                                      const isSaldoFavor = p.concepto === "Saldo a favor"
                                      const rowBg = isSaldoFavor
                                        ? "rgba(74,222,128,0.05)"
                                        : p.estado === "Pagado" ? "rgba(74,222,128,0.04)" : p.estado === "Parcial" ? "rgba(251,191,36,0.04)" : "rgba(248,113,113,0.04)"
                                      return (
                                        <tr key={p.id} style={{ borderTop: pi > 0 ? "1px solid rgba(255,255,255,0.06)" : "none", background: rowBg }}>
                                          <td style={{ padding: "10px 14px", fontSize: "12px", color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>
                                            {fmtFecha(p.fecha)}
                                          </td>
                                          <td style={{ padding: "10px 14px", fontSize: "12px", color: "var(--crm-text)" }}>
                                            {isSaldoFavor ? (
                                              <span style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", padding: "2px 9px", borderRadius: "12px", fontSize: "11px", fontWeight: 700 }}>
                                                Saldo a favor
                                              </span>
                                            ) : p.concepto}
                                          </td>
                                          <td style={{ padding: "10px 14px", fontSize: "12px", fontWeight: 600, color: "var(--crm-accent)", whiteSpace: "nowrap" }}>
                                            {isSaldoFavor ? "—" : fmtUSD(Number(p.monto_debe))}
                                          </td>
                                          <td style={{ padding: "10px 14px", fontSize: "12px", color: "#059669", fontWeight: 600, whiteSpace: "nowrap" }}>
                                            {isSaldoFavor
                                              ? <span style={{ color: "#059669" }}>+{fmtUSD(Number(p.monto_pagado))}</span>
                                              : Number(p.monto_pagado) > 0 ? fmtUSD(Number(p.monto_pagado)) : "—"}
                                          </td>
                                          <td style={{ padding: "10px 14px" }}>
                                            <StatusBadge estado={p.estado} />
                                          </td>
                                          <td style={{ padding: "10px 14px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                              {p.estado !== "Pagado" && (
                                                <button
                                                  onClick={() => openEditar(p)}
                                                  style={{
                                                    padding: "3px 10px", borderRadius: "6px",
                                                    border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.06)",
                                                    fontSize: "11px", fontWeight: 600, color: "var(--crm-text)",
                                                    cursor: "pointer", fontFamily: "inherit",
                                                  }}
                                                >
                                                  Registrar pago
                                                </button>
                                              )}
                                              <button
                                                onClick={() => { setDeleteTarget(p); setDeleteError("") }}
                                                title="Eliminar registro"
                                                style={{
                                                  width: "28px", height: "28px", borderRadius: "6px",
                                                  border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)",
                                                  display: "flex", alignItems: "center", justifyContent: "center",
                                                  cursor: "pointer", color: "#f87171", flexShrink: 0,
                                                }}
                                              >
                                                <Trash2 size={13} />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>

                                {/* Balance neto */}
                                <div style={{
                                  marginTop: "10px", textAlign: "right",
                                  fontSize: "14px", fontWeight: 700,
                                  color: ag.saldo > 0 ? "var(--crm-accent)" : "#059669",
                                }}>
                                  Saldo: {ag.saldo > 0
                                    ? `- ${fmtUSD(ag.saldo)}`
                                    : ag.saldo < 0
                                      ? `+ ${fmtUSD(-ag.saldo)}`
                                      : "✓ Al día"}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          MODAL — NUEVO PAGO
      ════════════════════════════════════════════ */}
      {modal === "nuevo" && (
        <Backdrop onClose={closeModal} className="">
          <div className="crm-modal" style={{ maxWidth: "500px" }}>
            <ModalHeader
              title="Registrar Pago"
              subtitle="Nuevo registro en el historial de pagos"
              onClose={closeModal}
              icon={<DollarSign size={20} className="text-emerald-600" />}
              iconBg="bg-emerald-50"
            />
            <form onSubmit={handleNuevo} style={{ padding: "20px" }}>
              <Field label="Agente *">
                <select
                  value={nuevoForm.agente_id}
                  onChange={e => setNuevoForm(f => ({ ...f, agente_id: e.target.value }))}
                  className="crm-input"
                  required
                >
                  {agentesActivos.map(a => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Concepto *">
                  <select
                    value={nuevoForm.concepto}
                    onChange={e => setNuevoForm(f => ({ ...f, concepto: e.target.value }))}
                    className="crm-input"
                    required
                  >
                    {CONCEPTOS_PAGO.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Fecha *">
                  <input type="date" value={nuevoForm.fecha}
                    onChange={e => setNuevoForm(f => ({ ...f, fecha: e.target.value }))}
                    className="crm-input" required />
                </Field>
              </div>
              <Field label="Monto pagado (USD) *">
                <input type="number" min="0" step="0.01" placeholder="95.25"
                  value={nuevoForm.monto_pagado}
                  onChange={e => setNuevoForm(f => ({ ...f, monto_pagado: e.target.value }))}
                  className="crm-input" required />
              </Field>
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 12px", borderRadius: "8px",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                marginBottom: "14px",
              }}>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>Estado calculado:</span>
                <StatusBadge estado={nuevoEstado} />
              </div>
              <ErrorBox />
              <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end sm:items-center pt-1">
                {saveSuccessNuevo ? (
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 px-4 py-2.5 rounded-lg">
                    <CheckCircle2 size={15} /> Pago registrado correctamente
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={closeModal} disabled={isPending} className="crm-btn-secondary w-full sm:w-auto min-h-[44px] px-5 py-[9px]">Cancelar</button>
                    <button type="submit" disabled={isPending} className="crm-btn-primary w-full sm:w-auto min-h-[44px] justify-center px-6 py-[9px]">
                      {isPending && <Loader2 size={14} className="animate-spin" />}
                      {isPending ? "Guardando..." : <><Save size={14} /> Guardar</>}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </Backdrop>
      )}

      {/* ════════════════════════════════════════════
          MODAL — REGISTRAR GASTO
      ════════════════════════════════════════════ */}
      {modal === "gasto" && (
        <Backdrop onClose={closeModal} className="">
          <div className="crm-modal" style={{ maxWidth: "520px" }}>
            <ModalHeader
              title="Registrar Gasto"
              subtitle="Nuevo cargo pendiente para el agente"
              onClose={closeModal}
              icon={<TrendingDown size={20} className="text-rose-600" />}
              iconBg="bg-rose-50"
            />
            <form onSubmit={handleGasto} style={{ padding: "20px" }}>
              <Field label="Agente *">
                <select
                  value={gastoForm.agente_id}
                  onChange={e => {
                    setGastoForm(f => ({ ...f, agente_id: e.target.value }))
                    setCreditoOpcion("no")
                    setCreditoParcialMonto("")
                  }}
                  className="crm-input" required
                >
                  {agentesActivos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Concepto *">
                  <input
                    type="text" placeholder="Ej: FEE mensual"
                    value={gastoForm.concepto}
                    onChange={e => setGastoForm(f => ({ ...f, concepto: e.target.value }))}
                    className="crm-input" required
                  />
                </Field>
                <Field label="Tipo">
                  <div style={{ display: "flex", gap: "6px" }}>
                    {(["Ordinario", "Extraordinario"] as const).map(t => (
                      <button
                        key={t} type="button"
                        onClick={() => setGastoForm(f => ({ ...f, tipo: t }))}
                        style={{
                          flex: 1, padding: "9px 0", borderRadius: "8px", fontSize: "12px",
                          fontWeight: gastoForm.tipo === t ? 700 : 500,
                          cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                          border: gastoForm.tipo === t ? "1.5px solid #E31837" : "1px solid rgba(255,255,255,0.08)",
                          background: gastoForm.tipo === t ? "#FFF1F2" : "white",
                          color: gastoForm.tipo === t ? "var(--crm-accent)" : "#64748B",
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Monto (USD) *">
                  <input type="number" min="0" step="0.01" placeholder="0"
                    value={gastoForm.monto_debe}
                    onChange={e => setGastoForm(f => ({ ...f, monto_debe: e.target.value }))}
                    className="crm-input" required />
                </Field>
                <Field label="Fecha *">
                  <input type="date" value={gastoForm.fecha}
                    onChange={e => setGastoForm(f => ({ ...f, fecha: e.target.value }))}
                    className="crm-input" required />
                </Field>
              </div>

              {/* Crédito disponible */}
              {saldoGastoAgente > 0 && (
                <div style={{
                  padding: "12px 14px", borderRadius: "10px",
                  background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)",
                  marginBottom: "14px",
                }}>
                  <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#4ade80", marginBottom: "8px" }}>
                    Este agente tiene {fmtUSD(saldoGastoAgente)} a favor. ¿Cómo lo aplicás?
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {(["todo", "parcial", "no"] as CreditoOpcion[]).map(op => (
                      <button
                        key={op} type="button"
                        onClick={() => { setCreditoOpcion(op); if (op !== "parcial") setCreditoParcialMonto("") }}
                        style={{
                          padding: "5px 12px", borderRadius: "7px", fontSize: "12px",
                          fontWeight: creditoOpcion === op ? 700 : 500,
                          cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                          border: creditoOpcion === op ? "1px solid #4ade80" : "1px solid rgba(74,222,128,0.25)",
                          background: creditoOpcion === op ? "rgba(74,222,128,0.2)" : "rgba(74,222,128,0.05)",
                          color: "#4ade80",
                        }}
                      >
                        {op === "todo" ? "Aplicar todo" : op === "parcial" ? "Aplicar parcialmente" : "No aplicar"}
                      </button>
                    ))}
                  </div>
                  {creditoOpcion === "parcial" && (
                    <input
                      type="number" min="0.01" step="0.01"
                      placeholder={`Máx. ${fmtUSD(saldoGastoAgente)}`}
                      value={creditoParcialMonto}
                      onChange={e => setCreditoParcialMonto(e.target.value)}
                      className="crm-input mt-2"
                    />
                  )}
                </div>
              )}

              {/* Gasto recurrente CTA */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", borderRadius: "10px",
                background: "rgba(255,255,255,0.04)", border: "1.5px dashed #CBD5E1",
                marginBottom: "14px",
              }}>
                <div>
                  <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--crm-text)" }}>
                    ¿Aplicar a múltiples agentes?
                  </div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>
                    FEE mensual, CRM PRO o PRO+ — monto desde config
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { closeModal(); setTimeout(() => openGastoRec(), 50) }}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "7px 14px", borderRadius: "8px",
                    border: "1px solid rgba(167,139,250,0.4)", background: "rgba(167,139,250,0.1)",
                    fontSize: "12px", fontWeight: 700, color: "#a78bfa",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <Repeat size={13} /> Gasto recurrente
                </button>
              </div>

              <ErrorBox />
              <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end sm:items-center pt-1">
                {saveSuccessGasto ? (
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 px-4 py-2.5 rounded-lg">
                    <CheckCircle2 size={15} /> Gasto registrado correctamente
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={closeModal} disabled={isPending} className="crm-btn-secondary w-full sm:w-auto min-h-[44px] px-5 py-[9px]">Cancelar</button>
                    <button type="submit" disabled={isPending} className="crm-btn-primary w-full sm:w-auto min-h-[44px] justify-center px-6 py-[9px]">
                      {isPending && <Loader2 size={14} className="animate-spin" />}
                      {isPending ? "Guardando..." : <><Save size={14} /> Registrar gasto</>}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </Backdrop>
      )}

      {/* ════════════════════════════════════════════
          MODAL — GASTO RECURRENTE
      ════════════════════════════════════════════ */}
      {modal === "gasto_rec" && (
        <Backdrop onClose={closeModal} className="">
          <div className="crm-modal" style={{ maxWidth: "560px" }}>
            <ModalHeader
              title="Gasto Recurrente"
              subtitle="Aplicar cargo a múltiples agentes a la vez"
              onClose={closeModal}
            />
            <form onSubmit={handleGastoRec} style={{ padding: "20px", overflow: "auto", flex: 1, display: "flex", flexDirection: "column" }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Concepto *">
                  <select
                    value={gastoRec.concepto}
                    onChange={e => setGastoRec(f => ({ ...f, concepto: e.target.value }))}
                    className="crm-input" required
                  >
                    {CONCEPTOS_RECURRENTE.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Fecha *">
                  <input type="date" value={gastoRec.fecha}
                    onChange={e => setGastoRec(f => ({ ...f, fecha: e.target.value }))}
                    className="crm-input" required />
                </Field>
              </div>

              {/* Auto monto */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", borderRadius: "8px",
                background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)",
                marginBottom: "14px",
              }}>
                <span style={{ fontSize: "12px", color: "#4ade80", fontWeight: 600 }}>
                  Monto por agente (desde config):
                </span>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#059669" }}>
                  {fmtUSD(gastoRecMonto)}
                </span>
              </div>

              {/* Multi-select agentes */}
              <Field label={`Agentes (${selectedAgentesRec.size} seleccionados) *`}>
                <div style={{
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px",
                  overflow: "auto", maxHeight: "200px",
                  background: "var(--crm-surface-2)",
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <button
                      type="button"
                      onClick={() => setSelectedAgentesRec(new Set(agentes.filter(a => a.activo).map(a => a.id)))}
                      style={{ fontSize: "11px", color: "#7C3AED", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                    >
                      Todos activos
                    </button>
                    <span style={{ color: "#CBD5E1" }}>|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedAgentesRec(new Set())}
                      style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                    >
                      Limpiar
                    </button>
                  </div>
                  {agentes.filter(a => a.activo).map(a => (
                    <label
                      key={a.id}
                      style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "8px 12px",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                        cursor: "pointer",
                        background: selectedAgentesRec.has(a.id) ? "rgba(124,58,237,0.15)" : "transparent",
                        transition: "background 0.1s",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAgentesRec.has(a.id)}
                        onChange={ev => {
                          const next = new Set(selectedAgentesRec)
                          if (ev.target.checked) next.add(a.id)
                          else next.delete(a.id)
                          setSelectedAgentesRec(next)
                        }}
                        style={{ accentColor: "#7C3AED", width: "14px", height: "14px" }}
                      />
                      <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--crm-text)" }}>{a.nombre}</span>
                    </label>
                  ))}
                </div>
              </Field>

              <ErrorBox />
              <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end sm:items-center mt-auto pt-2">
                <button type="button" onClick={closeModal} disabled={isPending} className="crm-btn-secondary w-full sm:w-auto min-h-[44px] px-5 py-[9px]">Cancelar</button>
                <button
                  type="submit" disabled={isPending}
                  className="crm-btn-primary w-full sm:w-auto min-h-[44px] justify-center px-6 py-[9px]"
                  style={{ background: isPending ? "rgba(255,255,255,0.15)" : "linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)", boxShadow: isPending ? "none" : "0 2px 8px rgba(124,58,237,0.3)" }}
                >
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  {isPending ? "Aplicando..." : `Aplicar a ${selectedAgentesRec.size} agente${selectedAgentesRec.size !== 1 ? "s" : ""}`}
                </button>
              </div>
            </form>
          </div>
        </Backdrop>
      )}

      {/* ════════════════════════════════════════════
          MODAL — EDITAR PAGO
      ════════════════════════════════════════════ */}
      {modal === "editar" && selectedPago && (
        <Backdrop onClose={closeModal} className="">
          <div className="crm-modal" style={{ maxWidth: "440px" }}>
            <ModalHeader
              title="Registrar Pago Parcial"
              subtitle="Actualizá el monto abonado"
              onClose={closeModal}
            />
            <form onSubmit={handleEditar} style={{ padding: "20px" }}>
              <ReadOnlyField
                label="Agente"
                value={(selectedPago.agentes as { nombre: string } | null)?.nombre ?? "—"}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ReadOnlyField label="Concepto" value={selectedPago.concepto} />
                <ReadOnlyField label="Monto que debe" value={fmtUSD(Number(selectedPago.monto_debe))} />
              </div>
              <Field label="Nuevo monto pagado total (USD) *">
                <input
                  type="number" min="0" max={Number(selectedPago.monto_debe)} step="0.01"
                  value={editForm.monto_pagado}
                  onChange={e => setEditForm({ monto_pagado: e.target.value })}
                  className="crm-input" required autoFocus
                />
              </Field>
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 12px", borderRadius: "8px",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                marginBottom: "14px",
              }}>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>Nuevo estado:</span>
                <StatusBadge estado={editEstado} />
                <span style={{ marginLeft: "auto", fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>
                  Saldo: <strong style={{ color: editEstado === "Pagado" ? "#059669" : "var(--crm-accent)" }}>
                    {fmtUSD(Math.max(0, Number(selectedPago.monto_debe) - (parseFloat(editForm.monto_pagado) || 0)))}
                  </strong>
                </span>
              </div>
              <ErrorBox />
              <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end sm:items-center pt-1">
                <button type="button" onClick={closeModal} disabled={isPending} className="crm-btn-secondary w-full sm:w-auto min-h-[44px] px-5 py-[9px]">Cancelar</button>
                <button type="submit" disabled={isPending} className="crm-btn-primary w-full sm:w-auto min-h-[44px] justify-center px-6 py-[9px]">
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  {isPending ? "Guardando..." : "Actualizar pago"}
                </button>
              </div>
            </form>
          </div>
        </Backdrop>
      )}

      {/* ════════════════════════════════════════════
          MODAL — SALDO A FAVOR
      ════════════════════════════════════════════ */}
      {modal === "saldo_favor" && (
        <Backdrop onClose={closeModal} className="">
          <div className="crm-modal" style={{ maxWidth: "440px" }}>
            <ModalHeader
              title="Registrar Saldo a Favor"
              subtitle="El monto se acredita como crédito del agente"
              onClose={closeModal}
              icon={<TrendingUp size={20} className="text-emerald-600" />}
              iconBg="bg-emerald-50"
            />
            <form onSubmit={handleSaldoFavor} style={{ padding: "20px" }}>
              <Field label="Agente *">
                <select
                  value={saldoFavorForm.agente_id}
                  onChange={e => setSaldoFavorForm(f => ({ ...f, agente_id: e.target.value }))}
                  className="crm-input" required
                >
                  {agentesActivos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Monto (USD) *">
                  <input
                    type="number" min="0.01" step="0.01" placeholder="0.00"
                    value={saldoFavorForm.monto}
                    onChange={e => setSaldoFavorForm(f => ({ ...f, monto: e.target.value }))}
                    className="crm-input" required autoFocus
                  />
                </Field>
                <Field label="Fecha *">
                  <input type="date" value={saldoFavorForm.fecha}
                    onChange={e => setSaldoFavorForm(f => ({ ...f, fecha: e.target.value }))}
                    className="crm-input" required />
                </Field>
              </div>
              <ErrorBox />
              <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end sm:items-center pt-1">
                <button type="button" onClick={closeModal} disabled={isPending} className="crm-btn-secondary w-full sm:w-auto min-h-[44px] px-5 py-[9px]">Cancelar</button>
                <button
                  type="submit" disabled={isPending}
                  className="crm-btn-primary w-full sm:w-auto min-h-[44px] justify-center px-6 py-[9px]"
                  style={{ background: isPending ? "rgba(255,255,255,0.15)" : "linear-gradient(135deg,#059669 0%,#047857 100%)", boxShadow: isPending ? "none" : "0 2px 8px rgba(5,150,105,0.3)" }}
                >
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  {isPending ? "Guardando..." : <><Save size={14} /> Guardar</>}
                </button>
              </div>
            </form>
          </div>
        </Backdrop>
      )}

      {/* ════════════════════════════════════════════
          MODAL — CONFIRMAR ELIMINACIÓN
      ════════════════════════════════════════════ */}
      {deleteTarget && (
        <Backdrop onClose={() => !deleteLoading && setDeleteTarget(null)} className="">
          <div className="crm-modal" style={{ maxWidth: "440px" }}>
            <ModalHeader
              title="Eliminar registro"
              subtitle="Esta acción no se puede deshacer"
              onClose={() => !deleteLoading && setDeleteTarget(null)}
              icon={<Trash2 size={20} className="text-red-500" />}
              iconBg="bg-red-500/10"
            />
            <div style={{ padding: "20px" }}>
              <div style={{
                padding: "14px 16px", borderRadius: "10px",
                background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)",
                marginBottom: "18px",
              }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--crm-text)", marginBottom: "4px" }}>
                  {deleteTarget.concepto}
                </div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>
                  {fmtUSD(Number(deleteTarget.monto_debe))} · {fmtFecha(deleteTarget.fecha)}
                </div>
              </div>
              {deleteError && (
                <div style={{
                  padding: "10px 12px", borderRadius: "8px",
                  background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)",
                  fontSize: "12px", color: "var(--crm-accent)", marginBottom: "14px",
                }}>
                  {deleteError}
                </div>
              )}
              <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end sm:items-center">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteLoading}
                  className="crm-btn-secondary w-full sm:w-auto min-h-[44px] px-5 py-[9px]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEliminar}
                  disabled={deleteLoading}
                  className="crm-btn-primary w-full sm:w-auto min-h-[44px] justify-center px-6 py-[9px]"
                  style={{ background: deleteLoading ? "#F87171" : "var(--crm-accent)" }}
                >
                  {deleteLoading && <Loader2 size={14} className="animate-spin" />}
                  {deleteLoading ? "Eliminando..." : "Eliminar registro"}
                </button>
              </div>
            </div>
          </div>
        </Backdrop>
      )}

      {/* ════════════════════════════════════════════
          MODAL — DETALLE POR CONCEPTO
      ════════════════════════════════════════════ */}
      {detalleConcepto && (
        <Backdrop onClose={() => setDetalleConcepto(null)} className="">
          <div className="crm-modal" style={{ maxWidth: "480px", width: "100%", maxHeight: "70vh", display: "flex", flexDirection: "column" }}>
            <ModalHeader
              title={
                detalleConcepto === "FEE" ? "FEE mensual" :
                detalleConcepto === "CRM" ? "Licencias CRM" :
                detalleConcepto === "Mainstreet" ? "Mainstreet" :
                detalleConcepto === "BolsasVino" ? "Bolsas de vinos" :
                "Otros"
              }
              subtitle={`${detalleConceptoData.length} agente${detalleConceptoData.length !== 1 ? "s" : ""} — ${mesLabel(selectedMonth)}`}
              onClose={() => setDetalleConcepto(null)}
            />
            <div style={{ overflow: "auto", padding: "0 20px 20px" }}>
              {detalleConceptoData.length === 0 ? (
                <p style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: "13px", padding: "20px 0" }}>
                  No hay agentes en este concepto este mes.
                </p>
              ) : (
                detalleConceptoData.map((d, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 0", borderBottom: i < detalleConceptoData.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  }}>
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--crm-text)", margin: 0 }}>{d.nombre}</p>
                      <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", margin: 0 }}>{d.concepto}</p>
                      {d.monto !== null && (
                        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", margin: "2px 0 0" }}>{fmtUSD(d.monto)}</p>
                      )}
                    </div>
                    <span style={{
                      fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "6px",
                      background: d.estado === "Pagado" ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
                      color: d.estado === "Pagado" ? "#4ade80" : "#f87171",
                    }}>
                      {d.estado === "Pagado" ? "Pagado" : "Pendiente"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Backdrop>
      )}

      {/* ════════════════════════════════════════════
          MODAL — APLICAR SALDO A FAVOR A PENDIENTES
      ════════════════════════════════════════════ */}
      {aplicarCreditoAgente && (() => {
        const agenteInfo    = agentes.find(a => a.id === aplicarCreditoAgente)
        const saldoFavor    = saldoPorAgente.get(aplicarCreditoAgente) ?? 0
        const pendientes    = pagos.filter(p =>
          p.agente_id === aplicarCreditoAgente &&
          p.concepto !== "Saldo a favor" &&
          p.estado !== "Pagado"
        )

        const totalSeleccionado = Object.values(aplicarSeleccion).reduce((s, v) => s + v, 0)
        const restante = saldoFavor - totalSeleccionado

        function toggleConcepto(p: PagoRow) {
          setAplicarSeleccion(prev => {
            const next = { ...prev }
            if (p.id in next) {
              delete next[p.id]
            } else {
              const faltante = Number(p.monto_debe) - Number(p.monto_pagado)
              const disponible = saldoFavor - Object.values(prev).reduce((s, v) => s + v, 0)
              next[p.id] = Math.max(0, Math.min(faltante, disponible))
            }
            return next
          })
        }

        function aplicarModoTodo() {
          // Auto-distribuye todo el saldo entre pendientes, más viejo primero, hasta agotar
          let disponible = saldoFavor
          const nueva: Record<string, number> = {}
          const ordenados = [...pendientes].sort((a, b) => a.fecha.localeCompare(b.fecha))
          for (const p of ordenados) {
            if (disponible <= 0) break
            const faltante = Number(p.monto_debe) - Number(p.monto_pagado)
            const usar = Math.min(faltante, disponible)
            if (usar > 0) { nueva[p.id] = usar; disponible -= usar }
          }
          setAplicarSeleccion(nueva)
        }

        async function confirmarAplicacion() {
          setAplicarError("")
          const aplicaciones = Object.entries(aplicarSeleccion)
            .filter(([, monto]) => monto > 0)
            .map(([pago_id, monto]) => ({ pago_id, monto }))

          if (aplicaciones.length === 0) { setAplicarError("Seleccioná al menos un concepto"); return }

          setAplicarLoading(true)
          const result = await aplicarCreditoAPendientes({ agente_id: aplicarCreditoAgente!, aplicaciones })
          setAplicarLoading(false)

          if (result.error) { setAplicarError(result.error); return }

          setAplicarCreditoAgente(null)
          router.refresh()
        }

        return (
          <Backdrop onClose={() => setAplicarCreditoAgente(null)} className="crm-modal" style={{ maxWidth: "520px" }}>
            <ModalHeader
              title="Aplicar saldo a favor"
              subtitle={`${agenteInfo?.nombre ?? ""} — Disponible: ${fmtUSD(saldoFavor)}`}
              onClose={() => setAplicarCreditoAgente(null)}
            />

            <div style={{ padding: "20px" }}>

              {/* Toggle Todo / Parcial */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                <button
                  onClick={() => { setAplicarModo("todo"); aplicarModoTodo() }}
                  style={{
                    flex: 1, padding: "8px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit",
                    fontSize: "12.5px", fontWeight: 700,
                    border: aplicarModo === "todo" ? "1px solid #4ade80" : "1px solid rgba(255,255,255,0.1)",
                    background: aplicarModo === "todo" ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.04)",
                    color: aplicarModo === "todo" ? "#4ade80" : "rgba(255,255,255,0.6)",
                  }}
                >
                  Aplicar todo el saldo
                </button>
                <button
                  onClick={() => { setAplicarModo("parcial"); setAplicarSeleccion({}) }}
                  style={{
                    flex: 1, padding: "8px", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit",
                    fontSize: "12.5px", fontWeight: 700,
                    border: aplicarModo === "parcial" ? "1px solid #4ade80" : "1px solid rgba(255,255,255,0.1)",
                    background: aplicarModo === "parcial" ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.04)",
                    color: aplicarModo === "parcial" ? "#4ade80" : "rgba(255,255,255,0.6)",
                  }}
                >
                  Elegir manualmente
                </button>
              </div>

              {/* Lista de conceptos pendientes */}
              {pendientes.length === 0 ? (
                <p style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: "13px", padding: "16px 0" }}>
                  No hay conceptos pendientes para este agente.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "260px", overflowY: "auto" }}>
                  {pendientes.map(p => {
                    const faltante = Number(p.monto_debe) - Number(p.monto_pagado)
                    const seleccionado = p.id in aplicarSeleccion
                    return (
                      <div key={p.id} style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "10px", borderRadius: "8px",
                        border: seleccionado ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(255,255,255,0.08)",
                        background: seleccionado ? "rgba(74,222,128,0.06)" : "rgba(255,255,255,0.02)",
                      }}>
                        <input
                          type="checkbox"
                          checked={seleccionado}
                          disabled={aplicarModo === "todo"}
                          onChange={() => toggleConcepto(p)}
                        />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--crm-text)", margin: 0 }}>{p.concepto}</p>
                          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", margin: 0 }}>Falta: {fmtUSD(faltante)}</p>
                        </div>
                        {seleccionado && (
                          <input
                            type="number"
                            step="0.01"
                            disabled={aplicarModo === "todo"}
                            value={aplicarSeleccion[p.id]}
                            onChange={e => {
                              const val = Math.max(0, Math.min(faltante, parseFloat(e.target.value) || 0))
                              setAplicarSeleccion(prev => ({ ...prev, [p.id]: val }))
                            }}
                            style={{
                              width: "90px", padding: "6px 8px", borderRadius: "6px",
                              border: "1px solid rgba(255,255,255,0.12)", background: "var(--crm-input-bg)",
                              color: "var(--crm-text)", fontSize: "12px", textAlign: "right",
                            }}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Totales */}
              <div style={{
                display: "flex", justifyContent: "space-between", marginTop: "16px",
                padding: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.03)",
                fontSize: "13px",
              }}>
                <span>
                  <span style={{ color: "rgba(255,255,255,0.45)" }}>A aplicar: </span>
                  <strong style={{ color: "var(--crm-text)" }}>{fmtUSD(totalSeleccionado)}</strong>
                </span>
                <span>
                  <span style={{ color: "rgba(255,255,255,0.45)" }}>Restante: </span>
                  <strong style={{ color: restante >= 0 ? "#4ade80" : "#f87171" }}>{fmtUSD(restante)}</strong>
                </span>
              </div>

              {aplicarError && (
                <p style={{ color: "#f87171", fontSize: "12px", marginTop: "10px" }}>{aplicarError}</p>
              )}

              <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
                <button
                  onClick={() => setAplicarCreditoAgente(null)}
                  style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "var(--crm-text)", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", fontWeight: 600 }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarAplicacion}
                  disabled={aplicarLoading || totalSeleccionado <= 0 || restante < -0.01}
                  style={{
                    flex: 1, padding: "10px", borderRadius: "8px", border: "none",
                    background: "linear-gradient(135deg,#4ade80 0%,#16a34a 100%)",
                    color: "white", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", fontWeight: 700,
                    opacity: (aplicarLoading || totalSeleccionado <= 0 || restante < -0.01) ? 0.5 : 1,
                  }}
                >
                  {aplicarLoading ? "Aplicando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </Backdrop>
        )
      })()}
    </div>
  )
}
