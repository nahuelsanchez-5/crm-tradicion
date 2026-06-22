"use client"

import { useState, useMemo, useTransition, useEffect, useCallback, Fragment } from "react"
import { useRouter } from "next/navigation"
import { crearPago, actualizarPago, crearGasto, crearGastoRecurrente, eliminarPago, registrarSaldoFavor, crearGastoConCredito } from "./actions"
import { DollarSign, X, Loader2, MessageCircle, TrendingDown, TrendingUp, Repeat, CheckCircle2, Save, Trash2 } from "lucide-react"

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

const ESTADO_STYLES: Record<string, { bg: string; color: string }> = {
  Pagado:    { bg: "rgba(74,222,128,0.12)",  color: "#4ade80" },
  Parcial:   { bg: "rgba(251,191,36,0.12)",  color: "#fbbf24" },
  Pendiente: { bg: "rgba(248,113,113,0.12)", color: "#f87171" },
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
  fecha_mainstreet: string | null
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
  if (totalDebe <= 0)           return "Pagado"
  if (totalPagado <= 0)         return "Pendiente"
  if (totalPagado >= totalDebe) return "Pagado"
  return "Parcial"
}

function getConceptGroup(concepto: string): "FEE" | "CRM" | "Mainstreet" | "Otros" {
  const c = concepto.toLowerCase()
  if (c.includes("fee"))                                                          return "FEE"
  if (c.includes("pro") || c.includes("crm") || c.includes("plan") || c.includes("licencia")) return "CRM"
  if (c.includes("mainstreet"))                                                   return "Mainstreet"
  return "Otros"
}

