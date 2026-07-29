"use client"

import { useState, useTransition, useEffect, useCallback, useMemo, Fragment } from "react"
import { useRouter } from "next/navigation"
import { crearAgente, actualizarAgente, actualizarPagaFee, type AgenteFormData } from "./actions"
import { Users, X, Loader2, MessageCircle, AlertCircle } from "lucide-react"

// ── Types ────────────────────────────────────────────
type Plan = "PRO" | "PRO+" | "B QR" | "B Ofi" | ""

interface Plan_CRM {
  tipo_plan: string
  pagado: boolean
}

export interface AgenteConPlan {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  fecha_alta: string
  fecha_mainstreet: string | null
  fecha_baja: string | null
  activo: boolean
  paga_fee: boolean | null
  tipo_plan: string | null
  plan: Plan_CRM | null
}

interface PagoMes {
  agente_id: string
  concepto: string
  monto_debe: number
  monto_pagado: number
  estado: string
}

interface Props {
  agentes: AgenteConPlan[]
  mes: number
  anio: number
  facturacionPorNombre: Record<string, number>
  pagosMes: PagoMes[]
  ofertasActivasNombre: Record<string, number>
}

// ── Helpers ──────────────────────────────────────────
type ModalState  = "none" | "nuevo" | "editar"
type SortMode    = "az" | "recientes" | "antiguos" | "facturacion"

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

const EMPTY_FORM: AgenteFormData = {
  nombre: "", email: "", telefono: "",
  fecha_alta: new Date().toISOString().split("T")[0],
  fecha_mainstreet: "",
  plan: "PRO", activo: true,
}

const PLAN_STYLES: Record<string, { bg: string; color: string }> = {
  "PRO":   { bg: "rgba(96,165,250,0.12)", color: "#60a5fa" },
  "PRO+":  { bg: "rgba(251,191,36,0.12)", color: "#fbbf24" },
  "B QR":  { bg: "rgba(74,222,128,0.12)", color: "#4ade80" },
  "B Ofi": { bg: "rgba(74,222,128,0.12)", color: "#4ade80" },
}

const PLAN_LABELS: Record<string, string> = {
  "PRO":   "PRO",
  "PRO+":  "PRO+",
  "B QR":  "B QR",
  "B Ofi": "B Ofi",
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#E31837,var(--crm-accent-hover))",
  "linear-gradient(135deg,#7C3AED,#5b21b6)",
  "linear-gradient(135deg,#0D9488,#0f766e)",
  "linear-gradient(135deg,#D97706,#b45309)",
  "linear-gradient(135deg,#2563EB,#1d4ed8)",
  "linear-gradient(135deg,var(--crm-accent),#be123c)",
  "linear-gradient(135deg,#0891B2,#0e7490)",
]

