"use client"

import { useState, useMemo, useTransition, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import KpiCard from "@/components/KpiCard"
import { crearOperacion, actualizarOperacion, eliminarOperacion } from "./actions"
import type { OperacionFormData } from "./actions"
import { Building2, DollarSign, BarChart2, X, Loader2, Trash2 } from "lucide-react"

// ── Constants ────────────────────────────────────────
const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]

const TIPOS = ["Venta", "Alquiler", "Alquiler Temporal", "Referido", "Otro"]

const TIPO_STYLES: Record<string, { bg: string; color: string }> = {
  Venta:               { bg: "rgba(96,165,250,0.12)",   color: "#60a5fa" },
  Alquiler:            { bg: "rgba(74,222,128,0.12)",   color: "#4ade80" },
  "Alquiler Temporal": { bg: "rgba(45,212,191,0.12)",   color: "#2dd4bf" },
  Referido:            { bg: "rgba(167,139,250,0.12)",  color: "#a78bfa" },
  Otro:                { bg: "rgba(255,255,255,0.08)",  color: "rgba(255,255,255,0.5)" },
}

// ── Types ────────────────────────────────────────────
export interface OperacionRow {
  id:                 string
  fecha:              string
  direccion:          string
  agentes:            string
  tipo:               string
  comision_bruta:     number
  comision_neta:      number
  encuesta_comprador: boolean | null
  encuesta_vendedor:  boolean | null
}

interface FormData {
  fecha:              string
  direccion:          string
  agentes:            string
  tipo:               string
  moneda:             "USD" | "ARS"
  tipo_cambio:        string
  comision_bruta:     string
  comision_neta:      string
  encuesta_comprador: boolean
  encuesta_vendedor:  boolean
}

// ── Helpers ──────────────────────────────────────────
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
function TipoBadge({ tipo }: { tipo: string }) {
  const s = TIPO_STYLES[tipo] ?? TIPO_STYLES.Otro
  return (
    <span style={{
      ...s, padding: "3px 10px", borderRadius: "20px",
      fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap" as const,
    }}>
      {tipo}
    </span>
  )
}

function EncuestaIndicator({ value }: { value: boolean | null }) {
  const done = value === true
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: "26px", height: "26px", borderRadius: "50%",
      background: done ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
      color: done ? "#4ade80" : "#f87171",
      fontSize: "14px", fontWeight: 700,
    }}>
      {done ? "✓" : "✗"}
    </span>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={{
        display: "block", fontSize: "11px", fontWeight: 700,
        letterSpacing: "0.8px", textTransform: "uppercase" as const,
        color: "rgba(255,255,255,0.45)", marginBottom: "5px",
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)",
  fontSize: "13px", fontFamily: "inherit",
  color: "#f1f5f9", outline: "none", background: "#1e1e2e",
  boxSizing: "border-box",
}

