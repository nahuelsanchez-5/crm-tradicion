"use client"

import { useState, useMemo, useTransition, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import KpiCard from "@/components/KpiCard"
import { crearPago, actualizarPago } from "./actions"
import { DollarSign, TrendingUp, BarChart2, X, Loader2 } from "lucide-react"

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
  "Plan PRO", "Plan PRO+", "Plan B_QR", "Plan B_OFI",
  "FEE mensual", "Otro",
]

const PLAN_STYLES: Record<string, { bg: string; color: string }> = {
  PRO:   { bg: "#EFF6FF", color: "#2563EB" },
  "PRO+":{ bg: "#F5F3FF", color: "#7C3AED" },
  B_QR:  { bg: "#F0FDFA", color: "#0D9488" },
  B_OFI: { bg: "#FFFBEB", color: "#D97706" },
}

const ESTADO_STYLES: Record<string, { bg: string; color: string }> = {
  Pagado:   { bg: "#ECFDF5", color: "#059669" },
  Parcial:  { bg: "#FFFBEB", color: "#D97706" },
  Pendiente:{ bg: "#FFF1F2", color: "#E11D48" },
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

export interface AgenteSimple {
  id: string
  nombre: string
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
  if (pagado <= 0)       return "Pendiente"
  if (pagado >= debe)    return "Pagado"
  return "Parcial"
}

function extractPlan(concepto: string): string | null {
  const m = concepto.match(/PRO\+|PRO|B_QR|B_OFI/)
  return m ? m[0] : null
}

function fmtUSD(n: number): string {
  const rounded = Math.round(n * 100) / 100
  if (rounded === Math.floor(rounded)) {
    return `USD ${rounded.toLocaleString("es-AR")}`
  }
  return `USD ${rounded.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtFecha(fechaStr: string) {
  const [a, m, d] = fechaStr.split("-")
  return `${parseInt(d)} ${MONTH_NAMES[parseInt(m) - 1].slice(0, 3)} ${a}`
}

// ── Sub-components ───────────────────────────────────
function PlanBadge({ concepto }: { concepto: string }) {
  const plan = extractPlan(concepto)
  if (!plan) return <span style={{ color: "#94A3B8", fontSize: "11px" }}>—</span>
  const s = PLAN_STYLES[plan] ?? { bg: "#F1F5F9", color: "#64748B" }
  return (
    <span style={{ ...s, padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700 }}>
      {plan}
    </span>
  )
}

function EstadoBadge({ estado }: { estado: string }) {
  const s = ESTADO_STYLES[estado] ?? { bg: "#F1F5F9", color: "#64748B" }
  return (
    <span style={{ ...s, padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700 }}>
      {estado}
    </span>
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

// ── Input/Select styles ───────────────────────────────
const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  borderRadius: "8px", border: "1.5px solid #EAECF2",
  fontSize: "13px", fontFamily: "inherit",
  color: "#0F172A", outline: "none", background: "white",
  boxSizing: "border-box",
}

// ── Filter button style ──────────────────────────────
function filterBtnStyle(key: string, selected: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "5px 14px", borderRadius: "7px",
    fontSize: "12px", fontWeight: 500,
    cursor: "pointer", fontFamily: "inherit",
    transition: "all 0.15s",
  }
  if (!selected) return { ...base, border: "1.5px solid #EAECF2", background: "white", color: "#64748B" }
  const active: Record<string, React.CSSProperties> = {
    todos:    { border: "1.5px solid #0F172A",  background: "#0F172A",  color: "white" },
    Pagado:   { border: "1.5px solid #6EE7B7",  background: "#ECFDF5",  color: "#059669" },
    Parcial:  { border: "1.5px solid #FCD34D",  background: "#FFFBEB",  color: "#D97706" },
    Pendiente:{ border: "1.5px solid #FECDD3",  background: "#FFF1F2",  color: "#E11D48" },
  }
  return { ...base, fontWeight: 700, ...(active[key] ?? active.todos) }
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
interface Props {
  pagos: PagoRow[]
  agentes: AgenteSimple[]
}

export default function PagosClient({ pagos, agentes }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Filters ────────────────────────────────────────
  const [selectedEstado, setSelectedEstado] = useState("todos")
  const [selectedMonth, setSelectedMonth]   = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })

  // ── Modal ──────────────────────────────────────────
  type ModalT = "none" | "nuevo" | "editar"
  const [modal,        setModal]        = useState<ModalT>("none")
  const [selectedPago, setSelectedPago] = useState<PagoRow | null>(null)
  const [error,        setError]        = useState("")

  // ── Forms ──────────────────────────────────────────
  const todayStr = new Date().toISOString().split("T")[0]

  const [nuevoForm, setNuevoForm] = useState<NuevoForm>({
    agente_id:    agentes[0]?.id ?? "",
    concepto:     CONCEPTOS[0],
    monto_debe:   "",
    monto_pagado: "0",
    fecha:        todayStr,
  })

  const [editForm, setEditForm] = useState<EditForm>({ monto_pagado: "0" })

  // ── Computed ───────────────────────────────────────
  const filteredPagos = useMemo(() => {
    return pagos.filter(p => {
      if (selectedMonth !== "todos") {
        if (p.fecha.substring(0, 7) !== selectedMonth) return false
      }
      if (selectedEstado !== "todos" && p.estado !== selectedEstado) return false
      return true
    })
  }, [pagos, selectedMonth, selectedEstado])

  const stats = useMemo(() => {
    const totalDebe    = filteredPagos.reduce((s, p) => s + Number(p.monto_debe), 0)
    const totalCobrado = filteredPagos.reduce((s, p) => s + Number(p.monto_pagado), 0)
    const totalSaldo   = filteredPagos.reduce((s, p) =>
      s + Math.max(0, Number(p.monto_debe) - Number(p.monto_pagado)), 0)
    const pct = totalDebe > 0 ? Math.round((totalCobrado / totalDebe) * 100) : 100
    return { totalCobrado, totalSaldo, pct, totalDebe }
  }, [filteredPagos])

  // Estado calculado en tiempo real para nuevo pago
  const nuevoEstado = useMemo(() => {
    const debe   = parseFloat(nuevoForm.monto_debe)   || 0
    const pagado = parseFloat(nuevoForm.monto_pagado) || 0
    return calcEstado(debe, pagado)
  }, [nuevoForm.monto_debe, nuevoForm.monto_pagado])

  // Estado calculado en tiempo real para editar
  const editEstado = useMemo(() => {
    if (!selectedPago) return "Pendiente"
    const pagado = parseFloat(editForm.monto_pagado) || 0
    return calcEstado(Number(selectedPago.monto_debe), pagado)
  }, [selectedPago, editForm.monto_pagado])

  // ── Keyboard ───────────────────────────────────────
  const closeModal = useCallback(() => { setModal("none"); setError("") }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal() }
    if (modal !== "none") document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [modal, closeModal])

  // ── Open modals ────────────────────────────────────
  function openNuevo() {
    setNuevoForm({
      agente_id:    agentes[0]?.id ?? "",
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

  // ── Submit handlers ────────────────────────────────
  function handleNuevo(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const debe   = parseFloat(nuevoForm.monto_debe)   || 0
    const pagado = parseFloat(nuevoForm.monto_pagado) || 0
    if (debe <= 0) { setError("El monto que debe ser mayor a 0"); return }

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

  // ── Shared modal shell ─────────────────────────────
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
            Pagos
          </h1>
          <p style={{ fontSize: "12px", color: "#64748B", margin: 0, marginTop: "1px" }}>
            Control de planes CRM y deudas del equipo
          </p>
        </div>
        <button
          onClick={openNuevo}
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

        {/* ── KPI Cards (3 cols) ─────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px", marginBottom: "20px" }}>
          <KpiCard
            title="Total cobrado"
            value={fmtUSD(stats.totalCobrado)}
            badge={`de ${fmtUSD(stats.totalDebe)}`}
            gradient="linear-gradient(135deg,#0D9488 0%,#0F766E 100%)"
            shadowColor="rgba(13,148,136,0.3)"
            icon={<DollarSign size={20} color="white" />}
          />
          <KpiCard
            title="Total pendiente"
            value={fmtUSD(stats.totalSaldo)}
            badge={`${filteredPagos.filter(p => p.estado !== "Pagado").length} registros`}
            gradient="linear-gradient(135deg,#D97706 0%,#B45309 100%)"
            shadowColor="rgba(217,119,6,0.3)"
            icon={<TrendingUp size={20} color="white" />}
          />
          <KpiCard
            title="% Cobranza"
            value={`${stats.pct}%`}
            badge={stats.pct >= 80 ? "✓ Buen rendimiento" : "Por mejorar"}
            gradient={
              stats.pct >= 80
                ? "linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)"
                : "linear-gradient(135deg,#E31837 0%,#9B0F26 100%)"
            }
            shadowColor={stats.pct >= 80 ? "rgba(124,58,237,0.3)" : "rgba(227,24,55,0.3)"}
            icon={<BarChart2 size={20} color="white" />}
          />
        </div>

        {/* ── Filtros ──────────────────────────────── */}
        <div style={{
          ...cardStyle,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 18px", marginBottom: "16px",
          overflow: "visible",
        }}>
          {/* Status filter */}
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

          {/* Month filter */}
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
              {filteredPagos.length} registro{filteredPagos.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* ── Tabla ────────────────────────────────── */}
        <div style={cardStyle}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 20px", borderBottom: "1px solid #EAECF2",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E31837" }} />
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
                Historial de pagos
              </span>
            </div>
            {filteredPagos.length === 0 && (
              <span style={{ fontSize: "12px", color: "#94A3B8" }}>Sin resultados para este filtro</span>
            )}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8F9FC", borderBottom: "1px solid #EAECF2" }}>
                  {["Agente", "Plan", "Concepto", "Fecha", "Debe", "Pagado", "Saldo", "Estado", ""].map(h => (
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
                {filteredPagos.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>
                      No hay registros para el filtro seleccionado.
                    </td>
                  </tr>
                ) : (
                  filteredPagos.map((p, i) => {
                    const saldo   = Math.max(0, Number(p.monto_debe) - Number(p.monto_pagado))
                    const nombre  = (p.agentes as { nombre: string } | null)?.nombre ?? "—"
                    const isLast  = i === filteredPagos.length - 1
                    return (
                      <tr
                        key={p.id}
                        style={{ borderBottom: isLast ? "none" : "1px solid #F3F4F6" }}
                        className="hover:bg-[#FAFBFF]"
                      >
                        <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: "13px", color: "#0F172A", whiteSpace: "nowrap" }}>
                          {nombre}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <PlanBadge concepto={p.concepto} />
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "12px", color: "#64748B", maxWidth: "180px" }}>
                          <span title={p.concepto} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.concepto}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "12px", color: "#64748B", whiteSpace: "nowrap" }}>
                          {fmtFecha(p.fecha)}
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: "13px", color: "#0F172A", whiteSpace: "nowrap" }}>
                          {fmtUSD(Number(p.monto_debe))}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", color: "#059669", fontWeight: 600, whiteSpace: "nowrap" }}>
                          {fmtUSD(Number(p.monto_pagado))}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap",
                          color: saldo > 0 ? "#E11D48" : "#059669" }}>
                          {saldo > 0 ? fmtUSD(saldo) : "—"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <EstadoBadge estado={p.estado} />
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {p.estado !== "Pagado" && (
                            <button
                              onClick={() => openEditar(p)}
                              style={{
                                padding: "5px 14px", borderRadius: "7px",
                                border: "1.5px solid #EAECF2", background: "white",
                                fontSize: "12px", fontWeight: 600, color: "#0F172A",
                                cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                              }}
                              className="hover:bg-[#F8F9FC]"
                            >
                              Registrar pago
                            </button>
                          )}
                        </td>
                      </tr>
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
            {/* Header */}
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
              {/* Agente */}
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

              {/* Concepto + Fecha */}
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

              {/* Montos */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Monto que debe (USD) *">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="15000"
                    value={nuevoForm.monto_debe}
                    onChange={e => setNuevoForm(f => ({ ...f, monto_debe: e.target.value }))}
                    style={inp}
                    required
                  />
                </Field>
                <Field label="Monto pagado (USD)">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="0"
                    value={nuevoForm.monto_pagado}
                    onChange={e => setNuevoForm(f => ({ ...f, monto_pagado: e.target.value }))}
                    style={inp}
                  />
                </Field>
              </div>

              {/* Estado calculado */}
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
          MODAL — REGISTRAR PAGO PARCIAL (EDITAR)
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
            {/* Header */}
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
              {/* Info readonly */}
              <ReadOnlyField
                label="Agente"
                value={(selectedPago.agentes as { nombre: string } | null)?.nombre ?? "—"}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <ReadOnlyField label="Concepto" value={selectedPago.concepto} />
                <ReadOnlyField label="Monto que debe" value={fmtUSD(Number(selectedPago.monto_debe))} />
              </div>

              {/* Monto pagado editable */}
              <Field label="Nuevo monto pagado total (USD) *">
                <input
                  type="number"
                  min="0"
                  max={Number(selectedPago.monto_debe)}
                  step="100"
                  value={editForm.monto_pagado}
                  onChange={e => setEditForm({ monto_pagado: e.target.value })}
                  style={inp}
                  required
                  autoFocus
                />
              </Field>

              {/* Estado calculado en tiempo real */}
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
