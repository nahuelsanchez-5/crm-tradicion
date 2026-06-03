"use client"

import { useState, useMemo, useTransition, useEffect, useCallback, Fragment } from "react"
import { useRouter } from "next/navigation"
import { registrarEncuesta } from "./actions"
import type { RegistroEncuestaData } from "./actions"
import type { RegistroRow } from "./page"
import { ClipboardList, TrendingUp, Star, X, Loader2, ChevronDown, ChevronRight, CheckCircle2, Save } from "lucide-react"
import KpiCardGlobal from "@/components/KpiCard"

// ── Constants ────────────────────────────────────────
const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]

// ── Types ────────────────────────────────────────────
interface Props {
  registros:  RegistroRow[]
  objetivoPct: number
  mesActual:  number
  anio:       number
}

interface FormState {
  tipo:       "ESPONTANEA" | "MAILING"
  subtipo:    string
  referencia: string
  nps:        string
  comentario: string
  fecha:      string
}

// ── Helpers ──────────────────────────────────────────
function npsColor(nps: number | null): string {
  if (nps === null) return "#94A3B8"
  if (nps >= 50)  return "#059669"
  if (nps >= 0)   return "#D97706"
  return "#E11D48"
}

function npsLabel(nps: number | null): string {
  if (nps === null) return "—"
  if (nps >= 70) return "Promotor"
  if (nps >= 0)  return "Neutral"
  return "Detractor"
}

function fmtFecha(fechaStr: string): string {
  if (!fechaStr) return "—"
  const [a, m, d] = fechaStr.split("-")
  return `${parseInt(d).toString().padStart(2,"0")}/${parseInt(m).toString().padStart(2,"0")}/${a}`
}

function mesKey(fechaStr: string): string {
  return fechaStr.substring(0, 7) // "YYYY-MM"
}