function initials(nombre: string) {
  const parts = nombre.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?"
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function fmtFecha(fechaStr: string) {
  if (!fechaStr) return "—"
  const [a, m, d] = fechaStr.split("-")
  return `${parseInt(d).toString().padStart(2,"0")}/${parseInt(m).toString().padStart(2,"0")}/${a}`
}

function fmtUSD(n: number): string {
  return `USD ${Math.round(n).toLocaleString("es-AR")}`
}

function antiguedad(fechaStr: string): string {
  if (!fechaStr) return "—"
  const alta  = new Date(fechaStr + "T00:00:00")
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const totalDias = Math.floor((today.getTime() - alta.getTime()) / 86_400_000)
  if (totalDias < 0) return "—"
  if (totalDias < 30) return `${totalDias} día${totalDias !== 1 ? "s" : ""}`

  // Complete years
  let anios = today.getFullYear() - alta.getFullYear()
  const anivEsteAnio = new Date(today.getFullYear(), alta.getMonth(), alta.getDate())
  if (anivEsteAnio > today) anios--

  if (anios >= 1) {
    const ultimoAniv = new Date(alta.getFullYear() + anios, alta.getMonth(), alta.getDate())
    const diasResto = Math.floor((today.getTime() - ultimoAniv.getTime()) / 86_400_000)
    if (diasResto === 0) return `${anios} año${anios !== 1 ? "s" : ""}`
    return `${anios} año${anios !== 1 ? "s" : ""} ${diasResto} día${diasResto !== 1 ? "s" : ""}`
  }

  // Less than 1 year: months + days
  let meses = (today.getFullYear() - alta.getFullYear()) * 12 + (today.getMonth() - alta.getMonth())
  if (today.getDate() < alta.getDate()) meses--
  if (meses < 0) meses = 0

  const inicioMes = new Date(alta)
  inicioMes.setMonth(alta.getMonth() + meses)
  const diasResto = Math.floor((today.getTime() - inicioMes.getTime()) / 86_400_000)

  if (meses === 0) return `${diasResto} día${diasResto !== 1 ? "s" : ""}`
  if (diasResto === 0) return `${meses} mes${meses !== 1 ? "es" : ""}`
  return `${meses} mes${meses !== 1 ? "es" : ""} ${diasResto} día${diasResto !== 1 ? "s" : ""}`
}

function nextMainstreetDate(fechaStr: string): Date {
  const alta  = new Date(fechaStr + "T00:00:00")
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const candidate = new Date(alta)
  candidate.setFullYear(today.getFullYear())
  if (candidate < today) candidate.setFullYear(today.getFullYear() + 1)
  return candidate
}

function getEfectivoPagaFee(ag: AgenteConPlan): boolean {
  if (ag.paga_fee !== null) return ag.paga_fee
  const diffDays = Math.floor((Date.now() - new Date(ag.fecha_alta).getTime()) / 86_400_000)
  return diffDays >= 180
}

// ── Sub-components ───────────────────────────────────
function PlanBadge({ plan }: { plan: string | null }) {
  if (!plan) return (
    <span style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)", padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, display: "inline-block" }}>
      Sin licencia
    </span>
  )
  const s = PLAN_STYLES[plan] ?? { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }
  return (
    <span style={{ ...s, padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, display: "inline-block" }}>
      {PLAN_LABELS[plan] ?? plan}
    </span>
  )
}

