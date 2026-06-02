"use client"

import { useState, useMemo, useTransition, useEffect, useCallback, Fragment } from "react"
import { useRouter } from "next/navigation"
import { crearPago, actualizarPago } from "./actions"
import { DollarSign, BarChart2, X, Loader2, MessageCircle } from "lucide-react"

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

const CONCEPTOS = [
  "FEE mensual",
  "Licencias CRM",
  "Mainstreet",
  "Otros",
]

const ESTADO_STYLES: Record<string, { bg: string; color: string }> = {
  Pagado:    { bg: "#ECFDF5", color: "#059669" },
  Parcial:   { bg: "#FFFBEB", color: "#D97706" },
  Pendiente: { bg: "#FFF1F2", color: "#E11D48" },
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
}

interface NuevoForm {
  agente_id: string
  concepto: string
  monto_debe: string
  monto_pagado: string
  fecha: string
}

interface EditForm {
  monto_pagado: string
}

// ── Helpers ──────────────────────────────────────────
function calcEstado(debe: number, pagado: number): string {
  if (pagado <= 0)    return "Pendiente"
  if (pagado >= debe) return "Pagado"
  return "Parcial"
}

function calcEstadoGeneral(totalDebe: number, totalPagado: number): string {
  if (totalDebe <= 0)          return "Pagado"
  if (totalPagado <= 0)        return "Pendiente"
  if (totalPagado >= totalDebe) return "Pagado"
  return "Parcial"
}

function getConceptGroup(concepto: string): "FEE" | "CRM" | "Mainstreet" | "Otros" {
  const c = concepto.toLowerCase()
  if (c.includes("fee"))                                        return "FEE"
  if (c.includes("pro") || c.includes("crm") || c.includes("plan") || c.includes("licencia")) return "CRM"
  if (c.includes("mainstreet"))                                 return "Mainstreet"
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
  const s = ESTADO_STYLES[estado] ?? { bg: "#F1F5F9", color: "#64748B" }
  return (
    <span style={{ ...s, padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700 }}>
      {estado}
    </span>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "#059669" : pct >= 50 ? "#D97706" : "#E11D48"
  return (
    <div style={{ width: "100%", height: "5px", borderRadius: "3px", background: "#F1F5F9", overflow: "hidden", marginTop: "6px" }}>
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
        color: "#64748B", marginBottom: "5px",
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
        border: "1.5px solid #F1F5F9", background: "#F8F9FC",
        fontSize: "13px", color: "#64748B",
      }}>
        {value}
      </div>
    </Field>
  )
}

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  borderRadius: "8px", border: "1.5px solid #EAECF2",
  fontSize: "13px", fontFamily: "inherit",
  color: "#0F172A", outline: "none", background: "white",
  boxSizing: "border-box",
}

function filterBtnStyle(key: string, selected: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "5px 14px", borderRadius: "7px",
    fontSize: "12px", fontWeight: 500,
    cursor: "pointer", fontFamily: "inherit",
    transition: "all 0.15s",
  }
  if (!selected) return { ...base, border: "1.5px solid #EAECF2", background: "white", color: "#64748B" }
  const active: Record<string, React.CSSProperties> = {
    todos:     { border: "1.5px solid #0F172A",  background: "#0F172A",  color: "white" },
    Pagado:    { border: "1.5px solid #6EE7B7",  background: "#ECFDF5",  color: "#059669" },
    Parcial:   { border: "1.5px solid #FCD34D",  background: "#FFFBEB",  color: "#D97706" },
    Pendiente: { border: "1.5px solid #FECDD3",  background: "#FFF1F2",  color: "#E11D48" },
  }
  return { ...base, fontWeight: 700, ...(active[key] ?? active.todos) }
}

