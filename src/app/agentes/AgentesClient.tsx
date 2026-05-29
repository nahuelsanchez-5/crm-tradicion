"use client"

import { useState, useTransition, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import KpiCard from "@/components/KpiCard"
import { crearAgente, actualizarAgente, actualizarPagaFee, type AgenteFormData } from "./actions"
import { Users, Star, CheckCircle, Clock, X, Loader2 } from "lucide-react"

// ── Types ────────────────────────────────────────────
type Plan = "PRO" | "PRO+" | "B_QR" | "B_OFI"

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
  fecha_baja: string | null
  activo: boolean
  paga_fee: boolean | null
  plan: Plan_CRM | null
}

interface Props {
  agentes: AgenteConPlan[]
  mes: number
  anio: number
}

// ── Helpers ──────────────────────────────────────────
type ModalState = "none" | "nuevo" | "editar"

const EMPTY_FORM: AgenteFormData = {
  nombre: "", email: "", telefono: "",
  fecha_alta: new Date().toISOString().split("T")[0],
  plan: "PRO", activo: true,
}

const PLAN_STYLES: Record<string, { bg: string; color: string }> = {
  "PRO":   { bg: "#EFF6FF", color: "#2563EB" },
  "PRO+":  { bg: "#F5F3FF", color: "#7C3AED" },
  "B_QR":  { bg: "#F0FDFA", color: "#0D9488" },
  "B_OFI": { bg: "#FFFBEB", color: "#D97706" },
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#E31837,#c0122d)",
  "linear-gradient(135deg,#7C3AED,#5b21b6)",
  "linear-gradient(135deg,#0D9488,#0f766e)",
  "linear-gradient(135deg,#D97706,#b45309)",
  "linear-gradient(135deg,#2563EB,#1d4ed8)",
  "linear-gradient(135deg,#E11D48,#be123c)",
  "linear-gradient(135deg,#0891B2,#0e7490)",
]

function initials(nombre: string) {
  const parts = nombre.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?"
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function fmtFecha(fechaStr: string) {
  const [a, m, d] = fechaStr.split("-")
  return `${parseInt(d)}/${parseInt(m)}/${a}`
}

function getEfectivoPagaFee(ag: AgenteConPlan): boolean {
  if (ag.paga_fee !== null) return ag.paga_fee
  const diffDays = Math.floor((Date.now() - new Date(ag.fecha_alta).getTime()) / 86_400_000)
  return diffDays >= 180
}

// ── Sub-components ───────────────────────────────────
function PlanBadge({ plan }: { plan: string | null }) {
  if (!plan) {
    return (
      <span style={{ color: "#94A3B8", fontSize: "11px", fontStyle: "italic" }}>
        Sin plan
      </span>
    )
  }
  const s = PLAN_STYLES[plan] ?? { bg: "#F1F5F9", color: "#64748B" }
  return (
    <span style={{
      ...s, padding: "3px 10px", borderRadius: "20px",
      fontSize: "11px", fontWeight: 700, display: "inline-block",
    }}>
      {plan}
    </span>
  )
}

function EstadoBadge({ activo }: { activo: boolean }) {
  return (
    <span style={{
      background: activo ? "#ECFDF5" : "#FFF1F2",
      color:      activo ? "#059669" : "#E11D48",
      padding: "3px 10px", borderRadius: "20px",
      fontSize: "11px", fontWeight: 700, display: "inline-block",
    }}>
      {activo ? "Activo" : "Inactivo"}
    </span>
  )
}

// ── LABEL + INPUT helper ─────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  borderRadius: "8px", border: "1.5px solid #EAECF2",
  fontSize: "13px", fontFamily: "inherit", color: "#0F172A",
  outline: "none", background: "white", boxSizing: "border-box",
}

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" }

