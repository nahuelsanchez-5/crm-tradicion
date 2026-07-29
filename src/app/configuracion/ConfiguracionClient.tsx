"use client"

import { useState, useTransition } from "react"
import { guardarConfig } from "./actions"
import type { ConfigEntry } from "./actions"
import { Settings, Save, Loader2, Check } from "lucide-react"

// ── Default config (seeds empty tables) ──────────────
const DEFAULT_CONFIG: ConfigEntry[] = [
  // Licencias CRM
  { clave: "nombre_plan_pro",      valor: "PRO",    etiqueta: "Licencia CRM PRO",        grupo: "planes" },
  { clave: "nombre_plan_pro_plus", valor: "PRO+",   etiqueta: "Licencia CRM PRO+",       grupo: "planes" },
  { clave: "nombre_plan_b_qr",     valor: "B_QR",   etiqueta: "Licencia CRM B_QR",       grupo: "planes" },
  { clave: "nombre_plan_b_ofi",    valor: "B_OFI",  etiqueta: "Licencia CRM B_OFI",      grupo: "planes" },
  { clave: "nombre_plan_ninguno",  valor: "---",    etiqueta: "SIN LICENCIA",            grupo: "planes" },
  // Bonos
  { clave: "fee_mensual",          valor: "100",    etiqueta: "FEE mensual (USD)",              grupo: "bonos" },
  { clave: "bono_pro",             valor: "500",    etiqueta: "Monto CRM PRO (USD)",           grupo: "bonos" },
  { clave: "bono_pro_plus",        valor: "800",    etiqueta: "Monto CRM PRO+ (USD)",          grupo: "bonos" },
  { clave: "bono_b_qr",            valor: "300",    etiqueta: "Monto Bonificación QR (USD)",   grupo: "bonos" },
  { clave: "bono_b_ofi",           valor: "600",    etiqueta: "Monto Bonificación Oficina (USD)", grupo: "bonos" },
  // KPIs
  { clave: "obj_facturacion_usd",  valor: "28000",  etiqueta: "Objetivo facturación mensual (USD)", grupo: "kpis" },
  { clave: "obj_carteleria_pct",   valor: "95",     etiqueta: "Objetivo recuperación cartelería (%)", grupo: "kpis" },
  { clave: "obj_encuestas_pct",    valor: "60",     etiqueta: "Objetivo respuesta encuestas (%)",   grupo: "kpis" },
  // Facturación
  { clave: "obj_anual_usd",        valor: "710000", etiqueta: "Objetivo anual USD",      grupo: "facturacion" },
  // Comunicación
  {
    clave:    "mensaje_whatsapp",
    valor:    "Hola [nombre]! Quedó pendiente un saldo de USD [monto] del [mes]. Cuando puedas, avisanos para coordinar. Gracias!",
    etiqueta: "Mensaje WhatsApp de cobro",
    grupo:    "comunicacion",
  },
  // Objetivos de Cartelería mes a mes
  { clave: "obj_carteles_enero",       valor: "0", etiqueta: "Objetivo Enero",       grupo: "carteles" },
  { clave: "obj_carteles_febrero",     valor: "0", etiqueta: "Objetivo Febrero",     grupo: "carteles" },
  { clave: "obj_carteles_marzo",       valor: "0", etiqueta: "Objetivo Marzo",       grupo: "carteles" },
  { clave: "obj_carteles_abril",       valor: "0", etiqueta: "Objetivo Abril",       grupo: "carteles" },
  { clave: "obj_carteles_mayo",        valor: "0", etiqueta: "Objetivo Mayo",        grupo: "carteles" },
  { clave: "obj_carteles_junio",       valor: "0", etiqueta: "Objetivo Junio",       grupo: "carteles" },
  { clave: "obj_carteles_julio",       valor: "0", etiqueta: "Objetivo Julio",       grupo: "carteles" },
  { clave: "obj_carteles_agosto",      valor: "0", etiqueta: "Objetivo Agosto",      grupo: "carteles" },
  { clave: "obj_carteles_septiembre",  valor: "0", etiqueta: "Objetivo Septiembre",  grupo: "carteles" },
  { clave: "obj_carteles_octubre",     valor: "0", etiqueta: "Objetivo Octubre",     grupo: "carteles" },
  { clave: "obj_carteles_noviembre",   valor: "0", etiqueta: "Objetivo Noviembre",   grupo: "carteles" },
  { clave: "obj_carteles_diciembre",   valor: "0", etiqueta: "Objetivo Diciembre",   grupo: "carteles" },
]

const GRUPO_LABELS: Record<string, string> = {
  planes:       "Licencias CRM",
  bonos:        "Montos de licencias CRM",
  kpis:         "Objetivos de KPIs",
  facturacion:  "Facturación",
  comunicacion: "Comunicación",
  carteles:     "Objetivos de Cartelería",
}

