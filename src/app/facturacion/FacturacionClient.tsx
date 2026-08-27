"use client"

import { useState, useMemo, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import KpiCard from "@/components/KpiCard"
import { Backdrop, ModalHeader } from "@/components/Modal"
import { guardarFacturacion } from "./actions"
import type { FacturacionFormData } from "./actions"
import { DollarSign, TrendingUp, Award, Loader2 } from "lucide-react"
import Topbar from "@/components/Topbar"
import { fmtUSD } from "@/lib/format"

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
        color: "var(--crm-text-muted)", marginBottom: "5px",
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  borderRadius: "8px", border: "1px solid var(--crm-card-border)",
  fontSize: "13px", fontFamily: "inherit",
  color: "var(--crm-text)", outline: "none", background: "var(--crm-input-bg)",
  boxSizing: "border-box",
}

// ── Progress bar ─────────────────────────────────────
function ProgressBar({ value, isFuture }: { value: number; isFuture: boolean }) {
  const capped = Math.min(value, 100)
  const over   = value > 100

  const barColor = isFuture
    ? "rgba(255,255,255,0.15)"
    : over
      ? "#4ade80"
      : value >= 80
        ? "#0D9488"
        : value >= 50
          ? "#D97706"
          : "var(--crm-accent)"

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        width: "100%", height: "8px", borderRadius: "4px",
        background: "rgba(255,255,255,0.06)", overflow: "hidden",
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
        background: "rgba(255,255,255,0.15)",
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
        background: "var(--crm-surface-3)", color: "var(--crm-text-muted)",
      }}>
        Pendiente
      </span>
    )
  }
  if (p >= 100) {
    return (
      <span style={{
        padding: "2px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
        background: "rgba(74,222,128,0.12)", color: "#4ade80",
      }}>
        ✓ Sobre objetivo
      </span>
    )
  }
  return (
    <span style={{
      padding: "2px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
      background: "var(--crm-accent-soft)", color: "var(--crm-accent)",
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
  comisionesPorMes: Record<string, number>
}

export default function FacturacionClient({ rows, comisionesPorMes }: Props) {
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

  function openModal(m: MesData) {
    const sugerido = comisionesPorMes[`${m.mes}-${ANIO}`] ?? 0
    setForm({
      // Si el mes ya tiene un real guardado (>0), respetarlo (no pisar ajustes manuales).
      // Si está en 0, pre-llenar con la suma de comisiones de Operaciones (si hay).
      real_usd: m.real_usd > 0 ? String(m.real_usd) : (sugerido > 0 ? String(sugerido.toFixed(2)) : ""),
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

  // ═══════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      <Topbar moduleName="Facturación" />

      {/* ── Scrollable content ────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>

        {/* ── Banda de encabezado ─────────────────── */}
        <header style={{ marginBottom: "22px" }}>
          <div style={{
            fontSize: "11px", fontWeight: 700, letterSpacing: "1.2px",
            textTransform: "uppercase" as const, color: "var(--crm-text-muted)", marginBottom: "6px",
          }}>
            Objetivo anual · {fmtUSD(OBJETIVO_ANUAL_USD)}
          </div>
          <h1 style={{
            fontSize: "27px", fontWeight: 800, letterSpacing: "-0.02em",
            color: "var(--crm-text)", margin: 0,
          }}>
            Año {ANIO}
          </h1>
        </header>

        {/* ── KPI Cards ─────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px", marginBottom: "16px" }}>
          <KpiCard
            title="Facturación anual acumulada"
            value={fmtUSD(stats.totalReal)}
            badge={`de ${fmtUSD(stats.totalObj)} objetivo`}
            iconBg="bg-teal-500/15"
            iconColor="text-teal-400"
            icon={<DollarSign size={18} />}
          />
          <KpiCard
            title="% Cumplimiento anual"
            value={`${stats.pctAnual}%`}
            badge={stats.pctAnual >= 100 ? "✓ Objetivo superado" : stats.pctAnual >= 80 ? "Buen ritmo" : "Por mejorar"}
            iconBg={stats.pctAnual >= 100 ? "bg-emerald-500/[0.12]" : stats.pctAnual >= 80 ? "bg-violet-500/[0.12]" : "bg-amber-500/[0.12]"}
            iconColor={stats.pctAnual >= 100 ? "text-emerald-400" : stats.pctAnual >= 80 ? "text-violet-400" : "text-amber-400"}
            icon={<TrendingUp size={18} />}
            primary
          />
          <KpiCard
            title="Mejor mes"
            value={stats.mejorMes ? stats.mejorMes.nombre : "—"}
            badge={stats.mejorMes ? fmtUSD(stats.mejorMes.real_usd) : "Sin datos"}
            iconBg="bg-rose-500/[0.12]"
            iconColor="text-rose-400"
            icon={<Award size={18} />}
          />
        </div>

        {/* ── Barra de progreso anual ─────────────── */}
        <div style={{
          background: "var(--crm-surface-2)", borderRadius: "14px",
          border: "1px solid var(--crm-divider)", padding: "18px 20px", marginBottom: "20px",
        }}>
          <div style={{
            display: "flex", alignItems: "flex-end", justifyContent: "space-between",
            gap: "16px", marginBottom: "12px",
          }}>
            <div>
              <div style={{
                fontSize: "13px", fontWeight: 700, color: "var(--crm-text)", marginBottom: "3px",
              }}>
                Progreso hacia el objetivo anual
              </div>
              <div style={{ fontSize: "12px", color: "var(--crm-text-muted)" }}>
                {fmtUSD(stats.totalReal)} de {fmtUSD(stats.totalObj)} acumulado a la fecha
              </div>
            </div>
            <span style={{
              fontSize: "22px", fontWeight: 800, lineHeight: 1, whiteSpace: "nowrap",
              color: stats.pctAnual >= 100 ? "#4ade80" : stats.pctAnual >= 80 ? "#0D9488" : "var(--crm-accent)",
            }}>
              {stats.pctAnual}%
            </span>
          </div>
          <ProgressBar value={stats.pctAnual} isFuture={false} />
        </div>

        {/* ── Tabla anual ──────────────────────────── */}
        <div style={{ background: "var(--crm-surface-2)", borderRadius: "14px", border: "1px solid var(--crm-divider)", overflow: "hidden" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "14px 20px", borderBottom: "1px solid var(--crm-divider)",
          }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--crm-accent)" }} />
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--crm-text)" }}>
              Detalle mensual {ANIO}
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--crm-surface-3)", borderBottom: "1px solid var(--crm-divider)" }}>
                  {["Mes","Objetivo","Real","% Cumplimiento","Progreso","Estado",""].map(h => (
                    <th key={h} style={{
                      padding: "10px 16px", textAlign: "left",
                      fontSize: "10.5px", fontWeight: 700,
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.8px", color: "var(--crm-text-muted)",
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
                        borderBottom: isLast ? "none" : "1px solid var(--crm-divider)",
                        background: isCurrent ? "var(--crm-accent-soft)" : undefined,
                      }}
                    >
                      {/* Mes */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{
                            fontSize: "13px", fontWeight: isCurrent ? 800 : 600,
                            color: isCurrent ? "var(--crm-accent)" : "var(--crm-text)",
                          }}>
                            {m.nombre}
                          </span>
                          {isCurrent && (
                            <span style={{
                              fontSize: "10px", fontWeight: 700,
                              background: "var(--crm-accent-soft)", color: "var(--crm-accent)",
                              padding: "1px 7px", borderRadius: "10px",
                            }}>
                              HOY
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Objetivo */}
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "var(--crm-text-muted)", whiteSpace: "nowrap" }}>
                        {m.objetivo_usd > 0 ? fmtUSD(m.objetivo_usd) : <span style={{ color: "var(--crm-text-muted)" }}>—</span>}
                      </td>

                      {/* Real */}
                      <td style={{ padding: "14px 16px", fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap",
                        color: m.real_usd > 0 ? "var(--crm-text)" : "var(--crm-text-muted)" }}>
                        {m.real_usd > 0 ? fmtUSD(m.real_usd) : "—"}
                      </td>

                      {/* % */}
                      <td style={{ padding: "14px 16px", fontWeight: 700, fontSize: "14px", whiteSpace: "nowrap",
                        color: m.isFuture || m.real_usd === 0 ? "var(--crm-text-muted)" : p >= 100 ? "#4ade80" : p >= 80 ? "#0D9488" : "var(--crm-accent)" }}>
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
                            border: "1px solid var(--crm-card-border)", background: "var(--crm-surface-3)",
                            fontSize: "12px", fontWeight: 600, color: "var(--crm-text)",
                            cursor: "pointer", fontFamily: "inherit",
                            whiteSpace: "nowrap",
                          }}
                          className="hover:bg-[rgba(255,255,255,0.1)]"
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
                <tr style={{ background: "var(--crm-surface-3)", borderTop: "2px solid var(--crm-card-border)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 800, fontSize: "13px", color: "var(--crm-text)" }}>
                    TOTAL {ANIO}
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: "13px", color: "var(--crm-text-muted)" }}>
                    {fmtUSD(meses.reduce((s, m) => s + m.objetivo_usd, 0))}
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: "13px", color: "var(--crm-text)" }}>
                    {fmtUSD(stats.totalReal)}
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 800, fontSize: "14px",
                    color: stats.pctAnual >= 100 ? "#4ade80" : stats.pctAnual >= 80 ? "#0D9488" : "var(--crm-accent)" }}>
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
        <Backdrop onClose={closeModal} style={{ maxWidth: "420px" }}>
          <ModalHeader
            title={modalMes.id ? "Editar facturación" : "Cargar facturación"}
            subtitle={`${modalMes.nombre} ${ANIO}`}
            onClose={closeModal}
          />

          <form onSubmit={handleSubmit} style={{ padding: "20px" }}>
              {/* Objetivo auto-calculado (read-only) */}
              {modalMes && (
                <Field label="Objetivo mensual (calculado automáticamente)">
                  <div style={{
                    ...inp, background: "var(--crm-surface-3)", color: "var(--crm-text-muted)",
                    border: "1px solid var(--crm-divider)", cursor: "default",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <span style={{ fontWeight: 700, color: "var(--crm-text)" }}>
                      {fmtUSD(calcObjetivoMes(modalMes.mes))}
                    </span>
                    <span style={{
                      fontSize: "11px", background: "rgba(96,165,250,0.12)", color: "#60a5fa",
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
                  step="0.01"
                  value={form.real_usd}
                  onChange={e => setForm(f => ({ ...f, real_usd: e.target.value }))}
                  placeholder="0"
                  style={inp}
                  autoFocus
                />
                {(() => {
                  const sugerido = comisionesPorMes[`${modalMes.mes}-${ANIO}`] ?? 0
                  return modalMes.real_usd === 0 && sugerido > 0 ? (
                    <p style={{ fontSize: "11px", color: "var(--crm-text-muted)", marginTop: "4px" }}>
                      Sugerido automáticamente desde Operaciones — verificá que estén todas las operaciones del mes cargadas antes de guardar.
                    </p>
                  ) : null
                })()}
              </Field>

              {/* Preview cumplimiento */}
              {modalMes && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 12px", borderRadius: "8px",
                  background: "var(--crm-surface-3)", border: "1px solid var(--crm-divider)",
                  marginBottom: "14px",
                }}>
                  <span style={{ fontSize: "12px", color: "var(--crm-text-muted)", fontWeight: 500 }}>
                    % Cumplimiento:
                  </span>
                  <span style={{
                    fontWeight: 800, fontSize: "16px",
                    color: (() => {
                      const p = pct(parseFloat(form.real_usd) || 0, calcObjetivoMes(modalMes.mes))
                      return p >= 100 ? "#4ade80" : p >= 80 ? "#0D9488" : "var(--crm-accent)"
                    })(),
                  }}>
                    {pct(parseFloat(form.real_usd) || 0, calcObjetivoMes(modalMes.mes))}%
                  </span>
                </div>
              )}

              {error && (
                <div style={{
                  background: "var(--crm-accent-soft)", border: "1px solid var(--crm-accent-glow)",
                  borderRadius: "8px", padding: "10px 12px",
                  fontSize: "12.5px", color: "var(--crm-accent)", marginBottom: "14px",
                }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={closeModal} disabled={isPending}
                  style={{
                    padding: "9px 20px", borderRadius: "8px",
                    border: "1px solid var(--crm-card-border)", background: "var(--crm-surface-3)",
                    fontSize: "13px", fontWeight: 600, color: "var(--crm-text-muted)",
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                  Cancelar
                </button>
                <button type="submit" disabled={isPending}
                  style={{
                    padding: "9px 24px", borderRadius: "8px", border: "none",
                    background: isPending ? "rgba(255,255,255,0.15)" : "linear-gradient(135deg,var(--crm-accent) 0%,var(--crm-accent-hover) 100%)",
                    color: "white", fontSize: "13px", fontWeight: 700,
                    cursor: isPending ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: "6px",
                    boxShadow: isPending ? "none" : "0 2px 8px var(--crm-accent-glow)",
                  }}>
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  {isPending ? "Guardando..." : "Guardar"}
                </button>
              </div>
          </form>
        </Backdrop>
      )}
    </div>
  )
}
