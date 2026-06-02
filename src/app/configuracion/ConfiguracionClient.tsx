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
  { clave: "bono_pro",             valor: "500",    etiqueta: "Bono PRO (USD)",       grupo: "bonos" },
  { clave: "bono_pro_plus",        valor: "800",    etiqueta: "Bono PRO+ (USD)",      grupo: "bonos" },
  { clave: "bono_b_qr",            valor: "300",    etiqueta: "Bono B_QR (USD)",      grupo: "bonos" },
  { clave: "bono_b_ofi",           valor: "600",    etiqueta: "Bono B_OFI (USD)",     grupo: "bonos" },
  // KPIs
  { clave: "obj_facturacion_usd",  valor: "28000",  etiqueta: "Objetivo facturación mensual (USD)", grupo: "kpis" },
  { clave: "obj_carteleria_pct",   valor: "95",     etiqueta: "Objetivo recuperación cartelería (%)", grupo: "kpis" },
  { clave: "obj_encuestas_pct",    valor: "60",     etiqueta: "Objetivo respuesta encuestas (%)",   grupo: "kpis" },
  // Comunicación
  {
    clave:    "mensaje_whatsapp",
    valor:    "Hola [nombre], te recordamos que tenés un saldo pendiente de USD [monto] correspondiente a [mes]. Cualquier consulta estamos a disposición. REMAX Tradición",
    etiqueta: "Mensaje WhatsApp de cobro",
    grupo:    "comunicacion",
  },
]

const GRUPO_LABELS: Record<string, string> = {
  planes:       "Licencias CRM",
  bonos:        "Montos de bonos",
  kpis:         "Objetivos de KPIs",
  comunicacion: "Comunicación",
}

const TEXTAREA_CLAVES = new Set(["mensaje_whatsapp"])

// ── Styles ────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  borderRadius: "8px", border: "1.5px solid #EAECF2",
  fontSize: "13px", fontFamily: "inherit",
  color: "#0F172A", outline: "none", background: "white",
  boxSizing: "border-box",
}

// ── Props ─────────────────────────────────────────────
interface Props {
  initialEntries: ConfigEntry[]
}

export default function ConfiguracionClient({ initialEntries }: Props) {
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

  // Group config by grupo
  const grupos = Array.from(new Set(DEFAULT_CONFIG.map(e => e.grupo)))

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
            Configuración
          </h1>
          <p style={{ fontSize: "12px", color: "#64748B", margin: 0, marginTop: "1px" }}>
            Valores globales del sistema
          </p>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "6px 14px", borderRadius: "8px",
          background: "#F8F9FC", border: "1.5px solid #EAECF2",
        }}>
          <Settings size={14} color="#64748B" />
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#64748B" }}>Sistema</span>
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
                  background: "white", borderRadius: "14px",
                  border: "1.5px solid #EAECF2", overflow: "hidden",
                }}>
                  {/* Card header */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "14px 20px", borderBottom: "1px solid #EAECF2",
                    background: "#F8F9FC",
                  }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E31837" }} />
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>
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
                            ? "1px solid #F3F4F6"
                            : "none",
                          borderRight: (idx % 2 === 0 && idx < items.length - 1)
                            ? "1px solid #F3F4F6"
                            : "none",
                        }}
                      >
                        <label style={{
                          display: "block", fontSize: "11px", fontWeight: 700,
                          letterSpacing: "0.8px", textTransform: "uppercase" as const,
                          color: "#64748B", marginBottom: "6px",
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
                                  background: "#F1F5F9", color: "#0D9488",
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
                        <div style={{ fontSize: "10.5px", color: "#94A3B8", marginTop: "4px", fontFamily: "monospace" }}>
                          {entry.clave}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Error */}
            {error && (
              <div style={{
                background: "#FFF1F2", border: "1px solid #FECDD3",
                borderRadius: "10px", padding: "12px 16px",
                fontSize: "13px", color: "#E11D48",
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
                      ? "#CBD5E1"
                      : "linear-gradient(135deg,#E31837 0%,#c0122d 100%)",
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
