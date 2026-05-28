"use client"

import { useState, useMemo, useTransition, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import KpiCard from "@/components/KpiCard"
import { guardarEncuesta } from "./actions"
import type { EncuestaFormData } from "./actions"
import { ClipboardList, TrendingUp, Star, X, Loader2 } from "lucide-react"

// ── Constants ────────────────────────────────────────
const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]
const ANIO     = 2026
const OBJETIVO = 60   // % de respuesta objetivo

// ── Types ────────────────────────────────────────────
export interface EncuestaRow {
  id:           string
  mes:          number
  anio:         number
  enviadas:     number
  respondidas:  number
  nps_promedio: number | null
}

interface MesData {
  mes:          number
  nombre:       string
  enviadas:     number
  respondidas:  number
  nps_promedio: number | null
  id:           string | null
  isFuture:     boolean
}

interface FormData {
  enviadas:     string
  respondidas:  string
  nps_promedio: string
}

// ── Helpers ──────────────────────────────────────────
function pct(respondidas: number, enviadas: number): number {
  if (enviadas <= 0) return 0
  return Math.round((respondidas / enviadas) * 100)
}

function npsColor(nps: number): string {
  if (nps >= 70) return "#059669"
  if (nps >= 40) return "#D97706"
  return "#E11D48"
}

// ── Sub-components ───────────────────────────────────
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

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  borderRadius: "8px", border: "1.5px solid #EAECF2",
  fontSize: "13px", fontFamily: "inherit",
  color: "#0F172A", outline: "none", background: "white",
  boxSizing: "border-box",
}

// ── Progress bar ─────────────────────────────────────
function ProgressBar({ value, isFuture }: { value: number; isFuture: boolean }) {
  const capped   = Math.min(value, 100)
  const meets    = value >= OBJETIVO
  const barColor = isFuture ? "#CBD5E1" : meets ? "#059669" : "#E11D48"

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        width: "100%", height: "8px", borderRadius: "4px",
        background: "#F1F5F9", overflow: "hidden",
      }}>
        <div style={{
          width: `${isFuture ? 0 : capped}%`,
          height: "100%", borderRadius: "4px",
          background: barColor,
          transition: "width 0.4s ease",
        }} />
      </div>
      {/* 60% marker */}
      <div style={{
        position: "absolute", top: "-4px",
        left: `${OBJETIVO}%`, transform: "translateX(-1px)",
        width: "2px", height: "16px",
        background: "#94A3B8",
      }} />
    </div>
  )
}

