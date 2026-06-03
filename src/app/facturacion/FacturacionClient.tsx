"use client"

import { useState, useMemo, useTransition, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import KpiCard from "@/components/KpiCard"
import { guardarFacturacion } from "./actions"
import type { FacturacionFormData } from "./actions"
import { DollarSign, TrendingUp, Award, X, Loader2 } from "lucide-react"

// ── Constants ────────────────────────────────────────
const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]

const ANIO = new Date().getFullYear()

const OBJETIVO_ANUAL_USD = 710_000

// Estacionalidad (índice 0 = Enero … 11 = Diciembre), suma = 100%
const ESTACIONALIDAD_PCT = [4.72, 5.41, 7.12, 6.82, 8.41, 9.15, 8.66, 9.64, 9.42, 9.65, 9.78, 11.22]

function calcObjetivoMes(mes: number): number {
  return Math.round(OBJETIVO_ANUAL_USD * ESTACIONALIDAD_PCT[mes - 1] / 100)
}

// ── Types ────────────────────────────────────────────
export interface FacturacionRow {
  id:           string
  mes:          number
  anio:         number
  objetivo_usd: number
  real_usd:     number
}

interface MesData {
  mes:          number
  nombre:       string
  objetivo_usd: number
  real_usd:     number
  id:           string | null   // null = sin datos aún
  isFuture:     boolean
}

interface FormData {
  real_usd: string
}

