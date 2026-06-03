"use client"

import { useState, useMemo, useTransition, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import KpiCard from "@/components/KpiCard"
import { crearOperacion, actualizarOperacion } from "./actions"
import type { OperacionFormData } from "./actions"
import { Building2, DollarSign, BarChart2, X, Loader2 } from "lucide-react"

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

const TIPOS = ["Venta", "Alquiler", "Alquiler Temporal", "Referido", "Otro"]

const TIPO_STYLES: Record<string, { bg: string; color: string }> = {
  Venta:               { bg: "#EFF6FF", color: "#2563EB" },
  Alquiler:            { bg: "#ECFDF5", color: "#059669" },
  "Alquiler Temporal": { bg: "#F0FDFA", color: "#0D9488" },
  Referido:            { bg: "#F5F3FF", color: "#7C3AED" },
  Otro:                { bg: "#F1F5F9", color: "#64748B" },
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
      background: done ? "#ECFDF5" : "#FFF1F2",
      color: done ? "#059669" : "#E11D48",
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
        border: `1.5px solid ${value ? "#6EE7B7" : "#EAECF2"}`,
        background: value ? "#ECFDF5" : "white",
        cursor: "pointer", fontFamily: "inherit",
        transition: "all 0.15s",
      }}
    >
      {/* pill */}
      <div style={{
        width: "36px", height: "20px", borderRadius: "10px",
        background: value ? "#059669" : "#CBD5E1",
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
      <span style={{ fontSize: "13px", color: value ? "#059669" : "#64748B", fontWeight: 500 }}>
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

const todayStr = new Date().toISOString().split("T")[0]
const currentMonth = (() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
})()

const EMPTY_FORM: FormData = {
  fecha:              todayStr,
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
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)

  // ── Modal ──────────────────────────────────────────
  type ModalT = "none" | "nuevo" | "editar"
  const [modal,       setModal]      = useState<ModalT>("none")
  const [selectedOp,  setSelectedOp] = useState<OperacionRow | null>(null)
  const [form,        setForm]       = useState<FormData>(EMPTY_FORM)
  const [error,       setError]      = useState("")

  // ── Computed ───────────────────────────────────────
  const filteredOps = useMemo(() => {
    if (selectedMonth === "todos") return operaciones
    return operaciones.filter(o => o.fecha.substring(0, 7) === selectedMonth)
  }, [operaciones, selectedMonth])

  const stats = useMemo(() => {
    const total            = filteredOps.length
    const totalComisiones  = filteredOps.reduce((s, o) => s + Number(o.comision_bruta), 0)
    const withBoth         = filteredOps.filter(o => o.encuesta_comprador && o.encuesta_vendedor).length
    const pctEncuestas     = total > 0 ? Math.round((withBoth / total) * 100) : 0
    const ventas           = filteredOps.filter(o => o.tipo === "Venta").length
    const alquileres       = filteredOps.filter(o => o.tipo.includes("Alquiler")).length
    return { total, totalComisiones, pctEncuestas, withBoth, ventas, alquileres }
  }, [filteredOps])

  // ── Keyboard ───────────────────────────────────────
  const closeModal = useCallback(() => { setModal("none"); setError("") }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal() }
    if (modal !== "none") document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [modal, closeModal])

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
            Operaciones
          </h1>
          <p style={{ fontSize: "12px", color: "#64748B", margin: 0, marginTop: "1px" }}>
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
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
            icon={<Building2 size={18} />}
          />
          <KpiCard
            title="Comisiones brutas"
            value={fmtUSD(stats.totalComisiones)}
            badge="total del período"
            iconBg="bg-teal-50"
            iconColor="text-teal-600"
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
          </div>
          <span style={{ fontSize: "12px", color: "#94A3B8" }}>
            {filteredOps.length} operación{filteredOps.length !== 1 ? "es" : ""}
          </span>
        </div>

        {/* ── Tabla ────────────────────────────────── */}
        <div style={cardStyle}>
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "14px 20px", borderBottom: "1px solid #EAECF2",
          }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E31837" }} />
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
              Historial de operaciones
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8F9FC", borderBottom: "1px solid #EAECF2" }}>
                  {["Fecha","Dirección","Agente(s)","Tipo","Comisión Bruta",""].map(h => (
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
                {filteredOps.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "48px 40px", textAlign: "center" }}>
                      <div style={{ fontSize: "28px", marginBottom: "10px", opacity: 0.4 }}>🏠</div>
                      <div style={{ fontWeight: 600, fontSize: "14px", color: "#64748B", marginBottom: "4px" }}>
                        Sin operaciones en este período
                      </div>
                      <div style={{ fontSize: "12px", color: "#94A3B8" }}>
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
                        style={{ borderBottom: isLast ? "none" : "1px solid #F3F4F6" }}
                        className="hover:bg-[#FAFBFF]"
                      >
                        <td style={{ padding: "12px 16px", fontSize: "12px", color: "#64748B", whiteSpace: "nowrap" }}>
                          {fmtFecha(o.fecha)}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", color: "#0F172A", maxWidth: "200px" }}>
                          <span title={o.direccion} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {o.direccion}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "12px", color: "#64748B", maxWidth: "160px" }}>
                          <span title={o.agentes} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {o.agentes}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <TipoBadge tipo={o.tipo} />
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap" }}>
                          {fmtUSD(Number(o.comision_bruta))}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <button
                            onClick={() => openEditar(o)}
                            style={{
                              padding: "5px 14px", borderRadius: "7px",
                              border: "1.5px solid #EAECF2", background: "white",
                              fontSize: "12px", fontWeight: 600, color: "#0F172A",
                              cursor: "pointer", fontFamily: "inherit",
                              whiteSpace: "nowrap",
                            }}
                            className="hover:bg-[#F8F9FC]"
                          >
                            Editar
                          </button>
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
              width: "100%", maxWidth: "540px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              maxHeight: "90vh", display: "flex", flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "18px 20px", borderBottom: "1px solid #EAECF2", flexShrink: 0,
            }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                  {modal === "nuevo" ? "Nueva Operación" : "Editar Operación"}
                </h2>
                <p style={{ fontSize: "12px", color: "#64748B", margin: 0, marginTop: "2px" }}>
                  {modal === "nuevo" ? "Registrá una nueva venta o alquiler" : "Modificá los datos de la operación"}
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
                      borderColor: form.moneda === m ? "#E31837" : "#EAECF2",
                      background: form.moneda === m ? "#FFF1F2" : "white",
                      color: form.moneda === m ? "#E11D48" : "#64748B",
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
                    <div style={{ fontSize: "11px", color: "#0D9488", marginTop: "4px", fontWeight: 600 }}>
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
                  background: "#FFF1F2", border: "1px solid #FECDD3",
                  borderRadius: "8px", padding: "10px 12px",
                  fontSize: "12.5px", color: "#E11D48", marginBottom: "14px",
                }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Actions */}
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
                  {isPending ? "Guardando..." : modal === "nuevo" ? "Crear operación" : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