function EstadoBadge({ activo }: { activo: boolean }) {
  return (
    <span style={{
      background: activo ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
      color:      activo ? "#4ade80" : "#f87171",
      padding: "3px 10px", borderRadius: "20px",
      fontSize: "11px", fontWeight: 700, display: "inline-block",
    }}>
      {activo ? "Activo" : "Inactivo"}
    </span>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)",
  fontSize: "13px", fontFamily: "inherit", color: "var(--crm-text)",
  outline: "none", background: "var(--crm-input-bg)", boxSizing: "border-box",
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={{
        display: "block", fontSize: "11px", fontWeight: 700,
        letterSpacing: "0.8px", textTransform: "uppercase",
        color: "rgba(255,255,255,0.45)", marginBottom: "5px",
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────
export default function AgentesClient({
  agentes, mes, anio, facturacionPorNombre, pagosMes, ofertasActivasNombre,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [modal,         setModal]         = useState<ModalState>("none")
  const [selectedAgent, setSelectedAgent] = useState<AgenteConPlan | null>(null)
  const [form,          setForm]          = useState<AgenteFormData>(EMPTY_FORM)
  const [error,         setError]         = useState("")
  const [feeLoading,    setFeeLoading]    = useState<string | null>(null)
  const [sortMode,      setSortMode]      = useState<SortMode>("az")

  // ── Próximo Mainstreet ────────────────────────────
  const proximosMainstreet = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0)
    return agentes
      .filter(a => a.activo && a.fecha_mainstreet)
      .map(a => {
        const date = nextMainstreetDate(a.fecha_mainstreet!)
        const dias = Math.round((date.getTime() - today.getTime()) / 86400000)
        return { ...a, mainstreetDate: date, diasRestantes: dias }
      })
      .filter(a => a.diasRestantes >= 0 && a.diasRestantes <= 30)
      .sort((a, b) => a.diasRestantes - b.diasRestantes)
  }, [agentes])

  // ── Sorted agentes (activos primero, inactivos al final) ──
  const sorted = useMemo(() => {
    function applySort(arr: typeof agentes) {
      const a = [...arr]
      if (sortMode === "az")        return a.sort((x, y) => x.nombre.localeCompare(y.nombre))
      if (sortMode === "recientes") return a.sort((x, y) => y.fecha_alta.localeCompare(x.fecha_alta))
      if (sortMode === "antiguos")  return a.sort((x, y) => x.fecha_alta.localeCompare(y.fecha_alta))
      if (sortMode === "facturacion") {
        return a.sort((x, y) => {
          const fx = facturacionPorNombre[x.nombre.toLowerCase().trim()] ?? 0
          const fy = facturacionPorNombre[y.nombre.toLowerCase().trim()] ?? 0
          return fy - fx
        })
      }
      return a
    }
    return [
      ...applySort(agentes.filter(a => a.activo)),
      ...applySort(agentes.filter(a => !a.activo)),
    ]
  }, [agentes, sortMode, facturacionPorNombre])

  // ── WhatsApp reporte por agente ───────────────────
  function openWhatsApp(ag: AgenteConPlan) {
    if (!ag.telefono) return
    const k         = ag.nombre.toLowerCase().trim()
    const facturAno = facturacionPorNombre[k] ?? 0
    const ofertas   = ofertasActivasNombre[k] ?? 0
    const pagosMesAg = pagosMes.filter(p => p.agente_id === ag.id)
    const saldo = pagosMesAg.reduce((s, p) => s + Number(p.monto_debe) - Number(p.monto_pagado), 0)

    const mesLabel = MONTH_NAMES[mes - 1]

    let msg = `Hola ${ag.nombre.split(" ")[0]}! 👋\n\n`
    msg += `*Reporte ${mesLabel} ${anio}*\n\n`

    if (pagosMesAg.length > 0) {
      msg += `*Cuenta corriente del mes:*\n`
      for (const p of pagosMesAg) {
        const pendiente = Number(p.monto_debe) - Number(p.monto_pagado)
        msg += `• ${p.concepto}: ${fmtUSD(Number(p.monto_debe))}`
        if (p.estado === "Pagado") msg += ` ✅`
        else if (pendiente > 0) msg += ` — pendiente ${fmtUSD(pendiente)}`
        msg += `\n`
      }
      msg += saldo > 0
        ? `*Saldo pendiente: ${fmtUSD(saldo)}*\n\n`
        : `*✅ Al día este mes*\n\n`
    }

    if (ofertas > 0) {
      msg += `*Ofertas activas:* ${ofertas}\n\n`
    }

    if (facturAno > 0) {
      msg += `*Facturación acumulada ${anio}:* ${fmtUSD(facturAno)}\n\n`
    }

    msg = msg.trimEnd()

    const num = ag.telefono.replace(/\D/g, "")
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank")
  }

  // ── Paga FEE inline ────────────────────────────────
  function handlePagaFee(id: string, value: boolean) {
    setFeeLoading(id)
    startTransition(async () => {
      await actualizarPagaFee(id, value)
      setFeeLoading(null)
      router.refresh()
    })
  }

  // ── Modal handlers ─────────────────────────────────
  const closeModal = useCallback(() => { setModal("none"); setError("") }, [])

  function openNuevo() {
    setForm({ ...EMPTY_FORM, fecha_alta: new Date().toISOString().split("T")[0] })
    setSelectedAgent(null)
    setError("")
    setModal("nuevo")
  }

  function openEditar(ag: AgenteConPlan) {
    setSelectedAgent(ag)
    setForm({
      nombre:           ag.nombre,
      email:            ag.email    ?? "",
      telefono:         ag.telefono ?? "",
      fecha_alta:       ag.fecha_alta,
      fecha_mainstreet: ag.fecha_mainstreet ?? "",
      plan:             (ag.tipo_plan ?? "") as Plan,
      activo:           ag.activo,
    })
    setError("")
    setModal("editar")
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal() }
    if (modal !== "none") document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [modal, closeModal])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const result = modal === "nuevo"
        ? await crearAgente(form)
        : modal === "editar" && selectedAgent
          ? await actualizarAgente(selectedAgent.id, form)
          : undefined
      if (result?.error) setError(result.error)
      else { closeModal(); router.refresh() }
    })
  }

  const sortBtnStyle = (mode: SortMode): React.CSSProperties => ({
    padding: "5px 12px", borderRadius: "7px",
    fontSize: "12px", fontWeight: sortMode === mode ? 700 : 500,
    cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
    border: sortMode === mode ? "1px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.08)",
    background: sortMode === mode ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)",
    color: sortMode === mode ? "white" : "rgba(255,255,255,0.45)",
  })

  // ── RENDER ─────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Page Header ──────────────────────────── */}
      <div className="crm-page-header flex-shrink-0">
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: "var(--crm-text)", letterSpacing: "-0.3px", margin: 0 }}>
            Agentes
          </h1>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, marginTop: "1px" }}>
            Gestión del equipo REMAX Tradición · {MONTH_NAMES[mes - 1]} {anio}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Users size={14} color="#94A3B8" />
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--crm-text)" }}>
              {agentes.filter(a => a.activo).length} activos
            </span>
          </div>
          <button
            onClick={openNuevo}
            style={{
              background: "linear-gradient(135deg,#E31837 0%,var(--crm-accent-hover) 100%)",
              color: "white", border: "none",
              padding: "8px 18px", borderRadius: "9px",
              fontSize: "13px", fontWeight: 700, cursor: "pointer",
              boxShadow: "0 2px 10px rgba(227,24,55,0.35)",
              fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span> Nuevo Agente
          </button>
        </div>
      </div>

      {/* ── Scrollable content ────────────────────── */}
      <div className="flex-1 overflow-auto p-5 md:p-6">

        {/* ── Próximo Mainstreet ─────────────────── */}
        {proximosMainstreet.length > 0 && (
          <div style={{
            background: "var(--crm-surface-2)", borderRadius: "14px",
            border: "1px solid rgba(251,191,36,0.3)",
            overflow: "hidden", marginBottom: "20px",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "12px 20px", borderBottom: "1px solid rgba(251,191,36,0.15)",
              background: "rgba(251,191,36,0.08)",
            }}>
              <AlertCircle size={15} color="#D97706" />
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#fbbf24" }}>
                Próximo Mainstreet — {proximosMainstreet.length} agente{proximosMainstreet.length !== 1 ? "s" : ""} en los próximos 30 días
              </span>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "0",
            }}>
              {proximosMainstreet.map((ag, idx) => (
                <div
                  key={ag.id}
                  style={{
                    padding: "14px 18px",
                    borderRight: idx < proximosMainstreet.length - 1 ? "1px solid rgba(251,191,36,0.15)" : "none",
                    display: "flex", flexDirection: "column", gap: "4px",
                  }}
                >
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--crm-text)" }}>{ag.nombre}</div>
                  <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.45)" }}>
                    {fmtFecha(ag.mainstreetDate.toISOString().split("T")[0])}
                  </div>
                  <span style={{
                    display: "inline-block", marginTop: "2px",
                    background: ag.diasRestantes <= 7 ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.08)",
                    color: ag.diasRestantes <= 7 ? "#fbbf24" : "rgba(255,255,255,0.45)",
                    padding: "2px 8px", borderRadius: "10px",
                    fontSize: "11px", fontWeight: 700,
                    alignSelf: "flex-start",
                  }}>
                    {ag.diasRestantes === 0 ? "¡Hoy!" : `en ${ag.diasRestantes} día${ag.diasRestantes !== 1 ? "s" : ""}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tabla de agentes ─────────────────── */}
        <div style={{
          background: "var(--crm-surface-2)", borderRadius: "14px",
          border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden",
        }}>
          {/* Card header with sort filters */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
            flexWrap: "wrap", gap: "10px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E31837" }} />
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--crm-text)" }}>
                Lista de agentes
              </span>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginLeft: "4px" }}>
                {agentes.length} registrados
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.35)", marginRight: "4px" }}>ORDEN</span>
              {([
                ["az", "A→Z"],
                ["recientes", "Más recientes"],
                ["antiguos", "Más antiguos"],
                ["facturacion", "Facturación"],
              ] as [SortMode, string][]).map(([mode, label]) => (
                <button key={mode} onClick={() => setSortMode(mode)} style={sortBtnStyle(mode)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-white/[0.06]">
            {sorted.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: "13px" }}>
                No hay agentes registrados.
              </div>
            ) : (
              sorted.map((ag, i) => {
                const facturacion = facturacionPorNombre[ag.nombre.toLowerCase().trim()] ?? 0
                const isSeparator = !ag.activo && (i === 0 || sorted[i - 1].activo)
                return (
                  <Fragment key={ag.id}>
                  {isSeparator && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "8px 16px",
                      background: "rgba(255,255,255,0.02)",
                      borderTop: "1px solid rgba(255,255,255,0.08)",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                    }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.8px", color: "rgba(255,255,255,0.3)" }}>
                        Agentes inactivos
                      </span>
                      <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
                    </div>
                  )}
                  <div className="flex items-center gap-3 px-4 py-3.5" style={{ opacity: ag.activo ? 1 : 0.5 }}>
                    <div style={{
                      width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
                      background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "12px", fontWeight: 700, color: "white",
                    }}>
                      {initials(ag.nombre)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--crm-text)" }}>{ag.nombre}</div>
                      <div className="flex flex-wrap gap-1.5 mt-1 items-center">
                        <PlanBadge plan={ag.tipo_plan ?? null} />
                        <EstadoBadge activo={ag.activo} />
                        {facturacion > 0 && (
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "#4ade80" }}>{fmtUSD(facturacion)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {ag.telefono && (
                        <button
                          onClick={() => openWhatsApp(ag)}
                          style={{
                            background: "#25D366", border: "none", borderRadius: "8px",
                            width: "34px", height: "34px", display: "flex",
                            alignItems: "center", justifyContent: "center",
                            cursor: "pointer", color: "white",
                          }}
                        >
                          <MessageCircle size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => openEditar(ag)}
                        style={{
                          padding: "6px 14px", borderRadius: "7px",
                          border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
                          fontSize: "12px", fontWeight: 600, color: "var(--crm-text)",
                          cursor: "pointer", fontFamily: "inherit", minHeight: "34px",
                        }}
                      >
                        Editar
                      </button>
                    </div>
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
                <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["Nombre", "Antigüedad", "Próx. Mainstreet", "Licencia CRM", "Paga FEE", "Facturación año", "Estado", "WA", ""].map(h => (
                    <th key={h} style={{
                      padding: "10px 16px", textAlign: "left",
                      fontSize: "10.5px", fontWeight: 700,
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.8px", color: "rgba(255,255,255,0.35)",
                      whiteSpace: "nowrap",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: "13px" }}>
                      No hay agentes registrados. Hacé clic en &quot;+ Nuevo Agente&quot; para empezar.
                    </td>
                  </tr>
                ) : (
                  sorted.map((ag, i) => {
                    const facturacion = facturacionPorNombre[ag.nombre.toLowerCase().trim()] ?? 0
                    const isSeparator = !ag.activo && (i === 0 || sorted[i - 1].activo)
                    return (
                      <Fragment key={ag.id}>
                      {isSeparator && (
                        <tr>
                          <td colSpan={9} style={{ padding: 0 }}>
                            <div style={{
                              display: "flex", alignItems: "center", gap: "10px",
                              padding: "10px 16px",
                              background: "rgba(255,255,255,0.02)",
                              borderTop: "1px solid rgba(255,255,255,0.08)",
                              borderBottom: "1px solid rgba(255,255,255,0.05)",
                            }}>
                              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.8px", color: "rgba(255,255,255,0.3)" }}>
                                Agentes inactivos
                              </span>
                              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr
                        style={{ borderBottom: i === sorted.length - 1 ? "none" : "1px solid rgba(255,255,255,0.06)", opacity: ag.activo ? 1 : 0.5 }}
                        className="hover:bg-[rgba(255,255,255,0.03)]"
                      >
                        {/* Nombre con avatar */}
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{
                              width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                              background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "11px", fontWeight: 700, color: "white",
                            }}>
                              {initials(ag.nombre)}
                            </div>
                            <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--crm-text)" }}>
                              {ag.nombre}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>
                          {antiguedad(ag.fecha_alta)}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>
                          {ag.fecha_mainstreet
                            ? fmtFecha(nextMainstreetDate(ag.fecha_mainstreet).toISOString().split("T")[0])
                            : "—"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <PlanBadge plan={ag.tipo_plan ?? null} />
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <select
                            value={getEfectivoPagaFee(ag) ? "si" : "no"}
                            disabled={feeLoading === ag.id}
                            onChange={e => handlePagaFee(ag.id, e.target.value === "si")}
                            onClick={e => e.stopPropagation()}
                            style={{
                              padding: "4px 8px", borderRadius: "7px",
                              border: "1px solid rgba(255,255,255,0.1)", background: "var(--crm-input-bg)",
                              fontSize: "12px", fontWeight: 600,
                              color: getEfectivoPagaFee(ag) ? "#4ade80" : "rgba(255,255,255,0.45)",
                              cursor: "pointer", fontFamily: "inherit",
                              opacity: feeLoading === ag.id ? 0.5 : 1,
                            }}
                          >
                            <option value="si">Sí</option>
                            <option value="no">No</option>
                          </select>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap",
                          color: facturacion > 0 ? "#4ade80" : "rgba(255,255,255,0.2)" }}>
                          {facturacion > 0 ? fmtUSD(facturacion) : "—"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <EstadoBadge activo={ag.activo} />
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {ag.telefono ? (
                            <button
                              onClick={() => openWhatsApp(ag)}
                              title="Enviar reporte WhatsApp"
                              style={{
                                background: "#25D366", border: "none", borderRadius: "8px",
                                width: "30px", height: "30px", display: "flex",
                                alignItems: "center", justifyContent: "center",
                                cursor: "pointer", color: "white",
                              }}
                            >
                              <MessageCircle size={14} />
                            </button>
                          ) : (
                            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "12px" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <button
                            onClick={() => openEditar(ag)}
                            style={{
                              padding: "5px 14px", borderRadius: "7px",
                              border: "1px solid rgba(255,255,255,0.1)",
                              background: "rgba(255,255,255,0.06)", fontSize: "12px", fontWeight: 600,
                              color: "var(--crm-text)", cursor: "pointer", fontFamily: "inherit",
                            }}
                            className="hover:bg-[rgba(255,255,255,0.05)]"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── MODAL ────────────────────────────────── */}
      {modal !== "none" && (
        <div onClick={closeModal} className="crm-modal-backdrop">
          <div
            onClick={e => e.stopPropagation()}
            className="crm-modal"
            style={{ maxWidth: "480px" }}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "var(--crm-text)", margin: 0 }}>
                  {modal === "nuevo" ? "Nuevo Agente" : "Editar Agente"}
                </h2>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, marginTop: "2px" }}>
                  {modal === "nuevo"
                    ? "Completá los datos para dar de alta al agente"
                    : `Editando: ${selectedAgent?.nombre}`}
                </p>
              </div>
              <button onClick={closeModal} style={{
                background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "8px",
                width: "32px", height: "32px", display: "flex",
                alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "rgba(255,255,255,0.5)",
              }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: "20px" }}>
              <Field label="Nombre completo *">
                <input
                  type="text" value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  style={inputStyle} placeholder="Ej: Romina Prieto"
                  required autoFocus
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Email">
                  <input type="email" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    style={inputStyle} placeholder="nombre@remax.com.ar" />
                </Field>
                <Field label="Teléfono">
                  <input type="tel" value={form.telefono}
                    onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                    style={inputStyle} placeholder="+54 9 362 ..." />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Fecha de alta *">
                  <input type="date" value={form.fecha_alta}
                    onChange={e => setForm(f => ({ ...f, fecha_alta: e.target.value }))}
                    style={inputStyle} required />
                </Field>
                <Field label="Fecha Mainstreet">
                  <input type="date" value={form.fecha_mainstreet ?? ""}
                    onChange={e => setForm(f => ({ ...f, fecha_mainstreet: e.target.value || null }))}
                    style={inputStyle} />
                </Field>
              </div>
              <Field label={modal === "nuevo" ? "Plan inicial" : "Plan"}>
                <select value={form.plan}
                  onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
                  style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">Sin licencia</option>
                  <option value="PRO">PRO</option>
                  <option value="PRO+">PRO+</option>
                  <option value="B QR">B QR</option>
                  <option value="B Ofi">B Ofi</option>
                </select>
              </Field>

              {modal === "editar" && (
                <Field label="Estado del agente">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingTop: "2px" }}>
                    <button
                      type="button" role="switch" aria-checked={form.activo}
                      onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
                      style={{
                        width: "44px", height: "24px", borderRadius: "12px", border: "none",
                        background: form.activo ? "#059669" : "rgba(255,255,255,0.15)",
                        position: "relative", cursor: "pointer", transition: "background 0.2s",
                        padding: 0, flexShrink: 0,
                      }}
                    >
                      <span style={{
                        position: "absolute", top: "2px",
                        left: form.activo ? "22px" : "2px",
                        width: "20px", height: "20px",
                        borderRadius: "50%", background: "white",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        transition: "left 0.2s", display: "block",
                      }} />
                    </button>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: form.activo ? "#4ade80" : "#f87171" }}>
                      {form.activo ? "Activo" : "Inactivo — se registra fecha de baja"}
                    </span>
                  </div>
                </Field>
              )}

              {error && (
                <div style={{
                  background: "rgba(227,24,55,0.12)", border: "1px solid rgba(227,24,55,0.25)",
                  borderRadius: "8px", padding: "10px 12px",
                  fontSize: "12.5px", color: "var(--crm-accent-light)", marginBottom: "14px",
                }}>
                  ⚠️ {error}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end sm:items-center pt-1">
                <button type="button" onClick={closeModal} disabled={isPending}
                  className="w-full sm:w-auto min-h-[44px]"
                  style={{
                    padding: "9px 20px", borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
                    fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.5)",
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                  Cancelar
                </button>
                <button type="submit" disabled={isPending}
                  className="w-full sm:w-auto min-h-[44px] justify-center"
                  style={{
                    padding: "9px 24px", borderRadius: "8px", border: "none",
                    background: isPending ? "#CBD5E1" : "linear-gradient(135deg,#E31837 0%,var(--crm-accent-hover) 100%)",
                    color: "white", fontSize: "13px", fontWeight: 700,
                    cursor: isPending ? "not-allowed" : "pointer", fontFamily: "inherit",
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
    </div>
  )
}