// ── Estado badge ──────────────────────────────────────
function EstadoBadge({ p, isFuture, enviadas }: { p: number; isFuture: boolean; enviadas: number }) {
  if (isFuture || enviadas === 0) {
    return (
      <span style={{
        padding: "2px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
        background: "#F1F5F9", color: "#94A3B8",
      }}>
        Pendiente
      </span>
    )
  }
  if (p >= OBJETIVO) {
    return (
      <span style={{
        padding: "2px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
        background: "#ECFDF5", color: "#059669",
      }}>
        ✓ En objetivo
      </span>
    )
  }
  return (
    <span style={{
      padding: "2px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
      background: "#FFF1F2", color: "#E11D48",
    }}>
      Bajo {OBJETIVO}%
    </span>
  )
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
interface Props {
  rows: EncuestaRow[]
}

export default function EncuestasClient({ rows }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const currentMonth = new Date().getMonth() + 1

  const meses: MesData[] = useMemo(() => {
    return MONTH_NAMES.map((nombre, idx) => {
      const mes = idx + 1
      const row = rows.find(r => r.mes === mes && r.anio === ANIO)
      return {
        mes,
        nombre,
        enviadas:     row?.enviadas     ?? 0,
        respondidas:  row?.respondidas  ?? 0,
        nps_promedio: row?.nps_promedio ?? null,
        id:           row?.id           ?? null,
        isFuture:     mes > currentMonth,
      }
    })
  }, [rows, currentMonth])

  // ── KPI stats ──────────────────────────────────────
  const stats = useMemo(() => {
    const completados    = meses.filter(m => !m.isFuture && m.enviadas > 0)
    const totalEnviadas  = completados.reduce((s, m) => s + m.enviadas,    0)
    const totalResp      = completados.reduce((s, m) => s + m.respondidas, 0)
    const pctGlobal      = pct(totalResp, totalEnviadas)
    const mesesEnObj     = completados.filter(m => pct(m.respondidas, m.enviadas) >= OBJETIVO).length

    const conNps         = completados.filter(m => m.nps_promedio !== null)
    const npsAnual       = conNps.length > 0
      ? Math.round(conNps.reduce((s, m) => s + (m.nps_promedio ?? 0), 0) / conNps.length)
      : null

    return { totalEnviadas, totalResp, pctGlobal, mesesEnObj, completados: completados.length, npsAnual }
  }, [meses])

  // ── Modal ──────────────────────────────────────────
  const [modalMes, setModalMes] = useState<MesData | null>(null)
  const [form,     setForm]     = useState<FormData>({ enviadas: "", respondidas: "", nps_promedio: "" })
  const [error,    setError]    = useState("")

  const closeModal = useCallback(() => { setModalMes(null); setError("") }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal() }
    if (modalMes) document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [modalMes, closeModal])

  function openModal(m: MesData) {
    setForm({
      enviadas:     m.enviadas    > 0   ? String(m.enviadas)    : "",
      respondidas:  m.respondidas > 0   ? String(m.respondidas) : "",
      nps_promedio: m.nps_promedio !== null ? String(m.nps_promedio) : "",
    })
    setError("")
    setModalMes(m)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!modalMes) return

    const enviadas    = parseInt(form.enviadas)    || 0
    const respondidas = parseInt(form.respondidas) || 0
    const nps         = form.nps_promedio !== "" ? parseFloat(form.nps_promedio) : null

    if (enviadas <= 0)           { setError("Las encuestas enviadas deben ser mayor a 0"); return }
    if (respondidas > enviadas)  { setError("Las respondidas no pueden superar las enviadas"); return }
    if (nps !== null && (nps < -100 || nps > 100)) { setError("El NPS debe estar entre -100 y 100"); return }

    const payload: EncuestaFormData = {
      mes:          modalMes.mes,
      anio:         ANIO,
      enviadas,
      respondidas,
      nps_promedio: nps,
    }

    startTransition(async () => {
      const result = await guardarEncuesta(payload)
      if (result.error) setError(result.error)
      else { closeModal(); router.refresh() }
    })
  }

  const cardStyle: React.CSSProperties = {
    background: "white", borderRadius: "14px",
    border: "1.5px solid #EAECF2", overflow: "hidden",
  }

  const previewPct = pct(
    parseInt(form.respondidas) || 0,
    parseInt(form.enviadas)    || 1,
  )

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
            Seguimiento de encuestas de satisfacción — {ANIO}
          </p>
        </div>
        <div style={{
          padding: "6px 14px", borderRadius: "8px",
          background: "#F8F9FC", border: "1.5px solid #EAECF2",
          fontSize: "13px", fontWeight: 700, color: "#64748B",
        }}>
          Objetivo: {OBJETIVO}% respuesta
        </div>
      </div>

      {/* ── Scrollable content ────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>

        {/* ── KPI Cards ─────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px", marginBottom: "20px" }}>
          <KpiCard
            title="Encuestas enviadas acumuladas"
            value={stats.totalEnviadas.toLocaleString("es-AR")}
            badge={`${stats.totalResp.toLocaleString("es-AR")} respondidas`}
            gradient="linear-gradient(135deg,#0D9488 0%,#0F766E 100%)"
            shadowColor="rgba(13,148,136,0.3)"
            icon={<ClipboardList size={20} color="white" />}
          />
          <KpiCard
            title="% Respuesta acumulado"
            value={`${stats.pctGlobal}%`}
            badge={stats.pctGlobal >= OBJETIVO ? "✓ En objetivo" : `Meta: ${OBJETIVO}%`}
            gradient={
              stats.pctGlobal >= OBJETIVO
                ? "linear-gradient(135deg,#059669 0%,#047857 100%)"
                : "linear-gradient(135deg,#E11D48 0%,#BE123C 100%)"
            }
            shadowColor={stats.pctGlobal >= OBJETIVO ? "rgba(5,150,105,0.3)" : "rgba(225,29,72,0.3)"}
            icon={<TrendingUp size={20} color="white" />}
          />
          <KpiCard
            title="NPS promedio anual"
            value={stats.npsAnual !== null ? String(stats.npsAnual) : "—"}
            badge={stats.npsAnual !== null
              ? (stats.npsAnual >= 70 ? "Excelente" : stats.npsAnual >= 40 ? "Bueno" : "Por mejorar")
              : "Sin datos NPS"}
            gradient={
              stats.npsAnual === null ? "linear-gradient(135deg,#64748B 0%,#475569 100%)"
              : stats.npsAnual >= 70  ? "linear-gradient(135deg,#059669 0%,#047857 100%)"
              : stats.npsAnual >= 40  ? "linear-gradient(135deg,#D97706 0%,#B45309 100%)"
              :                         "linear-gradient(135deg,#E31837 0%,#9B0F26 100%)"
            }
            shadowColor={
              stats.npsAnual === null ? "rgba(100,116,139,0.3)"
              : stats.npsAnual >= 70  ? "rgba(5,150,105,0.3)"
              : stats.npsAnual >= 40  ? "rgba(217,119,6,0.3)"
              :                         "rgba(227,24,55,0.3)"
            }
            icon={<Star size={20} color="white" />}
          />
        </div>

        {/* ── Tabla anual ──────────────────────────── */}
        <div style={cardStyle}>
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "14px 20px", borderBottom: "1px solid #EAECF2",
          }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E31837" }} />
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
              Detalle mensual {ANIO}
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8F9FC", borderBottom: "1px solid #EAECF2" }}>
                  {["Mes","Enviadas","Respondidas","% Respuesta","Progreso (60%)","NPS","Estado",""].map(h => (
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
                {meses.map((m, i) => {
                  const p         = pct(m.respondidas, m.enviadas)
                  const isLast    = i === 11
                  const isCurrent = m.mes === currentMonth

                  return (
                    <tr
                      key={m.mes}
                      style={{
                        borderBottom: isLast ? "none" : "1px solid #F3F4F6",
                        background: isCurrent ? "rgba(227,24,55,0.03)" : undefined,
                      }}
                    >
                      {/* Mes */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{
                            fontSize: "13px", fontWeight: isCurrent ? 800 : 600,
                            color: isCurrent ? "#E31837" : "#0F172A",
                          }}>
                            {m.nombre}
                          </span>
                          {isCurrent && (
                            <span style={{
                              fontSize: "10px", fontWeight: 700,
                              background: "#FFF1F2", color: "#E11D48",
                              padding: "1px 7px", borderRadius: "10px",
                            }}>
                              HOY
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Enviadas */}
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "#64748B" }}>
                        {m.enviadas > 0 ? m.enviadas : <span style={{ color: "#CBD5E1" }}>—</span>}
                      </td>

                      {/* Respondidas */}
                      <td style={{ padding: "14px 16px", fontSize: "13px", fontWeight: 600,
                        color: m.respondidas > 0 ? "#0F172A" : "#CBD5E1" }}>
                        {m.respondidas > 0 ? m.respondidas : "—"}
                      </td>

                      {/* % */}
                      <td style={{ padding: "14px 16px", fontWeight: 700, fontSize: "14px", whiteSpace: "nowrap",
                        color: m.isFuture || m.enviadas === 0 ? "#CBD5E1" : p >= OBJETIVO ? "#059669" : "#E11D48" }}>
                        {m.isFuture || m.enviadas === 0 ? "—" : `${p}%`}
                      </td>

                      {/* Progress bar */}
                      <td style={{ padding: "14px 16px", minWidth: "140px" }}>
                        {m.enviadas > 0 && (
                          <ProgressBar value={p} isFuture={m.isFuture} />
                        )}
                      </td>

                      {/* NPS */}
                      <td style={{ padding: "14px 16px", fontWeight: 700, fontSize: "14px",
                        color: m.nps_promedio !== null ? npsColor(m.nps_promedio) : "#CBD5E1" }}>
                        {m.nps_promedio !== null ? m.nps_promedio : "—"}
                      </td>

                      {/* Estado */}
                      <td style={{ padding: "14px 16px" }}>
                        <EstadoBadge p={p} isFuture={m.isFuture} enviadas={m.enviadas} />
                      </td>

                      {/* Action */}
                      <td style={{ padding: "14px 16px" }}>
                        <button
                          onClick={() => openModal(m)}
                          style={{
                            padding: "5px 14px", borderRadius: "7px",
                            border: "1.5px solid #EAECF2", background: "white",
                            fontSize: "12px", fontWeight: 600, color: "#0F172A",
                            cursor: "pointer", fontFamily: "inherit",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {m.id ? "Editar" : "Cargar"}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              <tfoot>
                <tr style={{ background: "#F8F9FC", borderTop: "2px solid #EAECF2" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 800, fontSize: "13px", color: "#0F172A" }}>
                    TOTAL {ANIO}
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: "13px", color: "#64748B" }}>
                    {meses.reduce((s, m) => s + m.enviadas, 0)}
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: "13px", color: "#0F172A" }}>
                    {meses.reduce((s, m) => s + m.respondidas, 0)}
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 800, fontSize: "14px",
                    color: stats.pctGlobal >= OBJETIVO ? "#059669" : "#E11D48" }}>
                    {stats.pctGlobal}%
                  </td>
                  <td style={{ padding: "12px 16px" }} />
                  <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: "13px",
                    color: stats.npsAnual !== null ? npsColor(stats.npsAnual) : "#CBD5E1" }}>
                    {stats.npsAnual !== null ? stats.npsAnual : "—"}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          MODAL — CARGAR / EDITAR ENCUESTA
      ════════════════════════════════════════════ */}
      {modalMes && (
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
              width: "100%", maxWidth: "420px",
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
                  {modalMes.id ? "Editar encuesta" : "Cargar encuesta"}
                </h2>
                <p style={{ fontSize: "12px", color: "#64748B", margin: 0, marginTop: "2px" }}>
                  {modalMes.nombre} {ANIO}
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

            <form onSubmit={handleSubmit} style={{ padding: "20px" }}>
              <Field label="Encuestas enviadas *">
                <input
                  type="number" min="0" step="1"
                  value={form.enviadas}
                  onChange={e => setForm(f => ({ ...f, enviadas: e.target.value }))}
                  placeholder="0"
                  style={inp}
                  required
                  autoFocus
                />
              </Field>

              <Field label="Encuestas respondidas">
                <input
                  type="number" min="0" step="1"
                  value={form.respondidas}
                  onChange={e => setForm(f => ({ ...f, respondidas: e.target.value }))}
                  placeholder="0"
                  style={inp}
                />
              </Field>

              <Field label="NPS promedio (−100 a 100)">
                <input
                  type="number" min="-100" max="100" step="1"
                  value={form.nps_promedio}
                  onChange={e => setForm(f => ({ ...f, nps_promedio: e.target.value }))}
                  placeholder="Opcional"
                  style={inp}
                />
              </Field>

              {/* Preview */}
              {form.enviadas && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 12px", borderRadius: "8px",
                  background: "#F8F9FC", border: "1px solid #EAECF2",
                  marginBottom: "14px",
                }}>
                  <span style={{ fontSize: "12px", color: "#64748B", fontWeight: 500 }}>
                    % Respuesta:
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{
                      fontWeight: 800, fontSize: "16px",
                      color: previewPct >= OBJETIVO ? "#059669" : "#E11D48",
                    }}>
                      {previewPct}%
                    </span>
                    <span style={{
                      fontSize: "11px", fontWeight: 700,
                      padding: "2px 8px", borderRadius: "10px",
                      background: previewPct >= OBJETIVO ? "#ECFDF5" : "#FFF1F2",
                      color: previewPct >= OBJETIVO ? "#059669" : "#E11D48",
                    }}>
                      {previewPct >= OBJETIVO ? "✓ En objetivo" : `Meta: ${OBJETIVO}%`}
                    </span>
                  </div>
                </div>
              )}

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
    </div>
  )
}