// ── Toggle switch ────────────────────────────────────
function Toggle({
  value, onChange, label,
}: {
  value: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "9px 14px", borderRadius: "8px", width: "100%",
        border: `1.5px solid ${value ? "#6EE7B7" : "rgba(255,255,255,0.1)"}`,
        background: value ? "#ECFDF5" : "rgba(255,255,255,0.04)",
        cursor: "pointer", fontFamily: "inherit",
        transition: "all 0.15s",
      }}
    >
      {/* pill */}
      <div style={{
        width: "36px", height: "20px", borderRadius: "10px",
        background: value ? "#059669" : "rgba(255,255,255,0.2)",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", top: "3px",
          left: value ? "19px" : "3px",
          width: "14px", height: "14px", borderRadius: "50%",
          background: "white", transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </div>
      <span style={{ fontSize: "13px", color: value ? "#059669" : "rgba(255,255,255,0.45)", fontWeight: 500 }}>
        {label}: <strong>{value ? "Sí" : "No"}</strong>
      </span>
    </button>
  )
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
interface Props {
  operaciones: OperacionRow[]
}

const EMPTY_FORM: FormData = {
  fecha:              "",
  direccion:          "",
  agentes:            "",
  tipo:               "Venta",
  moneda:             "USD",
  tipo_cambio:        "",
  comision_bruta:     "",
  comision_neta:      "",
  encuesta_comprador: false,
  encuesta_vendedor:  false,
}

export default function OperacionesClient({ operaciones }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Filters ────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`
  })

  const MONTHS_OPTIONS = useMemo<Array<{ label: string; value: string }>>(() => {
    const opts: Array<{ label: string; value: string }> = [
      { label: "Todos los meses", value: "todos" },
    ]
    const n = new Date()
    for (let i = 0; i < 6; i++) {
      const d = new Date(n.getFullYear(), n.getMonth() - i, 1)
      opts.push({
        label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      })
    }
    return opts
  }, [])

  // ── Modal ──────────────────────────────────────────
  type ModalT = "none" | "nuevo" | "editar"
  const [modal,       setModal]      = useState<ModalT>("none")
  const [selectedOp,  setSelectedOp] = useState<OperacionRow | null>(null)
  const [form,        setForm]       = useState<FormData>(EMPTY_FORM)
  const [error,       setError]      = useState("")
  const [deleteId,    setDeleteId]   = useState<string | null>(null)

  // ── Computed ───────────────────────────────────────
  const filteredOps = useMemo(() => {
    if (selectedMonth === "todos") return operaciones
    return operaciones.filter(o => o.fecha.substring(0, 7) === selectedMonth)
  }, [operaciones, selectedMonth])

  const stats = useMemo(() => {
    const total            = filteredOps.length
    const totalComisiones  = filteredOps.reduce((s, o) => s + (Number(o.comision_bruta) || 0), 0)
    const withBoth         = filteredOps.filter(o => o.encuesta_comprador && o.encuesta_vendedor).length
    const pctEncuestas     = total > 0 ? Math.round((withBoth / total) * 100) : 0
    const ventas           = filteredOps.filter(o => o.tipo === "Venta").length
    const alquileres       = filteredOps.filter(o => o.tipo.includes("Alquiler")).length
    return { total, totalComisiones, pctEncuestas, withBoth, ventas, alquileres }
  }, [filteredOps])

  // ── Keyboard ───────────────────────────────────────
  const closeModal = useCallback(() => { setModal("none"); setError("") }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { closeModal(); setDeleteId(null) }
    }
    if (modal !== "none" || deleteId !== null) document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [modal, closeModal, deleteId])

  // ── Open modals ────────────────────────────────────
  function openNuevo() {
    setForm({ ...EMPTY_FORM, fecha: new Date().toISOString().split("T")[0] })
    setError("")
    setModal("nuevo")
  }

  function openEditar(o: OperacionRow) {
    setSelectedOp(o)
    setForm({
      fecha:              o.fecha,
      direccion:          o.direccion,
      agentes:            o.agentes,
      tipo:               o.tipo,
      moneda:             "USD",
      tipo_cambio:        "",
      comision_bruta:     String(Number(o.comision_bruta)),
      comision_neta:      String(Number(o.comision_neta)),
      encuesta_comprador: o.encuesta_comprador ?? false,
      encuesta_vendedor:  o.encuesta_vendedor  ?? false,
    })
    setError("")
    setModal("editar")
  }

  function handleDelete() {
    if (!deleteId) return
    startTransition(async () => {
      await eliminarOperacion(deleteId)
      setDeleteId(null)
      router.refresh()
    })
  }

  // ── Field updater ──────────────────────────────────
  function setF<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  // ── Submit ─────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!form.direccion.trim()) { setError("La dirección es obligatoria"); return }
    if (!form.agentes.trim())   { setError("El/los agente(s) son obligatorios"); return }
    if (form.moneda === "ARS" && !form.tipo_cambio) { setError("Ingresá el tipo de cambio para convertir a USD"); return }

    const tc = parseFloat(form.tipo_cambio) || 1
    const brutoRaw = parseFloat(form.comision_bruta) || 0
    const netoRaw  = parseFloat(form.comision_neta)  || 0
    const brutoUSD = form.moneda === "ARS" ? Math.round(brutoRaw / tc * 100) / 100 : brutoRaw
    const netoUSD  = form.moneda === "ARS" ? Math.round(netoRaw  / tc * 100) / 100 : netoRaw

    const payload: OperacionFormData = {
      fecha:              form.fecha,
      direccion:          form.direccion.trim(),
      agentes:            form.agentes.trim(),
      tipo:               form.tipo,
      comision_bruta:     brutoUSD,
      comision_neta:      netoUSD,
      encuesta_comprador: form.encuesta_comprador,
      encuesta_vendedor:  form.encuesta_vendedor,
    }

    startTransition(async () => {
      const result = modal === "nuevo"
        ? await crearOperacion(payload)
        : await actualizarOperacion(selectedOp!.id, payload)

      if (result.error) setError(result.error)
      else { closeModal(); router.refresh() }
    })
  }

  // ── Shared styles ──────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: "#13131a", borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden",
  }

  // ═══════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Page Header ──────────────────────────── */}
      <div className="crm-page-header flex-shrink-0">
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.3px", margin: 0 }}>
            Operaciones
          </h1>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, marginTop: "1px" }}>
            Registro de ventas y alquileres del equipo
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
          <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span> Nueva Operación
        </button>
      </div>

      {/* ── Scrollable content ────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>

        {/* ── KPI Cards ─────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "14px", marginBottom: "20px" }}>
          <KpiCard
            title="Operaciones del período"
            value={String(stats.total)}
            badge={`${stats.ventas} ventas · ${stats.alquileres} alquileres`}
            iconBg="bg-blue-500/15"
            iconColor="text-blue-400"
            icon={<Building2 size={18} />}
          />
          <KpiCard
            title="Comisiones brutas"
            value={fmtUSD(stats.totalComisiones)}
            badge="total del período"
            iconBg="bg-teal-500/15"
            iconColor="text-teal-400"
            icon={<DollarSign size={18} />}
          />
        </div>

        {/* ── Filtro ───────────────────────────────── */}
        <div style={{
          ...cardStyle, overflow: "visible",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 18px", marginBottom: "16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>MES</span>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              style={{
                padding: "6px 10px", borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.1)", fontSize: "12.5px",
                fontWeight: 500, color: "#f1f5f9", background: "#1e1e2e",
                cursor: "pointer", fontFamily: "inherit", outline: "none",
              }}
            >
              {MONTHS_OPTIONS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
            {filteredOps.length} operación{filteredOps.length !== 1 ? "es" : ""}
          </span>
        </div>

        {/* ── Tabla ────────────────────────────────── */}
        <div style={cardStyle}>
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E31837" }} />
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9" }}>
              Historial de operaciones
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["Fecha","Dirección","Agente(s)","Tipo","Comisión Bruta",""].map(h => (
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
                {filteredOps.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "48px 40px", textAlign: "center" }}>
                      <div style={{ fontSize: "28px", marginBottom: "10px", opacity: 0.4 }}>🏠</div>
                      <div style={{ fontWeight: 600, fontSize: "14px", color: "rgba(255,255,255,0.45)", marginBottom: "4px" }}>
                        Sin operaciones en este período
                      </div>
                      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
                        Cambiá el mes o registrá la primera operación con el botón &quot;+ Nueva Operación&quot;.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOps.map((o, i) => {
                    const isLast = i === filteredOps.length - 1
                    return (
                      <tr
                        key={o.id}
                        style={{ borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.06)" }}
                        className="hover:bg-[rgba(255,255,255,0.03)]"
                      >
                        <td style={{ padding: "12px 16px", fontSize: "12px", color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>
                          {fmtFecha(o.fecha)}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", color: "#f1f5f9", maxWidth: "200px" }}>
                          <span title={o.direccion} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {o.direccion}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "12px", color: "rgba(255,255,255,0.45)", maxWidth: "160px" }}>
                          <span title={o.agentes} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {o.agentes}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <TipoBadge tipo={o.tipo} />
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 600, color: "#f1f5f9", whiteSpace: "nowrap" }}>
                          {fmtUSD(Number(o.comision_bruta))}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <button
                              onClick={() => openEditar(o)}
                              style={{
                                padding: "5px 14px", borderRadius: "7px",
                                border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
                                fontSize: "12px", fontWeight: 600, color: "#f1f5f9",
                                cursor: "pointer", fontFamily: "inherit",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => setDeleteId(o.id)}
                              title="Eliminar operación"
                              style={{
                                width: "30px", height: "30px", borderRadius: "7px",
                                border: "1px solid rgba(248,113,113,0.2)",
                                background: "rgba(248,113,113,0.08)",
                                color: "#f87171", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
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
          MODAL — NUEVA / EDITAR OPERACIÓN
      ════════════════════════════════════════════ */}
      {modal !== "none" && (
        <div onClick={closeModal} className="crm-modal-backdrop">
          <div
            onClick={e => e.stopPropagation()}
            className="crm-modal"
            style={{ maxWidth: "540px" }}
          >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0,
            }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>
                  {modal === "nuevo" ? "Nueva Operación" : "Editar Operación"}
                </h2>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, marginTop: "2px" }}>
                  {modal === "nuevo" ? "Registrá una nueva venta o alquiler" : "Modificá los datos de la operación"}
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

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ padding: "20px", overflowY: "auto" }}>

              {/* Fecha + Tipo */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Fecha *">
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={e => setF("fecha", e.target.value)}
                    style={inp}
                    required
                  />
                </Field>
                <Field label="Tipo *">
                  <select
                    value={form.tipo}
                    onChange={e => setF("tipo", e.target.value)}
                    style={inp}
                    required
                  >
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
              </div>

              {/* Dirección */}
              <Field label="Dirección *">
                <input
                  type="text"
                  value={form.direccion}
                  onChange={e => setF("direccion", e.target.value)}
                  placeholder="Av. San Martín 1250, Resistencia"
                  style={inp}
                  required
                />
              </Field>

              {/* Agentes */}
              <Field label="Agente(s) *">
                <input
                  type="text"
                  value={form.agentes}
                  onChange={e => setF("agentes", e.target.value)}
                  placeholder="Romina Prieto / Cecilia Frigerio"
                  style={inp}
                  required
                />
              </Field>

              {/* Moneda */}
              <Field label="Moneda de comisiones">
                <div style={{ display: "flex", gap: "8px" }}>
                  {(["USD", "ARS"] as const).map(m => (
                    <button key={m} type="button" onClick={() => setF("moneda", m)} style={{
                      padding: "7px 20px", borderRadius: "8px", border: "1.5px solid",
                      borderColor: form.moneda === m ? "#E31837" : "rgba(255,255,255,0.1)",
                      background: form.moneda === m ? "rgba(227,24,55,0.12)" : "rgba(255,255,255,0.06)",
                      color: form.moneda === m ? "#E11D48" : "rgba(255,255,255,0.5)",
                      fontWeight: 700, fontSize: "13px", cursor: "pointer", fontFamily: "inherit",
                    }}>{m}</button>
                  ))}
                </div>
              </Field>
              {form.moneda === "ARS" && (
                <Field label="Tipo de cambio (ARS/USD) *">
                  <input type="number" value={form.tipo_cambio} min="1" step="1"
                    onChange={e => setF("tipo_cambio", e.target.value)}
                    placeholder="1200" style={inp} required />
                </Field>
              )}

              {/* Comisiones */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label={`Comisión bruta (${form.moneda})`}>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={form.comision_bruta}
                    onChange={e => setF("comision_bruta", e.target.value)}
                    placeholder={form.moneda === "ARS" ? "6000000" : "5000"}
                    style={inp}
                  />
                  {form.moneda === "ARS" && form.tipo_cambio && form.comision_bruta && (
                    <div style={{ fontSize: "11px", color: "#2dd4bf", marginTop: "4px", fontWeight: 600 }}>
                      ≈ USD {Math.round(parseFloat(form.comision_bruta) / parseFloat(form.tipo_cambio)).toLocaleString("es-AR")}
                    </div>
                  )}
                </Field>
                <Field label={`Comisión neta (${form.moneda})`}>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={form.comision_neta}
                    onChange={e => setF("comision_neta", e.target.value)}
                    placeholder={form.moneda === "ARS" ? "5100000" : "4250"}
                    style={inp}
                  />
                </Field>
              </div>

              {/* Encuestas */}
              <Field label="Encuestas">
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <Toggle
                    value={form.encuesta_comprador}
                    onChange={v => setF("encuesta_comprador", v)}
                    label="Encuesta comprador"
                  />
                  <Toggle
                    value={form.encuesta_vendedor}
                    onChange={v => setF("encuesta_vendedor", v)}
                    label="Encuesta vendedor"
                  />
                </div>
              </Field>

              {/* Error */}
              {error && (
                <div style={{
                  background: "rgba(227,24,55,0.12)", border: "1px solid rgba(227,24,55,0.25)",
                  borderRadius: "8px", padding: "10px 12px",
                  fontSize: "12.5px", color: "#ff8a9a", marginBottom: "14px",
                }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={closeModal} disabled={isPending}
                  style={{
                    padding: "9px 20px", borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
                    fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.5)",
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
                  {isPending ? "Guardando..." : modal === "nuevo" ? "Crear operación" : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          MODAL — CONFIRMAR ELIMINACIÓN
      ════════════════════════════════════════════ */}
      {deleteId !== null && (
        <div onClick={() => { if (!isPending) setDeleteId(null) }} className="crm-modal-backdrop">
          <div
            onClick={e => e.stopPropagation()}
            className="crm-modal"
            style={{ maxWidth: "420px" }}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0,
            }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>
                  Eliminar operación
                </h2>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, marginTop: "2px" }}>
                  Esta acción no se puede deshacer.
                </p>
              </div>
              <button onClick={() => setDeleteId(null)} disabled={isPending} style={{
                background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "8px",
                width: "32px", height: "32px", display: "flex",
                alignItems: "center", justifyContent: "center",
                cursor: isPending ? "not-allowed" : "pointer", color: "rgba(255,255,255,0.5)",
              }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: "20px" }}>
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.65)", margin: "0 0 20px" }}>
                ¿Eliminar esta operación? Esta acción no se puede deshacer.
              </p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setDeleteId(null)} disabled={isPending} style={{
                  padding: "9px 20px", borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
                  fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.5)",
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  Cancelar
                </button>
                <button type="button" onClick={handleDelete} disabled={isPending} style={{
                  padding: "9px 24px", borderRadius: "8px", border: "none",
                  background: isPending ? "#CBD5E1" : "#dc2626",
                  color: "white", fontSize: "13px", fontWeight: 700,
                  cursor: isPending ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: "6px",
                  boxShadow: isPending ? "none" : "0 2px 8px rgba(220,38,38,0.3)",
                }}>
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  {isPending ? "Eliminando..." : "Sí, eliminar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