// ── Helpers ──────────────────────────────────────────
function fmtUSD(n: number): string {
  const rounded = Math.round(n * 100) / 100
  if (rounded === Math.floor(rounded)) {
    return `USD ${rounded.toLocaleString("es-AR")}`
  }
  return `USD ${rounded.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pct(real: number, objetivo: number): number {
  if (objetivo <= 0) return 0
  return Math.round((real / objetivo) * 100)
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
  const capped = Math.min(value, 100)
  const over   = value > 100

  const barColor = isFuture
    ? "#CBD5E1"
    : over
      ? "#059669"
      : value >= 80
        ? "#0D9488"
        : value >= 50
          ? "#D97706"
          : "#E11D48"

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
      {/* 100% marker */}
      <div style={{
        position: "absolute", top: "-4px",
        left: "100%", transform: "translateX(-1px)",
        width: "1px", height: "16px",
        background: "#CBD5E1",
      }} />
    </div>
  )
}

// ── Estado badge ──────────────────────────────────────
function EstadoBadge({ p, isFuture, real }: { p: number; isFuture: boolean; real: number }) {
  if (isFuture || real === 0) {
    return (
      <span style={{
        padding: "2px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
        background: "#F1F5F9", color: "#94A3B8",
      }}>
        Pendiente
      </span>
    )
  }
  if (p >= 100) {
    return (
      <span style={{
        padding: "2px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
        background: "#ECFDF5", color: "#059669",
      }}>
        ✓ Sobre objetivo
      </span>
    )
  }
  return (
    <span style={{
      padding: "2px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
      background: "#FFF1F2", color: "#E11D48",
    }}>
      Bajo objetivo
    </span>
  )
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
interface Props {
  rows: FacturacionRow[]
}

export default function FacturacionClient({ rows }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Build 12-month grid ────────────────────────────
  const currentMonth = new Date().getMonth() + 1  // 1-12

  const meses: MesData[] = useMemo(() => {
    return MONTH_NAMES.map((nombre, idx) => {
      const mes = idx + 1
      const row = rows.find(r => r.mes === mes && r.anio === ANIO)
      return {
        mes,
        nombre,
        objetivo_usd: calcObjetivoMes(mes),
        real_usd:     row?.real_usd ?? 0,
        id:           row?.id       ?? null,
        isFuture:     mes > currentMonth,
      }
    })
  }, [rows, currentMonth])

  // ── KPI stats ──────────────────────────────────────
  const stats = useMemo(() => {
    const completados = meses.filter(m => !m.isFuture && m.real_usd > 0)
    const totalReal   = completados.reduce((s, m) => s + m.real_usd,     0)
    const totalObj    = meses.filter(m => !m.isFuture).reduce((s, m) => s + m.objetivo_usd, 0)
    const pctAnual    = pct(totalReal, totalObj)

    const mejorMes = completados.reduce<MesData | null>((best, m) => {
      if (!best) return m
      return m.real_usd > best.real_usd ? m : best
    }, null)

    return { totalReal, totalObj, pctAnual, mejorMes }
  }, [meses])

  // ── Modal ──────────────────────────────────────────
  const [modalMes, setModalMes] = useState<MesData | null>(null)
  const [form,     setForm]     = useState<FormData>({ real_usd: "" })
  const [error,    setError]    = useState("")

  const closeModal = useCallback(() => { setModalMes(null); setError("") }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal() }
    if (modalMes) document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [modalMes, closeModal])

  function openModal(m: MesData) {
    setForm({
      real_usd: m.real_usd > 0 ? String(m.real_usd) : "",
    })
    setError("")
    setModalMes(m)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!modalMes) return

    const real = parseFloat(form.real_usd) || 0
    const obj  = calcObjetivoMes(modalMes.mes)

    const payload: FacturacionFormData = {
      mes:          modalMes.mes,
      anio:         ANIO,
      objetivo_usd: obj,
      real_usd:     real,
    }

    startTransition(async () => {
      const result = await guardarFacturacion(payload)
      if (result.error) setError(result.error)
      else { closeModal(); router.refresh() }
    })
  }

  // ── Card style ─────────────────────────────────────
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
            Facturación
          </h1>
          <p style={{ fontSize: "12px", color: "#64748B", margin: 0, marginTop: "1px" }}>
            Objetivos mensuales y facturación real — {ANIO}
          </p>
        </div>
        <div style={{
          padding: "6px 14px", borderRadius: "8px",
          background: "#F8F9FC", border: "1.5px solid #EAECF2",
          fontSize: "13px", fontWeight: 700, color: "#64748B",
        }}>
          Año {ANIO}
        </div>
      </div>

      {/* ── Scrollable content ────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>

        {/* ── KPI Cards ─────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px", marginBottom: "20px" }}>
          <KpiCard
            title="Facturación anual acumulada"
            value={fmtUSD(stats.totalReal)}
            badge={`de ${fmtUSD(stats.totalObj)} objetivo`}
            iconBg="bg-teal-50"
            iconColor="text-teal-600"
            icon={<DollarSign size={18} />}
          />
          <KpiCard
            title="% Cumplimiento anual"
            value={`${stats.pctAnual}%`}
            badge={stats.pctAnual >= 100 ? "✓ Objetivo superado" : stats.pctAnual >= 80 ? "Buen ritmo" : "Por mejorar"}
            iconBg={stats.pctAnual >= 100 ? "bg-emerald-50" : stats.pctAnual >= 80 ? "bg-violet-50" : "bg-amber-50"}
            iconColor={stats.pctAnual >= 100 ? "text-emerald-600" : stats.pctAnual >= 80 ? "text-violet-600" : "text-amber-600"}
            icon={<TrendingUp size={18} />}
          />
          <KpiCard
            title="Mejor mes"
            value={stats.mejorMes ? stats.mejorMes.nombre : "—"}
            badge={stats.mejorMes ? fmtUSD(stats.mejorMes.real_usd) : "Sin datos"}
            iconBg="bg-rose-50"
            iconColor="text-rose-600"
            icon={<Award size={18} />}
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
                  {["Mes","Objetivo","Real","% Cumplimiento","Progreso","Estado",""].map(h => (
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
                  const p      = pct(m.real_usd, m.objetivo_usd)
                  const isLast = i === 11
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

                      {/* Objetivo */}
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "#64748B", whiteSpace: "nowrap" }}>
                        {m.objetivo_usd > 0 ? fmtUSD(m.objetivo_usd) : <span style={{ color: "#CBD5E1" }}>—</span>}
                      </td>

                      {/* Real */}
                      <td style={{ padding: "14px 16px", fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap",
                        color: m.real_usd > 0 ? "#0F172A" : "#CBD5E1" }}>
                        {m.real_usd > 0 ? fmtUSD(m.real_usd) : "—"}
                      </td>

                      {/* % */}
                      <td style={{ padding: "14px 16px", fontWeight: 700, fontSize: "14px", whiteSpace: "nowrap",
                        color: m.isFuture || m.real_usd === 0 ? "#CBD5E1" : p >= 100 ? "#059669" : p >= 80 ? "#0D9488" : "#E11D48" }}>
                        {m.isFuture || (m.objetivo_usd === 0 && m.real_usd === 0) ? "—" : `${p}%`}
                      </td>

                      {/* Progress bar */}
                      <td style={{ padding: "14px 16px", minWidth: "140px" }}>
                        {m.objetivo_usd > 0 && (
                          <ProgressBar value={p} isFuture={m.isFuture} />
                        )}
                      </td>

                      {/* Estado */}
                      <td style={{ padding: "14px 16px" }}>
                        <EstadoBadge p={p} isFuture={m.isFuture} real={m.real_usd} />
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
                          className="hover:bg-[#F8F9FC]"
                        >
                          {m.id ? "Editar" : "Cargar"}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Footer total row */}
              <tfoot>
                <tr style={{ background: "#F8F9FC", borderTop: "2px solid #EAECF2" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 800, fontSize: "13px", color: "#0F172A" }}>
                    TOTAL {ANIO}
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: "13px", color: "#64748B" }}>
                    {fmtUSD(meses.reduce((s, m) => s + m.objetivo_usd, 0))}
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: "13px", color: "#0F172A" }}>
                    {fmtUSD(stats.totalReal)}
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 800, fontSize: "14px",
                    color: stats.pctAnual >= 100 ? "#059669" : stats.pctAnual >= 80 ? "#0D9488" : "#E11D48" }}>
                    {stats.pctAnual}%
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          MODAL — CARGAR / EDITAR FACTURACIÓN
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
                  {modalMes.id ? "Editar facturación" : "Cargar facturación"}
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
              {/* Objetivo auto-calculado (read-only) */}
              {modalMes && (
                <Field label="Objetivo mensual (calculado automáticamente)">
                  <div style={{
                    ...inp, background: "#F8F9FC", color: "#64748B",
                    border: "1.5px solid #F1F5F9", cursor: "default",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <span style={{ fontWeight: 700, color: "#0F172A" }}>
                      {fmtUSD(calcObjetivoMes(modalMes.mes))}
                    </span>
                    <span style={{
                      fontSize: "11px", background: "#EFF6FF", color: "#2563EB",
                      padding: "2px 8px", borderRadius: "6px", fontWeight: 600,
                    }}>
                      {ESTACIONALIDAD_PCT[modalMes.mes - 1]}% × {fmtUSD(OBJETIVO_ANUAL_USD)}
                    </span>
                  </div>
                </Field>
              )}

              <Field label="Facturación real (USD)">
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={form.real_usd}
                  onChange={e => setForm(f => ({ ...f, real_usd: e.target.value }))}
                  placeholder="0"
                  style={inp}
                  autoFocus
                />
              </Field>

              {/* Preview cumplimiento */}
              {modalMes && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 12px", borderRadius: "8px",
                  background: "#F8F9FC", border: "1px solid #EAECF2",
                  marginBottom: "14px",
                }}>
                  <span style={{ fontSize: "12px", color: "#64748B", fontWeight: 500 }}>
                    % Cumplimiento:
                  </span>
                  <span style={{
                    fontWeight: 800, fontSize: "16px",
                    color: (() => {
                      const p = pct(parseFloat(form.real_usd) || 0, calcObjetivoMes(modalMes.mes))
                      return p >= 100 ? "#059669" : p >= 80 ? "#0D9488" : "#E11D48"
                    })(),
                  }}>
                    {pct(parseFloat(form.real_usd) || 0, calcObjetivoMes(modalMes.mes))}%
                  </span>
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