function mesNombre(key: string): string {
  const [y, m] = key.split("-")
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`
}

function NpsBadge({ nps }: { nps: number | null }) {
  const color = npsColor(nps)
  const bg    = nps === null ? "#F1F5F9" : nps >= 50 ? "#ECFDF5" : nps >= 0 ? "#FFFBEB" : "#FFF1F2"
  return (
    <span style={{
      background: bg, color, padding: "2px 9px",
      borderRadius: "12px", fontSize: "11px", fontWeight: 700,
      display: "inline-block",
    }}>
      {nps !== null ? `NPS ${nps}` : "Sin NPS"}
    </span>
  )
}

function TipoBadge({ tipo }: { tipo: string }) {
  const isMailling = tipo === "MAILING"
  return (
    <span style={{
      background: isMailling ? "#EFF6FF" : "#F5F3FF",
      color:      isMailling ? "#2563EB" : "#7C3AED",
      padding: "2px 9px", borderRadius: "12px",
      fontSize: "10.5px", fontWeight: 700, display: "inline-block",
    }}>
      {tipo === "ESPONTANEA" ? "ESPONTÁNEA" : "MAILING"}
    </span>
  )
}

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  borderRadius: "8px", border: "1.5px solid #EAECF2",
  fontSize: "13px", fontFamily: "inherit",
  color: "#0F172A", outline: "none", background: "white",
  boxSizing: "border-box",
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

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export default function EncuestasClient({ registros, objetivoPct, mesActual, anio }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showModal,   setShowModal]   = useState(false)
  const [error,       setError]      = useState("")
  const [saveSuccess, setSaveSuccess] = useState(false)
  const todayStr = new Date().toISOString().split("T")[0]

  const [form, setForm] = useState<FormState>({
    tipo:       "ESPONTANEA",
    subtipo:    "Comprador",
    referencia: "",
    nps:        "",
    comentario: "",
    fecha:      todayStr,
  })

  // ── Expanded month rows ────────────────────────────
  const [expandedMeses, setExpandedMeses] = useState<Set<string>>(() => {
    const now = new Date()
    return new Set([`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`])
  })

  function toggleMes(key: string) {
    setExpandedMeses(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ── KPI: current month ─────────────────────────────
  const mesActualStr = `${anio}-${String(mesActual).padStart(2, "0")}`
  const regMesActual = useMemo(() => registros.filter(r => r.fecha.startsWith(mesActualStr)), [registros, mesActualStr])
  const totalMes     = regMesActual.length
  const conNpsMes    = regMesActual.filter(r => r.nps !== null)
  const npsMes       = conNpsMes.length > 0
    ? Math.round(conNpsMes.reduce((s, r) => s + (r.nps ?? 0), 0) / conNpsMes.length)
    : null
  const pctNpsMes    = totalMes > 0 ? Math.round((conNpsMes.length / totalMes) * 100) : 0

  // ── Group by month for history ─────────────────────
  const groupedByMes = useMemo(() => {
    const map = new Map<string, RegistroRow[]>()
    for (const r of registros) {
      const k = mesKey(r.fecha)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(r)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [registros])

  // ── Modal ──────────────────────────────────────────
  const closeModal = useCallback(() => { setShowModal(false); setError("") }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal() }
    if (showModal) document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [showModal, closeModal])

  function openModal() {
    setForm({
      tipo:       "ESPONTANEA",
      subtipo:    "Comprador",
      referencia: "",
      nps:        "",
      comentario: "",
      fecha:      todayStr,
    })
    setError("")
    setShowModal(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!form.referencia.trim()) { setError("Ingresá la referencia"); return }
    const nps = form.nps !== "" ? parseInt(form.nps) : null
    if (nps !== null && (isNaN(nps) || nps < -100 || nps > 100)) {
      setError("El NPS debe estar entre -100 y 100"); return
    }

    const payload: RegistroEncuestaData = {
      fecha:      form.fecha,
      tipo:       form.tipo,
      subtipo:    form.tipo === "ESPONTANEA" ? form.subtipo : null,
      referencia: form.referencia,
      nps,
      comentario: form.comentario,
    }

    startTransition(async () => {
      const result = await registrarEncuesta(payload)
      if (result.error) setError(result.error)
      else { setSaveSuccess(true); setTimeout(() => { setSaveSuccess(false); closeModal(); router.refresh() }, 1000) }
    })
  }

  const cardStyle: React.CSSProperties = {
    background: "white", borderRadius: "14px",
    border: "1.5px solid #EAECF2", overflow: "hidden",
  }

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
            Encuestas
          </h1>
          <p style={{ fontSize: "12px", color: "#64748B", margin: 0, marginTop: "1px" }}>
            Satisfacción de clientes y agentes — {MONTH_NAMES[mesActual - 1]} {anio}
          </p>
        </div>
        <button
          onClick={openModal}
          style={{
            background: "linear-gradient(135deg,#E31837 0%,#c0122d 100%)",
            color: "white", border: "none",
            padding: "8px 18px", borderRadius: "9px",
            fontSize: "13px", fontWeight: 700, cursor: "pointer",
            boxShadow: "0 2px 10px rgba(227,24,55,0.35)",
            fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px",
          }}
        >
          <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span> Registrar encuesta
        </button>
      </div>

      {/* ── Scrollable content ────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>

        {/* ── KPI Cards ─────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px", marginBottom: "20px" }}>
          <KpiCardGlobal
            title={`Encuestas — ${MONTH_NAMES[mesActual - 1]}`}
            value={totalMes}
            badge={`${regMesActual.filter(r => r.tipo === "ESPONTANEA").length} espontáneas + ${regMesActual.filter(r => r.tipo === "MAILING").length} mailing`}
            iconBg="bg-teal-50"
            iconColor="text-teal-600"
            icon={<ClipboardList size={18} />}
          />
          <KpiCardGlobal
            title="% Con NPS del mes"
            value={`${pctNpsMes}%`}
            badge={pctNpsMes >= objetivoPct ? `✓ Supera objetivo ${objetivoPct}%` : `Meta: ${objetivoPct}%`}
            iconBg={pctNpsMes >= objetivoPct ? "bg-emerald-50" : totalMes === 0 ? "bg-slate-50" : "bg-rose-50"}
            iconColor={pctNpsMes >= objetivoPct ? "text-emerald-600" : totalMes === 0 ? "text-slate-500" : "text-rose-600"}
            icon={<TrendingUp size={18} />}
          />
          <KpiCardGlobal
            title="NPS promedio del mes"
            value={npsMes !== null ? String(npsMes) : "—"}
            badge={
              npsMes === null ? "Sin respuestas NPS"
              : npsMes >= 70  ? "Excelente"
              : npsMes >= 40  ? "Bueno"
              :                 "Por mejorar"
            }
            iconBg={npsMes === null ? "bg-slate-50" : npsMes >= 70 ? "bg-emerald-50" : npsMes >= 40 ? "bg-amber-50" : "bg-rose-50"}
            iconColor={npsMes === null ? "text-slate-500" : npsMes >= 70 ? "text-emerald-600" : npsMes >= 40 ? "text-amber-600" : "text-rose-600"}
            icon={<Star size={18} />}
          />
        </div>

        {/* ── Historial por mes ─────────────────── */}
        <div style={cardStyle}>
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "14px 20px", borderBottom: "1px solid #EAECF2",
          }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E31837" }} />
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
              Historial de encuestas
            </span>
            <span style={{ fontSize: "12px", color: "#94A3B8", marginLeft: "4px" }}>
              {registros.length} registros — últimos 6 meses
            </span>
          </div>

          {groupedByMes.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>
              No hay encuestas registradas. Hacé clic en &quot;+ Registrar encuesta&quot; para empezar.
            </div>
          ) : (
            <div>
              {groupedByMes.map(([mesK, regs], gi) => {
                const isOpen    = expandedMeses.has(mesK)
                const isLast    = gi === groupedByMes.length - 1
                const conNps    = regs.filter(r => r.nps !== null)
                const npsAvg    = conNps.length > 0
                  ? Math.round(conNps.reduce((s, r) => s + (r.nps ?? 0), 0) / conNps.length)
                  : null
                const pctNps    = regs.length > 0 ? Math.round(conNps.length / regs.length * 100) : 0

                return (
                  <Fragment key={mesK}>
                    {/* Month header row */}
                    <div
                      onClick={() => toggleMes(mesK)}
                      style={{
                        display: "flex", alignItems: "center",
                        padding: "12px 20px",
                        borderBottom: isOpen || (!isLast) ? "1px solid #F3F4F6" : "none",
                        cursor: "pointer",
                        background: isOpen ? "#FAFBFF" : "white",
                        transition: "background 0.1s",
                        userSelect: "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                        {isOpen
                          ? <ChevronDown size={14} color="#94A3B8" />
                          : <ChevronRight size={14} color="#94A3B8" />
                        }
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>
                          {mesNombre(mesK)}
                        </span>
                        {mesK === mesActualStr && (
                          <span style={{
                            fontSize: "10px", fontWeight: 700,
                            background: "#FFF1F2", color: "#E11D48",
                            padding: "1px 7px", borderRadius: "10px",
                          }}>
                            HOY
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <span style={{ fontSize: "12px", color: "#64748B" }}>
                          <strong style={{ color: "#0F172A" }}>{regs.length}</strong> encuestas
                        </span>
                        {npsAvg !== null && (
                          <span style={{
                            fontSize: "12px", fontWeight: 700, color: npsColor(npsAvg),
                          }}>
                            NPS {npsAvg}
                          </span>
                        )}
                        <span style={{
                          fontSize: "11px", fontWeight: 700,
                          background: pctNps >= objetivoPct ? "#ECFDF5" : "#F1F5F9",
                          color: pctNps >= objetivoPct ? "#059669" : "#94A3B8",
                          padding: "2px 9px", borderRadius: "10px",
                        }}>
                          {pctNps}% NPS
                        </span>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div style={{
                        background: "#F8FAFF", borderBottom: isLast ? "none" : "1px solid #F3F4F6",
                        overflowX: "auto",
                      }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ background: "#F1F5F9" }}>
                              {["Fecha","Tipo","Referencia","Subtipo","NPS","Calificación","Comentario"].map(h => (
                                <th key={h} style={{
                                  padding: "8px 16px", textAlign: "left",
                                  fontSize: "10px", fontWeight: 700,
                                  textTransform: "uppercase" as const,
                                  letterSpacing: "0.7px", color: "#94A3B8",
                                  whiteSpace: "nowrap",
                                }}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {regs.map((r, ri) => (
                              <tr
                                key={r.id}
                                style={{
                                  borderTop: ri > 0 ? "1px solid #F3F4F6" : "none",
                                  background: "white",
                                }}
                              >
                                <td style={{ padding: "10px 16px", fontSize: "12px", color: "#64748B", whiteSpace: "nowrap" }}>
                                  {fmtFecha(r.fecha)}
                                </td>
                                <td style={{ padding: "10px 16px" }}>
                                  <TipoBadge tipo={r.tipo} />
                                </td>
                                <td style={{ padding: "10px 16px", fontSize: "12px", fontWeight: 600, color: "#0F172A" }}>
                                  {r.referencia}
                                </td>
                                <td style={{ padding: "10px 16px", fontSize: "12px", color: "#64748B" }}>
                                  {r.subtipo ?? "—"}
                                </td>
                                <td style={{ padding: "10px 16px" }}>
                                  <NpsBadge nps={r.nps} />
                                </td>
                                <td style={{ padding: "10px 16px", fontSize: "11.5px", color: npsColor(r.nps), fontWeight: 600 }}>
                                  {npsLabel(r.nps)}
                                </td>
                                <td style={{ padding: "10px 16px", fontSize: "12px", color: "#64748B",
                                  maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {r.comentario ?? <span style={{ color: "#CBD5E1" }}>—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Fragment>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════
          MODAL — REGISTRAR ENCUESTA
      ════════════════════════════════════════════ */}
      {showModal && (
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
              animation: "modalIn 0.18s ease-out",
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: "1px solid #EAECF2",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="bg-violet-50 rounded-xl p-2.5 flex-shrink-0">
                  <ClipboardList size={20} className="text-violet-600" />
                </div>
                <div>
                  <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                    Registrar Encuesta
                  </h2>
                  <p style={{ fontSize: "12px", color: "#64748B", margin: 0, marginTop: "2px" }}>
                    Nueva respuesta de satisfacción
                  </p>
                </div>
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

            <form onSubmit={handleSubmit} style={{ padding: "20px" }}>

              {/* Tipo selector */}
              <Field label="Tipo de encuesta *">
                <div style={{ display: "flex", gap: "8px" }}>
                  {(["ESPONTANEA", "MAILING"] as const).map(t => (
                    <button
                      key={t} type="button"
                      onClick={() => setForm(f => ({ ...f, tipo: t }))}
                      style={{
                        flex: 1, padding: "10px 0", borderRadius: "9px",
                        fontSize: "12.5px", fontWeight: form.tipo === t ? 800 : 500,
                        cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                        border: form.tipo === t
                          ? `1.5px solid ${t === "ESPONTANEA" ? "#7C3AED" : "#2563EB"}`
                          : "1.5px solid #EAECF2",
                        background: form.tipo === t
                          ? (t === "ESPONTANEA" ? "#F5F3FF" : "#EFF6FF")
                          : "white",
                        color: form.tipo === t
                          ? (t === "ESPONTANEA" ? "#7C3AED" : "#2563EB")
                          : "#64748B",
                      }}
                    >
                      {t === "ESPONTANEA" ? "ESPONTÁNEA" : "MAILING"}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "5px" }}>
                  {form.tipo === "ESPONTANEA"
                    ? "Feedback espontáneo de un cliente en una operación"
                    : "Respuesta a una campaña de mailing enviada a un agente"
                  }
                </div>
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {/* Referencia */}
                <Field label={form.tipo === "ESPONTANEA" ? "N° de oferta *" : "Agente *"}>
                  <input
                    type="text"
                    placeholder={form.tipo === "ESPONTANEA" ? "Ej: 1234" : "Ej: Romina Prieto"}
                    value={form.referencia}
                    onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
                    style={inp} required autoFocus
                  />
                </Field>

                {/* Subtipo (solo ESPONTANEA) */}
                {form.tipo === "ESPONTANEA" ? (
                  <Field label="Tipo contacto *">
                    <div style={{ display: "flex", gap: "6px" }}>
                      {(["Comprador", "Vendedor"] as const).map(s => (
                        <button
                          key={s} type="button"
                          onClick={() => setForm(f => ({ ...f, subtipo: s }))}
                          style={{
                            flex: 1, padding: "9px 0", borderRadius: "8px",
                            fontSize: "12px", fontWeight: form.subtipo === s ? 700 : 500,
                            cursor: "pointer", fontFamily: "inherit",
                            border: form.subtipo === s ? "1.5px solid #7C3AED" : "1.5px solid #EAECF2",
                            background: form.subtipo === s ? "#F5F3FF" : "white",
                            color: form.subtipo === s ? "#7C3AED" : "#64748B",
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </Field>
                ) : (
                  <Field label="Fecha *">
                    <input type="date" value={form.fecha}
                      onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                      style={inp} required />
                  </Field>
                )}
              </div>

              {form.tipo === "ESPONTANEA" && (
                <Field label="Fecha *">
                  <input type="date" value={form.fecha}
                    onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                    style={inp} required />
                </Field>
              )}

              {/* NPS */}
              <Field label="NPS (−100 a 100)">
                <input
                  type="number" min="-100" max="100" step="1"
                  placeholder="Opcional — ej: 75"
                  value={form.nps}
                  onChange={e => setForm(f => ({ ...f, nps: e.target.value }))}
                  style={inp}
                />
                {form.nps !== "" && (
                  <div style={{ marginTop: "5px" }}>
                    <NpsBadge nps={parseInt(form.nps) || null} />
                    <span style={{ fontSize: "11px", color: "#64748B", marginLeft: "6px" }}>
                      {npsLabel(parseInt(form.nps) || null)}
                    </span>
                  </div>
                )}
              </Field>

              {/* Comentario */}
              <Field label="Comentario">
                <textarea
                  rows={2} placeholder="Feedback libre (opcional)"
                  value={form.comentario}
                  onChange={e => setForm(f => ({ ...f, comentario: e.target.value }))}
                  style={{ ...inp, resize: "vertical", lineHeight: 1.5 }}
                />
              </Field>

              {error && (
                <div style={{
                  background: "#FFF1F2", border: "1px solid #FECDD3",
                  borderRadius: "8px", padding: "10px 12px",
                  fontSize: "12.5px", color: "#E11D48", marginBottom: "14px",
                }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", alignItems: "center" }}>
                {saveSuccess ? (
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 px-4 py-2.5 rounded-lg">
                    <CheckCircle2 size={15} /> Encuesta registrada
                  </div>
                ) : (
                  <>
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
                        cursor: isPending ? "not-allowed" : "pointer", fontFamily: "inherit",
                        display: "flex", alignItems: "center", gap: "6px",
                        boxShadow: isPending ? "none" : "0 2px 8px rgba(227,24,55,0.3)",
                      }}>
                      {isPending && <Loader2 size={14} className="animate-spin" />}
                      {isPending ? "Guardando..." : <><Save size={14} /> Registrar</>}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