// ── Estacionalidad y Cartelería ───────────────────────
const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]
const MONTH_KEYS = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
]
const ESTACIONALIDAD_PCT = [4.72, 5.41, 7.12, 6.82, 8.41, 9.15, 8.66, 9.64, 9.42, 9.65, 9.78, 11.22]

const TEXTAREA_CLAVES = new Set(["mensaje_whatsapp"])

// ── Styles ────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)",
  fontSize: "13px", fontFamily: "inherit",
  color: "var(--crm-text)", outline: "none", background: "var(--crm-input-bg)",
  boxSizing: "border-box",
}

// ── Props ─────────────────────────────────────────────
interface Props {
  initialEntries:    ConfigEntry[]
  recuperadosPorMes: number[]
}

export default function ConfiguracionClient({ initialEntries, recuperadosPorMes }: Props) {
  // Merge defaults with loaded entries (DB values take priority)
  const merged = DEFAULT_CONFIG.map(def => {
    const found = initialEntries.find(e => e.clave === def.clave)
    return found ?? def
  })

  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(merged.map(e => [e.clave, e.valor]))
  )
  const [isPending,  startTransition] = useTransition()
  const [saved,      setSaved]        = useState(false)
  const [error,      setError]        = useState("")

  function handleChange(clave: string, val: string) {
    setValues(v => ({ ...v, [clave]: val }))
    setSaved(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    const entries: ConfigEntry[] = DEFAULT_CONFIG.map(def => ({
      clave:    def.clave,
      valor:    (values[def.clave] ?? def.valor).trim(),
      etiqueta: def.etiqueta,
      grupo:    def.grupo,
    }))

    startTransition(async () => {
      const result = await guardarConfig(entries)
      if (result.error) setError(result.error)
      else {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    })
  }

  // Group config by grupo — "carteles" se renderiza aparte como tabla
  const grupos = Array.from(new Set(DEFAULT_CONFIG.map(e => e.grupo))).filter(g => g !== "carteles")

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Page Header ──────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        minHeight: "62px", padding: "0 24px",
        background: "rgba(10,10,26,0.8)", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: "var(--crm-text)", letterSpacing: "-0.3px", margin: 0 }}>
            Configuración
          </h1>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, marginTop: "1px" }}>
            Valores globales del sistema
          </p>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "6px 14px", borderRadius: "8px",
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.07)",
        }}>
          <Settings size={14} color="rgba(255,255,255,0.5)" />
          <span style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>Sistema</span>
        </div>
      </div>

      {/* ── Scrollable content ────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "720px" }}>

            {grupos.map(grupo => {
              const items = DEFAULT_CONFIG.filter(e => e.grupo === grupo)
              return (
                <div key={grupo} style={{
                  background: "var(--crm-surface-2)", borderRadius: "14px",
                  border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden",
                }}>
                  {/* Card header */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(255,255,255,0.04)",
                  }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E31837" }} />
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--crm-text)" }}>
                      {GRUPO_LABELS[grupo] ?? grupo}
                    </span>
                  </div>

                  {/* Fields grid */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "0",
                  }}>
                    {items.map((entry, idx) => (
                      <div
                        key={entry.clave}
                        style={{
                          padding: "16px 20px",
                          borderBottom: idx < items.length - 1 && items.length > 1
                            ? "1px solid rgba(255,255,255,0.06)"
                            : "none",
                          borderRight: (idx % 2 === 0 && idx < items.length - 1)
                            ? "1px solid rgba(255,255,255,0.06)"
                            : "none",
                        }}
                      >
                        <label style={{
                          display: "block", fontSize: "11px", fontWeight: 700,
                          letterSpacing: "0.8px", textTransform: "uppercase" as const,
                          color: "rgba(255,255,255,0.45)", marginBottom: "6px",
                        }}>
                          {entry.etiqueta}
                        </label>
                        {TEXTAREA_CLAVES.has(entry.clave) ? (
                          <>
                            <textarea
                              value={values[entry.clave] ?? entry.valor}
                              onChange={e => handleChange(entry.clave, e.target.value)}
                              rows={4}
                              style={{ ...inp, resize: "vertical", lineHeight: 1.5 }}
                            />
                            <div style={{ fontSize: "11px", color: "#64748B", marginTop: "5px" }}>
                              Variables disponibles:{" "}
                              {["[nombre]", "[monto]", "[mes]"].map(v => (
                                <code key={v} style={{
                                  background: "rgba(255,255,255,0.08)", color: "#2dd4bf",
                                  padding: "1px 5px", borderRadius: "4px",
                                  fontSize: "10.5px", marginRight: "4px", fontFamily: "monospace",
                                }}>
                                  {v}
                                </code>
                              ))}
                            </div>
                          </>
                        ) : (
                          <input
                            type="text"
                            value={values[entry.clave] ?? entry.valor}
                            onChange={e => handleChange(entry.clave, e.target.value)}
                            style={inp}
                          />
                        )}
                        <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.3)", marginTop: "4px", fontFamily: "monospace" }}>
                          {entry.clave}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* ── Estacionalidad (calculada desde obj_anual_usd) ── */}
            <div style={{
              background: "var(--crm-surface-2)", borderRadius: "14px",
              border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.04)",
              }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E31837" }} />
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--crm-text)" }}>
                  Estacionalidad — Objetivos mensuales calculados
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      {["Mes", "% Estacional", "Objetivo USD"].map(h => (
                        <th key={h} style={{
                          padding: "8px 20px", textAlign: "left",
                          fontSize: "10.5px", fontWeight: 700,
                          textTransform: "uppercase" as const,
                          letterSpacing: "0.8px", color: "rgba(255,255,255,0.35)",
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MONTH_NAMES.map((nombre, idx) => {
                      const pct    = ESTACIONALIDAD_PCT[idx]
                      const anual  = parseFloat(values["obj_anual_usd"] || "710000") || 710000
                      const obj    = Math.round(anual * pct / 100)
                      const isLast = idx === 11
                      return (
                        <tr key={nombre} style={{ borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.06)" }}>
                          <td style={{ padding: "10px 20px", fontSize: "13px", fontWeight: 600, color: "var(--crm-text)" }}>
                            {nombre}
                          </td>
                          <td style={{ padding: "10px 20px" }}>
                            <span style={{
                              background: "rgba(96,165,250,0.12)", color: "#60a5fa",
                              padding: "2px 10px", borderRadius: "20px",
                              fontSize: "12px", fontWeight: 700,
                            }}>
                              {pct}%
                            </span>
                          </td>
                          <td style={{ padding: "10px 20px", fontSize: "13px", fontWeight: 600, color: "var(--crm-text)" }}>
                            USD {obj.toLocaleString("es-AR")}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Objetivos de Cartelería (mes a mes) ── */}
            <div style={{
              background: "var(--crm-surface-2)", borderRadius: "14px",
              border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.04)",
              }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E31837" }} />
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--crm-text)" }}>
                  Objetivos de Cartelería — Carteles a recuperar por mes
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      {["Mes", "Objetivo", "Recuperados (año actual)"].map(h => (
                        <th key={h} style={{
                          padding: "8px 20px", textAlign: "left",
                          fontSize: "10.5px", fontWeight: 700,
                          textTransform: "uppercase" as const,
                          letterSpacing: "0.8px", color: "rgba(255,255,255,0.35)",
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MONTH_NAMES.map((nombre, idx) => {
                      const clave  = `obj_carteles_${MONTH_KEYS[idx]}`
                      const rec    = recuperadosPorMes[idx] ?? 0
                      const isLast = idx === 11
                      return (
                        <tr key={nombre} style={{ borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.06)" }}>
                          <td style={{ padding: "10px 20px", fontSize: "13px", fontWeight: 600, color: "var(--crm-text)", width: "150px" }}>
                            {nombre}
                          </td>
                          <td style={{ padding: "8px 20px", width: "180px" }}>
                            <input
                              type="number"
                              min="0"
                              value={values[clave] ?? "0"}
                              onChange={e => handleChange(clave, e.target.value)}
                              style={{ ...inp, width: "100px" }}
                            />
                          </td>
                          <td style={{ padding: "10px 20px" }}>
                            <span style={{
                              background: rec > 0 ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.06)",
                              color: rec > 0 ? "#4ade80" : "rgba(255,255,255,0.45)",
                              padding: "2px 10px", borderRadius: "20px",
                              fontSize: "12px", fontWeight: 700,
                            }}>
                              {rec}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: "rgba(227,24,55,0.12)", border: "1px solid rgba(227,24,55,0.25)",
                borderRadius: "10px", padding: "12px 16px",
                fontSize: "13px", color: "var(--crm-accent-light)",
              }}>
                ⚠️ {error}
              </div>
            )}

            {/* Save button */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                disabled={isPending}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "11px 28px", borderRadius: "10px", border: "none",
                  background: saved
                    ? "linear-gradient(135deg,#059669 0%,#047857 100%)"
                    : isPending
                      ? "rgba(255,255,255,0.12)"
                      : "linear-gradient(135deg,#E31837 0%,var(--crm-accent-hover) 100%)",
                  color: "white", fontSize: "14px", fontWeight: 700,
                  cursor: isPending ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  boxShadow: isPending ? "none" : saved
                    ? "0 4px 12px rgba(5,150,105,0.35)"
                    : "0 4px 12px rgba(227,24,55,0.35)",
                  transition: "background 0.3s, box-shadow 0.3s",
                }}
              >
                {isPending
                  ? <><Loader2 size={16} className="animate-spin" /> Guardando...</>
                  : saved
                    ? <><Check size={16} /> Guardado</>
                    : <><Save size={16} /> Guardar cambios</>
                }
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