function Field({
  label, children,
}: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={{
        display: "block", fontSize: "11px", fontWeight: 700,
        letterSpacing: "0.8px", textTransform: "uppercase",
        color: "#64748B", marginBottom: "5px",
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
export default function AgentesClient({ agentes, mes, anio }: Props) {
  const router   = useRouter()
  const [isPending, startTransition] = useTransition()

  const [modal,         setModal]         = useState<ModalState>("none")
  const [selectedAgent, setSelectedAgent] = useState<AgenteConPlan | null>(null)
  const [form,          setForm]          = useState<AgenteFormData>(EMPTY_FORM)
  const [error,         setError]         = useState("")
  const [feeLoading,    setFeeLoading]    = useState<string | null>(null)

  // ── Stats ──────────────────────────────────────────
  const totalActivos  = agentes.filter(a => a.activo).length
  const conPlan       = agentes.filter(a => a.plan !== null).length
  const pagados       = agentes.filter(a => a.plan?.pagado === true).length
  const pendientes    = agentes.filter(a => a.plan !== null && !a.plan.pagado).length

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
  const closeModal = useCallback(() => {
    setModal("none")
    setError("")
  }, [])

  function openNuevo() {
    setForm({ ...EMPTY_FORM, fecha_alta: new Date().toISOString().split("T")[0] })
    setSelectedAgent(null)
    setError("")
    setModal("nuevo")
  }

  function openEditar(ag: AgenteConPlan) {
    setSelectedAgent(ag)
    setForm({
      nombre:     ag.nombre,
      email:      ag.email     ?? "",
      telefono:   ag.telefono  ?? "",
      fecha_alta: ag.fecha_alta,
      plan:       (ag.plan?.tipo_plan ?? "PRO") as Plan,
      activo:     ag.activo,
    })
    setError("")
    setModal("editar")
  }

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal() }
    if (modal !== "none") document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [modal, closeModal])

  // ── Form submit ────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    startTransition(async () => {
      let result
      if (modal === "nuevo") {
        result = await crearAgente(form)
      } else if (modal === "editar" && selectedAgent) {
        result = await actualizarAgente(selectedAgent.id, form)
      }

      if (result?.error) {
        setError(result.error)
      } else {
        closeModal()
        router.refresh()
      }
    })
  }

  // ── RENDER ─────────────────────────────────────────
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
            Agentes
          </h1>
          <p style={{ fontSize: "12px", color: "#64748B", margin: 0, marginTop: "1px" }}>
            Gestión del equipo REMAX Tradición · {`${mes === 5 ? "Mayo" : mes}/${anio}`}
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
          <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span> Nuevo Agente
        </button>
      </div>

      {/* ── Scrollable content ────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>

        {/* ── KPI Grid ──────────────────────────── */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4,1fr)",
          gap: "14px", marginBottom: "20px",
        }}>
          <KpiCard
            title="Agentes activos"
            value={totalActivos}
            badge={`${agentes.length} en total`}
            gradient="linear-gradient(135deg,#E31837 0%,#9B0F26 100%)"
            shadowColor="rgba(227,24,55,0.35)"
            icon={<Users size={20} color="white" />}
          />
          <KpiCard
            title="Con plan este mes"
            value={conPlan}
            badge={`${agentes.length - conPlan} sin plan`}
            gradient="linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)"
            shadowColor="rgba(124,58,237,0.3)"
            icon={<Star size={20} color="white" />}
          />
          <KpiCard
            title="Planes al día"
            value={pagados}
            badge={`de ${conPlan} planes`}
            gradient="linear-gradient(135deg,#0D9488 0%,#0F766E 100%)"
            shadowColor="rgba(13,148,136,0.3)"
            icon={<CheckCircle size={20} color="white" />}
          />
          <KpiCard
            title="Pagos pendientes"
            value={pendientes}
            badge={pendientes === 0 ? "✓ Todo al día" : "por cobrar"}
            gradient="linear-gradient(135deg,#D97706 0%,#B45309 100%)"
            shadowColor="rgba(217,119,6,0.3)"
            icon={<Clock size={20} color="white" />}
          />
        </div>

        {/* ── Tabla de agentes ─────────────────── */}
        <div style={{
          background: "white", borderRadius: "14px",
          border: "1.5px solid #EAECF2", overflow: "hidden",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 20px", borderBottom: "1px solid #EAECF2",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E31837" }} />
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
                Lista de agentes
              </span>
            </div>
            <span style={{ fontSize: "12px", color: "#94A3B8" }}>
              {agentes.length} agentes
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8F9FC", borderBottom: "1px solid #EAECF2" }}>
                  {["Nombre", "Email", "Teléfono", "Fecha alta", "Plan actual", "Paga FEE", "Estado", ""].map(h => (
                    <th key={h} style={{
                      padding: "10px 18px", textAlign: "left",
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
                {agentes.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>
                      No hay agentes registrados. Hacé clic en &quot;+ Nuevo Agente&quot; para empezar.
                    </td>
                  </tr>
                ) : (
                  agentes.map((ag, i) => (
                    <tr
                      key={ag.id}
                      style={{ borderBottom: i === agentes.length - 1 ? "none" : "1px solid #F3F4F6" }}
                      className="hover:bg-[#FAFBFF]"
                    >
                      {/* Nombre con avatar */}
                      <td style={{ padding: "12px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{
                            width: "32px", height: "32px", borderRadius: "50%",
                            background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "11px", fontWeight: 700, color: "white", flexShrink: 0,
                          }}>
                            {initials(ag.nombre)}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: "13px", color: "#0F172A" }}>
                            {ag.nombre}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 18px", fontSize: "13px", color: "#64748B" }}>
                        {ag.email ?? <span style={{ color: "#CBD5E1" }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 18px", fontSize: "13px", color: "#64748B" }}>
                        {ag.telefono ?? <span style={{ color: "#CBD5E1" }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 18px", fontSize: "13px", color: "#64748B", whiteSpace: "nowrap" }}>
                        {fmtFecha(ag.fecha_alta)}
                      </td>
                      <td style={{ padding: "12px 18px" }}>
                        <PlanBadge plan={ag.plan?.tipo_plan ?? null} />
                      </td>
                      <td style={{ padding: "12px 18px" }}>
                        <select
                          value={getEfectivoPagaFee(ag) ? "si" : "no"}
                          disabled={feeLoading === ag.id}
                          onChange={e => handlePagaFee(ag.id, e.target.value === "si")}
                          onClick={e => e.stopPropagation()}
                          style={{
                            padding: "4px 8px", borderRadius: "7px",
                            border: "1.5px solid #EAECF2", background: "white",
                            fontSize: "12px", fontWeight: 600,
                            color: getEfectivoPagaFee(ag) ? "#059669" : "#64748B",
                            cursor: "pointer", fontFamily: "inherit",
                            opacity: feeLoading === ag.id ? 0.5 : 1,
                          }}
                        >
                          <option value="si">Sí</option>
                          <option value="no">No</option>
                        </select>
                      </td>
                      <td style={{ padding: "12px 18px" }}>
                        <EstadoBadge activo={ag.activo} />
                      </td>
                      <td style={{ padding: "12px 18px" }}>
                        <button
                          onClick={() => openEditar(ag)}
                          style={{
                            padding: "5px 14px", borderRadius: "7px",
                            border: "1.5px solid #EAECF2",
                            background: "white", fontSize: "12px", fontWeight: 600,
                            color: "#0F172A", cursor: "pointer", fontFamily: "inherit",
                          }}
                          className="hover:bg-[#F8F9FC] hover:border-[#CBD5E1]"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── MODAL ────────────────────────────────── */}
      {modal !== "none" && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(15,23,42,0.55)",
            backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: "20px",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "white", borderRadius: "16px",
              width: "100%", maxWidth: "480px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
          >
            {/* Modal header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "18px 20px", borderBottom: "1px solid #EAECF2",
            }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                  {modal === "nuevo" ? "Nuevo Agente" : "Editar Agente"}
                </h2>
                <p style={{ fontSize: "12px", color: "#64748B", margin: 0, marginTop: "2px" }}>
                  {modal === "nuevo"
                    ? "Completá los datos para dar de alta al agente"
                    : `Editando: ${selectedAgent?.nombre}`}
                </p>
              </div>
              <button
                onClick={closeModal}
                style={{
                  background: "#F8F9FC", border: "none", borderRadius: "8px",
                  width: "32px", height: "32px", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#64748B",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleSubmit} style={{ padding: "20px" }}>

              <Field label="Nombre completo *">
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  style={inputStyle}
                  placeholder="Ej: Romina Prieto"
                  required
                  autoFocus
                />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    style={inputStyle}
                    placeholder="nombre@remax.com.ar"
                  />
                </Field>
                <Field label="Teléfono">
                  <input
                    type="tel"
                    value={form.telefono}
                    onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                    style={inputStyle}
                    placeholder="+54 9 362 ..."
                  />
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Fecha de alta *">
                  <input
                    type="date"
                    value={form.fecha_alta}
                    onChange={e => setForm(f => ({ ...f, fecha_alta: e.target.value }))}
                    style={inputStyle}
                    required
                  />
                </Field>
                <Field label="Plan inicial *">
                  <select
                    value={form.plan}
                    onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
                    style={selectStyle}
                    required
                  >
                    <option value="PRO">PRO</option>
                    <option value="PRO+">PRO+</option>
                    <option value="B_QR">B_QR</option>
                    <option value="B_OFI">B_OFI</option>
                  </select>
                </Field>
              </div>

              {/* Toggle Activo — solo en editar */}
              {modal === "editar" && (
                <Field label="Estado del agente">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingTop: "2px" }}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.activo}
                      onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
                      style={{
                        width: "44px", height: "24px",
                        borderRadius: "12px", border: "none",
                        background: form.activo ? "#059669" : "#E5E7EB",
                        position: "relative", cursor: "pointer",
                        transition: "background 0.2s", padding: 0, flexShrink: 0,
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
                    <span style={{
                      fontSize: "13px", fontWeight: 600,
                      color: form.activo ? "#059669" : "#E11D48",
                    }}>
                      {form.activo ? "Activo" : "Inactivo — se registra fecha de baja"}
                    </span>
                  </div>
                </Field>
              )}

              {/* Error */}
              {error && (
                <div style={{
                  background: "#FFF1F2", border: "1px solid #FECDD3",
                  borderRadius: "8px", padding: "10px 12px",
                  fontSize: "12.5px", color: "#E11D48",
                  marginBottom: "14px",
                }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isPending}
                  style={{
                    padding: "9px 20px", borderRadius: "8px",
                    border: "1.5px solid #EAECF2", background: "white",
                    fontSize: "13px", fontWeight: 600, color: "#64748B",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  style={{
                    padding: "9px 24px", borderRadius: "8px", border: "none",
                    background: isPending
                      ? "#CBD5E1"
                      : "linear-gradient(135deg,#E31837 0%,#c0122d 100%)",
                    color: "white", fontSize: "13px", fontWeight: 700,
                    cursor: isPending ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: "6px",
                    boxShadow: isPending ? "none" : "0 2px 8px rgba(227,24,55,0.3)",
                    transition: "all 0.15s",
                  }}
                >
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