// ── KPI box component ────────────────────────────────
function KpiConcepto({
  label, x, y, pct, color, gradient,
}: {
  label: string; x: number; y?: number; pct?: number; color: string; gradient: string
}) {
  return (
    <div style={{
      background: gradient, borderRadius: "14px",
      padding: "16px 18px", color: "white",
      boxShadow: `0 6px 20px ${color}55`,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: "-15px", right: "-15px", width: "80px", height: "80px",
        borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
      <div style={{ fontSize: "11px", fontWeight: 600, opacity: 0.8, marginBottom: "6px",
        textTransform: "uppercase" as const, letterSpacing: "0.6px" }}>
        {label}
      </div>
      <div style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1 }}>
        {y !== undefined ? `${x}/${y}` : String(x)}
        <span style={{ fontSize: "14px", fontWeight: 500, opacity: 0.75, marginLeft: "4px" }}>cobrados</span>
      </div>
      {pct !== undefined && (
        <>
          <ProgressBar pct={pct} />
          <div style={{ fontSize: "12px", fontWeight: 700, marginTop: "4px", opacity: 0.9 }}>
            {pct}% cobranza
          </div>
        </>
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
  mensajeWhatsapp: string
}

export default function PagosClient({ pagos, agentes, mensajeWhatsapp }: Props) {
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
  type ModalT = "none" | "nuevo" | "editar"
  const [modal,        setModal]        = useState<ModalT>("none")
  const [selectedPago, setSelectedPago] = useState<PagoRow | null>(null)
  const [error,        setError]        = useState("")

  const todayStr = new Date().toISOString().split("T")[0]

  const [nuevoForm, setNuevoForm] = useState<NuevoForm>({
    agente_id:    agentes[0]?.id ?? "",
    concepto:     CONCEPTOS[0],
    monto_debe:   "",
    monto_pagado: "0",
    fecha:        todayStr,
  })

  const [editForm, setEditForm] = useState<EditForm>({ monto_pagado: "0" })

  // ── Computed: KPI stats ────────────────────────────
  const kpiStats = useMemo(() => {
    const monthPagos = pagos.filter(p =>
      selectedMonth === "todos" || p.fecha.startsWith(selectedMonth)
    )

    const agentesActivos    = agentes.filter(a => a.activo)
    const agentesActivosCount = agentesActivos.length
    const agentesFeeCount   = agentes.filter(a => a.paga_fee === true).length

    // FEE
    const feePagos  = monthPagos.filter(p => getConceptGroup(p.concepto) === "FEE")
    const feeCobrX  = new Set(feePagos.filter(p => p.estado === "Pagado").map(p => p.agente_id)).size
    const feePct    = agentesFeeCount > 0 ? Math.round((feeCobrX / agentesFeeCount) * 100) : 0

    // CRM
    const crmPagos  = monthPagos.filter(p => getConceptGroup(p.concepto) === "CRM")
    const crmCobrX  = new Set(crmPagos.filter(p => p.estado === "Pagado").map(p => p.agente_id)).size
    const crmPct    = agentesActivosCount > 0 ? Math.round((crmCobrX / agentesActivosCount) * 100) : 0

    // Mainstreet
    const mainPagos = monthPagos.filter(p => getConceptGroup(p.concepto) === "Mainstreet")
    const mainCobrX = new Set(mainPagos.filter(p => p.estado === "Pagado").map(p => p.agente_id)).size
    const mainPct   = agentesActivosCount > 0 ? Math.round((mainCobrX / agentesActivosCount) * 100) : 0

    // Otros
    const otrosPagos  = monthPagos.filter(p => getConceptGroup(p.concepto) === "Otros")
    const otrosCobrX  = otrosPagos.filter(p => p.estado === "Pagado").length

    const pctGeneral  = Math.round((feePct + crmPct + mainPct) / 3)

    return {
      feeCobrX, feeTotal: agentesFeeCount, feePct,
      crmCobrX, crmTotal: agentesActivosCount, crmPct,
      mainCobrX, mainTotal: agentesActivosCount, mainPct,
      otrosCobrX, pctGeneral,
    }
  }, [pagos, agentes, selectedMonth])

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

  // ── Real-time form estado ──────────────────────────
  const nuevoEstado = useMemo(() => {
    return calcEstado(parseFloat(nuevoForm.monto_debe) || 0, parseFloat(nuevoForm.monto_pagado) || 0)
  }, [nuevoForm.monto_debe, nuevoForm.monto_pagado])

  const editEstado = useMemo(() => {
    if (!selectedPago) return "Pendiente"
    return calcEstado(Number(selectedPago.monto_debe), parseFloat(editForm.monto_pagado) || 0)
  }, [selectedPago, editForm.monto_pagado])

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
      concepto:     CONCEPTOS[0],
      monto_debe:   "",
      monto_pagado: "0",
      fecha:        todayStr,
    })
    setError("")
    setModal("nuevo")
  }

  function openEditar(p: PagoRow) {
    setSelectedPago(p)
    setEditForm({ monto_pagado: String(Number(p.monto_pagado)) })
    setError("")
    setModal("editar")
  }

  // ── WhatsApp ───────────────────────────────────────
  function openWhatsApp(nombre: string, telefono: string | null, saldo: number) {
    if (!telefono) return
    const mes  = mesLabel(selectedMonth)
    const msg  = mensajeWhatsapp
      .replace(/\[nombre\]/g, nombre)
      .replace(/\[monto\]/g,  fmtUSD(saldo).replace("USD ", ""))
      .replace(/\[mes\]/g,    mes)
    const num  = telefono.replace(/\D/g, "")
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank")
  }

  // ── Submit handlers ────────────────────────────────
  function handleNuevo(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const debe   = parseFloat(nuevoForm.monto_debe)   || 0
    const pagado = parseFloat(nuevoForm.monto_pagado) || 0
    if (debe <= 0) { setError("El monto debe ser mayor a 0"); return }

    startTransition(async () => {
      const result = await crearPago({
        agente_id:    nuevoForm.agente_id,
        fecha:        nuevoForm.fecha,
        concepto:     nuevoForm.concepto,
        monto_debe:   debe,
        monto_pagado: pagado,
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

  const cardStyle: React.CSSProperties = {
    background: "white", borderRadius: "14px",
    border: "1.5px solid #EAECF2", overflow: "hidden",
  }

  // ═══════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Page Header ──────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        minHeight: "62px", padding: "0 24px",
        background: "white", borderBottom: "1px solid #EAECF2", flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", letterSpacing: "-0.3px", margin: 0 }}>
            Cuentas
          </h1>
          <p style={{ fontSize: "12px", color: "#64748B", margin: 0, marginTop: "1px" }}>
            Control de cobros por concepto — REMAX Tradición
          </p>
        </div>
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

      {/* ── Scrollable content ────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>

        {/* ── KPI boxes (4 conceptos) ───────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px", marginBottom: "20px" }}>
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
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#0F172A" }}>
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
                border: "1.5px solid #EAECF2", fontSize: "12.5px",
                fontWeight: 500, color: "#0F172A", background: "white",
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
            padding: "14px 20px", borderBottom: "1px solid #EAECF2",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E31837" }} />
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
                Estado de cobros por agente
              </span>
            </div>
            {agentesPagos.length === 0 && (
              <span style={{ fontSize: "12px", color: "#94A3B8" }}>Sin resultados</span>
            )}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8F9FC", borderBottom: "1px solid #EAECF2" }}>
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
                    const isLast     = i === agentesPagos.length - 1 && !isExpanded
                    return (
                      <Fragment key={ag.agente_id}>
                        {/* ── Main row ── */}
                        <tr
                          onClick={() => setExpandedAgent(isExpanded ? null : ag.agente_id)}
                          style={{
                            borderBottom: (isLast && !isExpanded) ? "none" : "1px solid #F3F4F6",
                            cursor: "pointer",
                            background: isExpanded ? "#FAFBFF" : "white",
                            transition: "background 0.1s",
                          }}
                        >
                          <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: "13px", color: "#0F172A", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{
                                fontSize: "11px", color: "#64748B", fontWeight: 400,
                                transform: isExpanded ? "rotate(90deg)" : "none",
                                display: "inline-block", transition: "transform 0.15s",
                              }}>▶</span>
                              {ag.nombre}
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: "12px", color: "#64748B", whiteSpace: "nowrap" }}>
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
                                onClick={e => { e.stopPropagation(); openWhatsApp(ag.nombre, ag.telefono, ag.saldo) }}
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
                                  border: "1.5px solid #EAECF2", background: "white",
                                  fontSize: "12px", fontWeight: 600, color: "#0F172A",
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
                          <tr style={{ borderBottom: isLast ? "none" : "1px solid #F3F4F6" }}>
                            <td colSpan={6} style={{ padding: 0 }}>
                              <div style={{
                                background: "#F8FAFF", borderTop: "1px solid #EEF0F8",
                                padding: "16px 24px",
                              }}>
                                {/* Summary strip */}
                                <div style={{
                                  display: "flex", gap: "20px", marginBottom: "12px",
                                  fontSize: "12.5px",
                                }}>
                                  <span>
                                    <span style={{ color: "#64748B" }}>Total pagado: </span>
                                    <strong style={{ color: "#059669" }}>{fmtUSD(ag.totalPagado)}</strong>
                                  </span>
                                  <span>
                                    <span style={{ color: "#64748B" }}>Total pendiente: </span>
                                    <strong style={{ color: "#E11D48" }}>{fmtUSD(Math.max(0, ag.saldo))}</strong>
                                  </span>
                                  <span>
                                    <span style={{ color: "#64748B" }}>Estado: </span>
                                    <EstadoBadge estado={ag.estadoGral} />
                                  </span>
                                </div>

                                {/* Movement detail */}
                                <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: "10px", overflow: "hidden", border: "1px solid #EAECF2" }}>
                                  <thead>
                                    <tr style={{ background: "#F1F5F9" }}>
                                      {["Fecha", "Concepto", "Debe", "Pagado", "Estado", ""].map(h => (
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
                                    {ag.pagos.map((p, pi) => (
                                      <tr key={p.id} style={{ borderTop: pi > 0 ? "1px solid #F3F4F6" : "none" }}>
                                        <td style={{ padding: "10px 14px", fontSize: "12px", color: "#64748B", whiteSpace: "nowrap" }}>
                                          {fmtFecha(p.fecha)}
                                        </td>
                                        <td style={{ padding: "10px 14px", fontSize: "12px", color: "#0F172A" }}>
                                          {p.concepto}
                                        </td>
                                        <td style={{ padding: "10px 14px", fontSize: "12px", fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap" }}>
                                          {fmtUSD(Number(p.monto_debe))}
                                        </td>
                                        <td style={{ padding: "10px 14px", fontSize: "12px", color: "#059669", fontWeight: 600, whiteSpace: "nowrap" }}>
                                          {fmtUSD(Number(p.monto_pagado))}
                                        </td>
                                        <td style={{ padding: "10px 14px" }}>
                                          <EstadoBadge estado={p.estado} />
                                        </td>
                                        <td style={{ padding: "10px 14px" }}>
                                          {p.estado !== "Pagado" && (
                                            <button
                                              onClick={() => openEditar(p)}
                                              style={{
                                                padding: "3px 10px", borderRadius: "6px",
                                                border: "1.5px solid #EAECF2", background: "white",
                                                fontSize: "11px", fontWeight: 600, color: "#0F172A",
                                                cursor: "pointer", fontFamily: "inherit",
                                              }}
                                            >
                                              Editar
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
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
        <div
          onClick={closeModal}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: "20px",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "white", borderRadius: "16px",
              width: "100%", maxWidth: "500px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden",
            }}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "18px 20px", borderBottom: "1px solid #EAECF2",
            }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                  Registrar Pago
                </h2>
                <p style={{ fontSize: "12px", color: "#64748B", margin: 0, marginTop: "2px" }}>
                  Nuevo registro en el historial de pagos
                </p>
              </div>
              <button onClick={closeModal} style={{
                background: "#F8F9FC", border: "none", borderRadius: "8px",
                width: "32px", height: "32px", display: "flex",
                alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#64748B",
              }}>
                <X size={16} />
              </button>
            </div>

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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Concepto *">
                  <select
                    value={nuevoForm.concepto}
                    onChange={e => setNuevoForm(f => ({ ...f, concepto: e.target.value }))}
                    style={inp}
                    required
                  >
                    {CONCEPTOS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Fecha *">
                  <input
                    type="date"
                    value={nuevoForm.fecha}
                    onChange={e => setNuevoForm(f => ({ ...f, fecha: e.target.value }))}
                    style={inp}
                    required
                  />
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Monto que debe (USD) *">
                  <input
                    type="number" min="0" step="0.01" placeholder="95.25"
                    value={nuevoForm.monto_debe}
                    onChange={e => setNuevoForm(f => ({ ...f, monto_debe: e.target.value }))}
                    style={inp}
                    required
                  />
                </Field>
                <Field label="Monto pagado (USD)">
                  <input
                    type="number" min="0" step="0.01" placeholder="0"
                    value={nuevoForm.monto_pagado}
                    onChange={e => setNuevoForm(f => ({ ...f, monto_pagado: e.target.value }))}
                    style={inp}
                  />
                </Field>
              </div>

              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 12px", borderRadius: "8px",
                background: "#F8F9FC", border: "1px solid #EAECF2",
                marginBottom: "14px",
              }}>
                <span style={{ fontSize: "12px", color: "#64748B", fontWeight: 500 }}>
                  Estado calculado:
                </span>
                <EstadoBadge estado={nuevoEstado} />
              </div>

              {error && (
                <div style={{
                  background: "#FFF1F2", border: "1px solid #FECDD3",
                  borderRadius: "8px", padding: "10px 12px",
                  fontSize: "12.5px", color: "#E11D48", marginBottom: "14px",
                }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={closeModal} disabled={isPending}
                  style={{
                    padding: "9px 20px", borderRadius: "8px",
                    border: "1.5px solid #EAECF2", background: "white",
                    fontSize: "13px", fontWeight: 600, color: "#64748B",
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                  Cancelar
                </button>
                <button type="submit" disabled={isPending}
                  style={{
                    padding: "9px 24px", borderRadius: "8px", border: "none",
                    background: isPending ? "#CBD5E1" : "linear-gradient(135deg,#E31837 0%,#c0122d 100%)",
                    color: "white", fontSize: "13px", fontWeight: 700,
                    cursor: isPending ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: "6px",
                    boxShadow: isPending ? "none" : "0 2px 8px rgba(227,24,55,0.3)",
                  }}>
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  {isPending ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          MODAL — EDITAR PAGO
      ════════════════════════════════════════════ */}
      {modal === "editar" && selectedPago && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: "20px",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "white", borderRadius: "16px",
              width: "100%", maxWidth: "440px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden",
            }}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "18px 20px", borderBottom: "1px solid #EAECF2",
            }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                  Registrar Pago Parcial
                </h2>
                <p style={{ fontSize: "12px", color: "#64748B", margin: 0, marginTop: "2px" }}>
                  Actualizá el monto abonado
                </p>
              </div>
              <button onClick={closeModal} style={{
                background: "#F8F9FC", border: "none", borderRadius: "8px",
                width: "32px", height: "32px", display: "flex",
                alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#64748B",
              }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditar} style={{ padding: "20px" }}>
              <ReadOnlyField
                label="Agente"
                value={(selectedPago.agentes as { nombre: string } | null)?.nombre ?? "—"}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <ReadOnlyField label="Concepto" value={selectedPago.concepto} />
                <ReadOnlyField label="Monto que debe" value={fmtUSD(Number(selectedPago.monto_debe))} />
              </div>

              <Field label="Nuevo monto pagado total (USD) *">
                <input
                  type="number" min="0" max={Number(selectedPago.monto_debe)} step="0.01"
                  value={editForm.monto_pagado}
                  onChange={e => setEditForm({ monto_pagado: e.target.value })}
                  style={inp}
                  required
                  autoFocus
                />
              </Field>

              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 12px", borderRadius: "8px",
                background: "#F8F9FC", border: "1px solid #EAECF2",
                marginBottom: "14px",
              }}>
                <span style={{ fontSize: "12px", color: "#64748B", fontWeight: 500 }}>
                  Nuevo estado:
                </span>
                <EstadoBadge estado={editEstado} />
                <span style={{ marginLeft: "auto", fontSize: "12px", color: "#64748B" }}>
                  Saldo: <strong style={{ color: editEstado === "Pagado" ? "#059669" : "#E11D48" }}>
                    {fmtUSD(Math.max(0, Number(selectedPago.monto_debe) - (parseFloat(editForm.monto_pagado) || 0)))}
                  </strong>
                </span>
              </div>

              {error && (
                <div style={{
                  background: "#FFF1F2", border: "1px solid #FECDD3",
                  borderRadius: "8px", padding: "10px 12px",
                  fontSize: "12.5px", color: "#E11D48", marginBottom: "14px",
                }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={closeModal} disabled={isPending}
                  style={{
                    padding: "9px 20px", borderRadius: "8px",
                    border: "1.5px solid #EAECF2", background: "white",
                    fontSize: "13px", fontWeight: 600, color: "#64748B",
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                  Cancelar
                </button>
                <button type="submit" disabled={isPending}
                  style={{
                    padding: "9px 24px", borderRadius: "8px", border: "none",
                    background: isPending ? "#CBD5E1" : "linear-gradient(135deg,#E31837 0%,#c0122d 100%)",
                    color: "white", fontSize: "13px", fontWeight: 700,
                    cursor: isPending ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: "6px",
                    boxShadow: isPending ? "none" : "0 2px 8px rgba(227,24,55,0.3)",
                  }}>
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  {isPending ? "Guardando..." : "Actualizar pago"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