function fmtUSD(n: number): string {
  const rounded = Math.round(n * 100) / 100
  if (rounded === Math.floor(rounded)) {
    return `USD ${rounded.toLocaleString("es-AR")}`
  }
  return `USD ${rounded.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
function EstadoBadge({ estado }: { estado: string }) {
  const s = ESTADO_STYLES[estado] ?? { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }
  return (
    <span style={{ ...s, padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700 }}>
      {estado}
    </span>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "#059669" : pct >= 50 ? "#D97706" : "#E11D48"
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

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)",
  fontSize: "13px", fontFamily: "inherit",
  color: "#f1f5f9", outline: "none", background: "rgba(255,255,255,0.06)",
  boxSizing: "border-box",
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
    todos:     { border: "1px solid rgba(255,255,255,0.3)",   background: "rgba(255,255,255,0.12)", color: "#f1f5f9" },
    Pagado:    { border: "1px solid rgba(74,222,128,0.4)",    background: "rgba(74,222,128,0.12)",  color: "#4ade80" },
    Parcial:   { border: "1px solid rgba(251,191,36,0.4)",    background: "rgba(251,191,36,0.12)",  color: "#fbbf24" },
    Pendiente: { border: "1px solid rgba(248,113,113,0.4)",   background: "rgba(248,113,113,0.12)", color: "#f87171" },
  }
  return { ...base, fontWeight: 700, ...(active[key] ?? active.todos) }
}

// ── KPI box component ────────────────────────────────
function KpiConcepto({
  label, x, y, pct, color, gradient: _g,
}: {
  label: string; x: number; y?: number; pct?: number; color: string; gradient: string
}) {
  const colorMap: Record<string, { bg: string; text: string; bar: string }> = {
    "#E31837": { bg: "rgba(248,113,113,0.08)", text: "#f87171",  bar: "#f87171" },
    "#7C3AED": { bg: "rgba(167,139,250,0.08)", text: "#a78bfa",  bar: "#a78bfa" },
    "#0D9488": { bg: "rgba(45,212,191,0.08)",  text: "#2dd4bf",  bar: "#2dd4bf" },
    "#D97706": { bg: "rgba(251,191,36,0.08)",  text: "#fbbf24",  bar: "#fbbf24" },
  }
  const { bg, text, bar } = colorMap[color] ?? { bg: "rgba(255,255,255,0.06)", text: "rgba(255,255,255,0.6)", bar: "rgba(255,255,255,0.3)" }
  return (
    <div style={{ background: bg, borderRadius: "16px", border: "1px solid rgba(255,255,255,0.08)", padding: "20px", display: "flex", flexDirection: "column", gap: "10px", minHeight: "110px" }}>
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

// ── Modal backdrop ───────────────────────────────────
function Backdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} className="crm-modal-backdrop">
      <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  )
}

// ── Modal header ─────────────────────────────────────
function ModalHeader({ title, subtitle, onClose, icon, iconBg }: { title: string; subtitle?: string; onClose: () => void; icon?: React.ReactNode; iconBg?: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {icon && (
          <div className={`${iconBg ?? "bg-slate-50"} rounded-xl p-2.5 flex-shrink-0`}>
            {icon}
          </div>
        )}
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>{title}</h2>
          {subtitle && <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, marginTop: "2px" }}>{subtitle}</p>}
        </div>
      </div>
      <button onClick={onClose} style={{
        background: "rgba(255,255,255,0.04)", border: "none", borderRadius: "8px",
        width: "32px", height: "32px", display: "flex",
        alignItems: "center", justifyContent: "center",
        cursor: "pointer", color: "rgba(255,255,255,0.45)",
      }}>
        <X size={16} />
      </button>
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
}

export default function PagosClient({ pagos, agentes, configBonos }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Filters ────────────────────────────────────────
  const [selectedEstado, setSelectedEstado] = useState("todos")
  const [selectedMonth, setSelectedMonth]   = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })

  // ── Expanded row ───────────────────────────────────
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)

  // ── Modal ──────────────────────────────────────────
  type ModalT = "none" | "nuevo" | "editar" | "gasto" | "gasto_rec" | "saldo_favor"
  const [modal,        setModal]        = useState<ModalT>("none")
  const [selectedPago, setSelectedPago] = useState<PagoRow | null>(null)
  const [error,        setError]        = useState("")

  const todayStr = new Date().toISOString().split("T")[0]

  const [nuevoForm, setNuevoForm] = useState<NuevoForm>({
    agente_id:    agentes[0]?.id ?? "",
    concepto:     CONCEPTOS_PAGO[0],
    monto_pagado: "",
    fecha:        todayStr,
  })

  const [gastoForm, setGastoForm] = useState<GastoForm>({
    agente_id: agentes[0]?.id ?? "",
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
    agente_id: agentes[0]?.id ?? "",
    monto: "",
    fecha: todayStr,
  })

  const [creditoOpcion,       setCreditoOpcion]       = useState<CreditoOpcion>("no")
  const [creditoParcialMonto, setCreditoParcialMonto] = useState("")

  const [saveSuccessNuevo, setSaveSuccessNuevo] = useState(false)
  const [saveSuccessGasto, setSaveSuccessGasto] = useState(false)

  // ── Computed: KPI stats ────────────────────────────
  const kpiStats = useMemo(() => {
    const monthPagos = pagos.filter(p =>
      selectedMonth === "todos" || p.fecha.startsWith(selectedMonth)
    )

    const agentesActivos      = agentes.filter(a => a.activo)
    const agentesActivosCount = agentesActivos.length
    const agentesFeeCount     = agentes.filter(a => a.paga_fee === true).length
    const agentesCrmCount     = agentes.filter(a =>
      a.activo && a.paga_fee === true
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

    // Mainstreet — denominador: agentes activos con fecha_mainstreet en el mes/año del filtro
    const refDate  = selectedMonth === "todos"
      ? new Date()
      : new Date(parseInt(selectedMonth.split("-")[0]), parseInt(selectedMonth.split("-")[1]) - 1, 1)
    const refMonth = refDate.getMonth() + 1
    const refYear  = refDate.getFullYear()

    const mainTotal = agentesActivos.filter(a => {
      if (!a.fecha_mainstreet) return false
      const [y, m] = a.fecha_mainstreet.split("-").map(Number)
      return m === refMonth && y === refYear
    }).length

    const mainPagos = monthPagos.filter(p => getConceptGroup(p.concepto) === "Mainstreet")
    const mainCobrX = new Set(mainPagos.filter(p => p.estado === "Pagado").map(p => p.agente_id)).size
    const mainPct   = mainTotal > 0 ? Math.round((mainCobrX / mainTotal) * 100) : 0

    // Otros
    const otrosPagos = monthPagos.filter(p => getConceptGroup(p.concepto) === "Otros")
    const otrosCobrX = otrosPagos.filter(p => p.estado === "Pagado").length

    const pctGeneral = Math.round((feePct + crmPct + mainPct) / 3)

    return {
      feeCobrX, feeTotal: agentesFeeCount, feePct,
      crmCobrX, crmTotal, crmPct,
      mainCobrX, mainTotal, mainPct,
      otrosCobrX, pctGeneral,
    }
  }, [pagos, agentes, selectedMonth])

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

    const rows = Array.from(grouped.entries()).map(([agente_id, agentePagos]) => {
      const totalDebe   = agentePagos.reduce((s, p) => s + Number(p.monto_debe),   0)
      const totalPagado = agentePagos.reduce((s, p) => s + Number(p.monto_pagado), 0)
      const saldo       = totalDebe - totalPagado
      const estadoGral  = calcEstadoGeneral(totalDebe, totalPagado)
      const ultimoMov   = agentePagos.reduce((mx, p) => p.fecha > mx ? p.fecha : mx, "")
      const nombre      = (agentePagos[0].agentes as { nombre: string } | null)?.nombre ?? "—"
      const info        = agentes.find(a => a.id === agente_id)
      return { agente_id, nombre, telefono: info?.telefono ?? null, saldo, totalDebe, totalPagado, estadoGral, ultimoMov, pagos: agentePagos }
    })

    return rows
      .filter(r => selectedEstado === "todos" || r.estadoGral === selectedEstado)
      .sort((a, b) => b.saldo - a.saldo)
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
      agente_id:    preAgente ?? agentes[0]?.id ?? "",
      concepto:     CONCEPTOS_PAGO[0],
      monto_pagado: "",
      fecha:        todayStr,
    })
    setError("")
    setModal("nuevo")
  }

  function openGasto(preAgente?: string) {
    setGastoForm({
      agente_id: preAgente ?? agentes[0]?.id ?? "",
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
      agente_id: agentes[0]?.id ?? "",
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
          return `- ${p.concepto} — ${fmtUSD(debe > 0 ? debe : pagado)} \u2705`
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

    const msg = `Hola ${nombre}! Te paso el resumen de ${mes}:\n\n${detalle}\n\n${cierre}`

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

  const cardStyle: React.CSSProperties = {
    background: "#13131a", borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden",
  }

  const btnSave: React.CSSProperties = {
    padding: "9px 24px", borderRadius: "8px", border: "none",
    background: isPending ? "#CBD5E1" : "linear-gradient(135deg,#E31837 0%,#c0122d 100%)",
    color: "white", fontSize: "13px", fontWeight: 700,
    cursor: isPending ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    display: "flex", alignItems: "center", gap: "6px",
    boxShadow: isPending ? "none" : "0 2px 8px rgba(227,24,55,0.3)",
  }

  const btnCancel: React.CSSProperties = {
    padding: "9px 20px", borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.06)",
    fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.45)",
    cursor: "pointer", fontFamily: "inherit",
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

      {/* ── Page Header ──────────────────────────── */}
      <div className="crm-page-header flex-shrink-0">
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.3px", margin: 0 }}>
            Cuentas
          </h1>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, marginTop: "1px" }}>
            Control de cobros por concepto — REMAX Tradición
          </p>
        </div>
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
              background: "#13131a", color: "#f1f5f9",
              border: "1px solid rgba(255,255,255,0.08)",
              padding: "8px 16px", borderRadius: "9px",
              fontSize: "13px", fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            <TrendingDown size={14} color="#E11D48" /> Registrar gasto
          </button>
          <button
            onClick={() => openNuevo()}
            style={{
              background: "linear-gradient(135deg,#E31837 0%,#c0122d 100%)",
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-5">
          <KpiConcepto
            label="FEE mensual"
            x={kpiStats.feeCobrX}
            y={kpiStats.feeTotal}
            pct={kpiStats.feePct}
            color="#E31837"
            gradient="linear-gradient(135deg,#E31837 0%,#9B0F26 100%)"
          />
          <KpiConcepto
            label="Licencias CRM"
            x={kpiStats.crmCobrX}
            y={kpiStats.crmTotal}
            pct={kpiStats.crmPct}
            color="#7C3AED"
            gradient="linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)"
          />
          <KpiConcepto
            label="Mainstreet"
            x={kpiStats.mainCobrX}
            y={kpiStats.mainTotal}
            pct={kpiStats.mainPct}
            color="#0D9488"
            gradient="linear-gradient(135deg,#0D9488 0%,#0F766E 100%)"
          />
          <KpiConcepto
            label="Otros"
            x={kpiStats.otrosCobrX}
            color="#D97706"
            gradient="linear-gradient(135deg,#D97706 0%,#B45309 100%)"
          />
        </div>

        {/* ── % general ──────────────────────────────── */}
        <div style={{
          ...cardStyle,
          display: "flex", alignItems: "center", gap: "16px",
          padding: "12px 20px", marginBottom: "16px", overflow: "visible",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
            <DollarSign size={14} color="#E31837" />
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#f1f5f9" }}>
              Cobranza general: <strong style={{
                color: kpiStats.pctGeneral >= 80 ? "#059669" : kpiStats.pctGeneral >= 50 ? "#D97706" : "#E11D48"
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
        <div style={{
          ...cardStyle,
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
                fontWeight: 500, color: "#f1f5f9", background: "rgba(255,255,255,0.06)",
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
        <div style={cardStyle}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E31837" }} />
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9" }}>
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
              agentesPagos.map(ag => {
                const isExpanded = expandedAgent === ag.agente_id
                const enMora     = enMoraAgentes.has(ag.agente_id)
                return (
                  <div key={ag.agente_id}>
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
                          <span style={{ fontWeight: 600, fontSize: "13px", color: "#f1f5f9" }}>{ag.nombre}</span>
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
                        <span style={{ fontSize: "13px", fontWeight: 700, color: ag.saldo > 0 ? "#E11D48" : "#059669" }}>
                          {ag.saldo > 0 ? `- ${fmtUSD(ag.saldo)}` : ag.saldo < 0 ? `+ ${fmtUSD(-ag.saldo)}` : fmtUSD(0)}
                        </span>
                        <EstadoBadge estado={ag.estadoGral} />
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 16px" }}>
                        <div className="flex gap-3 mb-3 flex-wrap" style={{ fontSize: "12px" }}>
                          <span><span style={{ color: "rgba(255,255,255,0.45)" }}>Pagado: </span><strong style={{ color: "#059669" }}>{fmtUSD(ag.totalPagado)}</strong></span>
                          <span><span style={{ color: "rgba(255,255,255,0.45)" }}>Pendiente: </span><strong style={{ color: "#E11D48" }}>{fmtUSD(Math.max(0, ag.saldo))}</strong></span>
                        </div>
                        {ag.pagos.map((p, pi) => (
                          <div key={p.id} style={{
                            background: p.concepto === "Saldo a favor" ? "rgba(74,222,128,0.06)" : p.concepto === "Crédito aplicado" ? "rgba(59,130,246,0.06)" : "rgba(255,255,255,0.03)",
                            borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)",
                            padding: "10px 12px", marginBottom: pi < ag.pagos.length - 1 ? "8px" : 0,
                          }}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                {p.concepto === "Saldo a favor" ? (
                                  <span style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", padding: "2px 9px", borderRadius: "12px", fontSize: "11px", fontWeight: 700 }}>Saldo a favor</span>
                                ) : p.concepto === "Crédito aplicado" ? (
                                  <span style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", padding: "2px 9px", borderRadius: "12px", fontSize: "11px", fontWeight: 700 }}>Crédito aplicado</span>
                                ) : (
                                  <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#f1f5f9" }}>{p.concepto}</div>
                                )}
                                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>{fmtFecha(p.fecha)}</div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <EstadoBadge estado={p.estado} />
                                {p.concepto === "Saldo a favor"
                                  ? <span style={{ fontSize: "12px", fontWeight: 700, color: "#059669" }}>+{fmtUSD(Number(p.monto_pagado))}</span>
                                  : <span style={{ fontSize: "12px", fontWeight: 700, color: "#E11D48" }}>{fmtUSD(Number(p.monto_debe))}</span>
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
                                    fontSize: "12px", fontWeight: 600, color: "#f1f5f9",
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
                                fontSize: "12px", fontWeight: 600, color: "#f1f5f9",
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
                    return (
                      <Fragment key={ag.agente_id}>
                        {/* ── Main row ── */}
                        <tr
                          onClick={() => setExpandedAgent(isExpanded ? null : ag.agente_id)}
                          style={{
                            borderBottom: (isLast && !isExpanded) ? "none" : "1px solid rgba(255,255,255,0.06)",
                            cursor: "pointer",
                            background: isExpanded ? "rgba(255,255,255,0.05)" : "#13131a",
                            transition: "background 0.1s",
                          }}
                        >
                          <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: "13px", color: "#f1f5f9", whiteSpace: "nowrap" }}>
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
                            color: ag.saldo > 0 ? "#E11D48" : "#059669",
                          }}>
                            {ag.saldo > 0 ? `- ${fmtUSD(ag.saldo)}` : ag.saldo < 0 ? `+ ${fmtUSD(-ag.saldo)}` : fmtUSD(0)}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <EstadoBadge estado={ag.estadoGral} />
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
                                  fontSize: "12px", fontWeight: 600, color: "#f1f5f9",
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
                                    <strong style={{ color: "#E11D48" }}>{fmtUSD(Math.max(0, ag.saldo))}</strong>
                                  </span>
                                  <span>
                                    <span style={{ color: "rgba(255,255,255,0.45)" }}>Estado: </span>
                                    <EstadoBadge estado={ag.estadoGral} />
                                  </span>
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
                                      const isCreditoAplicado = p.concepto === "Crédito aplicado"
                                      const rowBg = isSaldoFavor
                                        ? "rgba(74,222,128,0.05)"
                                        : isCreditoAplicado
                                          ? "rgba(59,130,246,0.05)"
                                          : p.estado === "Pagado" ? "rgba(74,222,128,0.04)" : p.estado === "Parcial" ? "rgba(251,191,36,0.04)" : "rgba(248,113,113,0.04)"
                                      return (
                                        <tr key={p.id} style={{ borderTop: pi > 0 ? "1px solid rgba(255,255,255,0.06)" : "none", background: rowBg }}>
                                          <td style={{ padding: "10px 14px", fontSize: "12px", color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>
                                            {fmtFecha(p.fecha)}
                                          </td>
                                          <td style={{ padding: "10px 14px", fontSize: "12px", color: "#f1f5f9" }}>
                                            {isSaldoFavor ? (
                                              <span style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", padding: "2px 9px", borderRadius: "12px", fontSize: "11px", fontWeight: 700 }}>
                                                Saldo a favor
                                              </span>
                                            ) : isCreditoAplicado ? (
                                              <span style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", padding: "2px 9px", borderRadius: "12px", fontSize: "11px", fontWeight: 700 }}>
                                                Crédito aplicado
                                              </span>
                                            ) : p.concepto}
                                          </td>
                                          <td style={{ padding: "10px 14px", fontSize: "12px", fontWeight: 600, color: isCreditoAplicado ? "#2563EB" : "#E11D48", whiteSpace: "nowrap" }}>
                                            {isSaldoFavor ? "—" : fmtUSD(Number(p.monto_debe))}
                                          </td>
                                          <td style={{ padding: "10px 14px", fontSize: "12px", color: "#059669", fontWeight: 600, whiteSpace: "nowrap" }}>
                                            {isSaldoFavor
                                              ? <span style={{ color: "#059669" }}>+{fmtUSD(Number(p.monto_pagado))}</span>
                                              : Number(p.monto_pagado) > 0 ? fmtUSD(Number(p.monto_pagado)) : "—"}
                                          </td>
                                          <td style={{ padding: "10px 14px" }}>
                                            <EstadoBadge estado={p.estado} />
                                          </td>
                                          <td style={{ padding: "10px 14px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                              {p.estado !== "Pagado" && (
                                                <button
                                                  onClick={() => openEditar(p)}
                                                  style={{
                                                    padding: "3px 10px", borderRadius: "6px",
                                                    border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.06)",
                                                    fontSize: "11px", fontWeight: 600, color: "#f1f5f9",
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
                                  color: ag.saldo > 0 ? "#E11D48" : "#059669",
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
        <Backdrop onClose={closeModal}>
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
                  style={inp}
                  required
                >
                  {agentes.map(a => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Concepto *">
                  <select
                    value={nuevoForm.concepto}
                    onChange={e => setNuevoForm(f => ({ ...f, concepto: e.target.value }))}
                    style={inp}
                    required
                  >
                    {CONCEPTOS_PAGO.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Fecha *">
                  <input type="date" value={nuevoForm.fecha}
                    onChange={e => setNuevoForm(f => ({ ...f, fecha: e.target.value }))}
                    style={inp} required />
                </Field>
              </div>
              <Field label="Monto pagado (USD) *">
                <input type="number" min="0" step="0.01" placeholder="95.25"
                  value={nuevoForm.monto_pagado}
                  onChange={e => setNuevoForm(f => ({ ...f, monto_pagado: e.target.value }))}
                  style={inp} required />
              </Field>
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 12px", borderRadius: "8px",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                marginBottom: "14px",
              }}>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>Estado calculado:</span>
                <EstadoBadge estado={nuevoEstado} />
              </div>
              <ErrorBox />
              <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end sm:items-center pt-1">
                {saveSuccessNuevo ? (
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 px-4 py-2.5 rounded-lg">
                    <CheckCircle2 size={15} /> Pago registrado correctamente
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={closeModal} disabled={isPending} className="w-full sm:w-auto min-h-[44px]" style={btnCancel}>Cancelar</button>
                    <button type="submit" disabled={isPending} className="w-full sm:w-auto min-h-[44px] justify-center" style={btnSave}>
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
        <Backdrop onClose={closeModal}>
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
                  style={inp} required
                >
                  {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Concepto *">
                  <input
                    type="text" placeholder="Ej: FEE mensual"
                    value={gastoForm.concepto}
                    onChange={e => setGastoForm(f => ({ ...f, concepto: e.target.value }))}
                    style={inp} required
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
                          color: gastoForm.tipo === t ? "#E11D48" : "#64748B",
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
                    style={inp} required />
                </Field>
                <Field label="Fecha *">
                  <input type="date" value={gastoForm.fecha}
                    onChange={e => setGastoForm(f => ({ ...f, fecha: e.target.value }))}
                    style={inp} required />
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
                      style={{ ...inp, marginTop: "8px" }}
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
                  <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#f1f5f9" }}>
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
                    <button type="button" onClick={closeModal} disabled={isPending} className="w-full sm:w-auto min-h-[44px]" style={btnCancel}>Cancelar</button>
                    <button type="submit" disabled={isPending} className="w-full sm:w-auto min-h-[44px] justify-center" style={btnSave}>
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
        <Backdrop onClose={closeModal}>
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
                    style={inp} required
                  >
                    {CONCEPTOS_RECURRENTE.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Fecha *">
                  <input type="date" value={gastoRec.fecha}
                    onChange={e => setGastoRec(f => ({ ...f, fecha: e.target.value }))}
                    style={inp} required />
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
                        borderBottom: "1px solid #F8F9FC",
                        cursor: "pointer",
                        background: selectedAgentesRec.has(a.id) ? "#F5F3FF" : "white",
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
                      <span style={{ fontSize: "13px", fontWeight: 500, color: "#f1f5f9" }}>{a.nombre}</span>
                    </label>
                  ))}
                </div>
              </Field>

              <ErrorBox />
              <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end sm:items-center mt-auto pt-2">
                <button type="button" onClick={closeModal} disabled={isPending} className="w-full sm:w-auto min-h-[44px]" style={btnCancel}>Cancelar</button>
                <button
                  type="submit" disabled={isPending}
                  className="w-full sm:w-auto min-h-[44px] justify-center"
                  style={{
                    ...btnSave,
                    background: isPending ? "#CBD5E1" : "linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)",
                    boxShadow: isPending ? "none" : "0 2px 8px rgba(124,58,237,0.3)",
                  }}
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
        <Backdrop onClose={closeModal}>
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
                  style={inp} required autoFocus
                />
              </Field>
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 12px", borderRadius: "8px",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                marginBottom: "14px",
              }}>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>Nuevo estado:</span>
                <EstadoBadge estado={editEstado} />
                <span style={{ marginLeft: "auto", fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>
                  Saldo: <strong style={{ color: editEstado === "Pagado" ? "#059669" : "#E11D48" }}>
                    {fmtUSD(Math.max(0, Number(selectedPago.monto_debe) - (parseFloat(editForm.monto_pagado) || 0)))}
                  </strong>
                </span>
              </div>
              <ErrorBox />
              <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end sm:items-center pt-1">
                <button type="button" onClick={closeModal} disabled={isPending} className="w-full sm:w-auto min-h-[44px]" style={btnCancel}>Cancelar</button>
                <button type="submit" disabled={isPending} className="w-full sm:w-auto min-h-[44px] justify-center" style={btnSave}>
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
        <Backdrop onClose={closeModal}>
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
                  style={inp} required
                >
                  {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Monto (USD) *">
                  <input
                    type="number" min="0.01" step="0.01" placeholder="0.00"
                    value={saldoFavorForm.monto}
                    onChange={e => setSaldoFavorForm(f => ({ ...f, monto: e.target.value }))}
                    style={inp} required autoFocus
                  />
                </Field>
                <Field label="Fecha *">
                  <input type="date" value={saldoFavorForm.fecha}
                    onChange={e => setSaldoFavorForm(f => ({ ...f, fecha: e.target.value }))}
                    style={inp} required />
                </Field>
              </div>
              <ErrorBox />
              <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end sm:items-center pt-1">
                <button type="button" onClick={closeModal} disabled={isPending} className="w-full sm:w-auto min-h-[44px]" style={btnCancel}>Cancelar</button>
                <button
                  type="submit" disabled={isPending}
                  className="w-full sm:w-auto min-h-[44px] justify-center"
                  style={{
                    ...btnSave,
                    background: isPending ? "#CBD5E1" : "linear-gradient(135deg,#059669 0%,#047857 100%)",
                    boxShadow: isPending ? "none" : "0 2px 8px rgba(5,150,105,0.3)",
                  }}
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
        <Backdrop onClose={() => !deleteLoading && setDeleteTarget(null)}>
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
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#f1f5f9", marginBottom: "4px" }}>
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
                  fontSize: "12px", color: "#E11D48", marginBottom: "14px",
                }}>
                  {deleteError}
                </div>
              )}
              <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end sm:items-center">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteLoading}
                  className="w-full sm:w-auto min-h-[44px]"
                  style={btnCancel}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEliminar}
                  disabled={deleteLoading}
                  className="w-full sm:w-auto min-h-[44px] justify-center"
                  style={{
                    ...btnSave,
                    background: deleteLoading ? "#F87171" : "#E11D48",
                    borderColor: "#E11D48",
                  }}
                >
                  {deleteLoading && <Loader2 size={14} className="animate-spin" />}
                  {deleteLoading ? "Eliminando..." : "Eliminar registro"}
                </button>
              </div>
            </div>
          </div>
        </Backdrop>
      )}
    </div>
  )
}
