"use client"

import { useState, useMemo, useTransition, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import KpiCard from "@/components/KpiCard"
import { crearOperacion, actualizarOperacion, eliminarOperacion } from "./actions"
import type { OperacionFormData } from "./actions"
import { hoyArgentina } from "@/lib/fecha"
import { Building2, DollarSign, Loader2, Trash2 } from "lucide-react"
import Topbar from "@/components/Topbar"
import { fmtUSD } from "@/lib/format"
import { Backdrop, ModalHeader } from "@/components/Modal"

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
  tipo:               string
  moneda:             "USD" | "ARS"
  tipo_cambio:        string
  comision_bruta:     string
  encuesta_comprador: boolean
  encuesta_vendedor:  boolean
}

// ── Helpers ──────────────────────────────────────────
function cleanAgentes(raw: string, internos: Set<string>): string {
  return raw
    .split(" / ")
    .map(part => {
      const base = part.replace(/ \(ext\.\)$/, "").trim()
      return internos.has(base) ? base : part
    })
    .join(" / ")
}

function buildAgentesStr(
  vend: string, vendExt: string,
  comp: string, compExt: string,
  dosPuntas: boolean,
): string {
  const vName = vend === "Otra inmobiliaria" ? vendExt.trim() : vend
  if (dosPuntas) return vName ? `${vName} (2 puntas)` : ""
  const cName = comp === "Otra inmobiliaria" ? compExt.trim() : comp
  return [vName, cName].filter(Boolean).join(" / ")
}

function distanciaLevenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1]
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

function nombreParecidoAInterno(texto: string, internos: string[]): string | null {
  const t = normalizar(texto)
  if (t.length < 3) return null
  for (const nombre of internos) {
    const n = normalizar(nombre)
    const dist = distanciaLevenshtein(t, n)
    // Umbral: tolera diferencias chicas (tildes, 1-2 letras) relativas al largo del nombre
    if (dist > 0 && dist <= Math.max(2, Math.floor(n.length * 0.25))) {
      return nombre
    }
  }
  return null
}

function parseAgentesStr(raw: string, internos: Set<string>) {
  if (!raw || raw === "Sin agente") {
    return { vendedor: "", vendedorExt: "", comprador: "", compradorExt: "", dosPuntas: false }
  }
  if (raw.endsWith("(2 puntas)")) {
    const base = raw.replace(/ \(2 puntas\)$/, "").trim()
    return {
      vendedor:    internos.has(base) ? base : "Otra inmobiliaria",
      vendedorExt: internos.has(base) ? "" : base,
      comprador:   "",
      compradorExt:"",
      dosPuntas:   true,
    }
  }
  const parts = raw.split(" / ").map(s => s.trim())
  const p1 = parts[0] ?? ""
  const p2 = parts[1] ?? ""
  return {
    vendedor:    p1 ? (internos.has(p1) ? p1 : "Otra inmobiliaria") : "",
    vendedorExt: p1 && !internos.has(p1) ? p1 : "",
    comprador:   p2 ? (internos.has(p2) ? p2 : "Otra inmobiliaria") : "",
    compradorExt:p2 && !internos.has(p2) ? p2 : "",
    dosPuntas:   false,
  }
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
  color: "var(--crm-text)", outline: "none", background: "var(--crm-input-bg)",
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
        background: value ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.04)",
        cursor: "pointer", fontFamily: "inherit",
        transition: "all 0.15s",
      }}
    >
      {/* pill */}
      <div style={{
        width: "36px", height: "20px", borderRadius: "10px",
        background: value ? "#4ade80" : "rgba(255,255,255,0.2)",
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
      <span style={{ fontSize: "13px", color: value ? "#4ade80" : "rgba(255,255,255,0.45)", fontWeight: 500 }}>
        {label}: <strong>{value ? "Sí" : "No"}</strong>
      </span>
    </button>
  )
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
interface Props {
  operaciones:     OperacionRow[]
  agentesInternos: string[]
}

const EMPTY_FORM: FormData = {
  fecha:              "",
  direccion:          "",
  tipo:               "Venta",
  moneda:             "USD",
  tipo_cambio:        "",
  comision_bruta:     "",
  encuesta_comprador: false,
  encuesta_vendedor:  false,
}

export default function OperacionesClient({ operaciones, agentesInternos }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const internosSet = useMemo(() => new Set(agentesInternos), [agentesInternos])

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

  // ── Agentes por punta ──────────────────────────────
  const [vendedor,     setVendedor]     = useState("")
  const [vendedorExt,  setVendedorExt]  = useState("")
  const [comprador,    setComprador]    = useState("")
  const [compradorExt, setCompradorExt] = useState("")
  const [dosPuntas,    setDosPuntas]    = useState(false)
  const [avisoVendedorExt,  setAvisoVendedorExt]  = useState<string | null>(null)
  const [avisoCompradorExt, setAvisoCompradorExt] = useState<string | null>(null)

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
  const closeModal = useCallback(() => {
    setModal("none")
    setError("")
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { closeModal(); setDeleteId(null) }
    }
    if (modal !== "none" || deleteId !== null) document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [modal, closeModal, deleteId])

  // ── Open modals ────────────────────────────────────
  function openNuevo() {
    setForm({ ...EMPTY_FORM, fecha: hoyArgentina() })
    setVendedor(""); setVendedorExt("")
    setComprador(""); setCompradorExt("")
    setDosPuntas(false)
    setAvisoVendedorExt(null); setAvisoCompradorExt(null)
    setError("")
    setModal("nuevo")
  }

  function openEditar(o: OperacionRow) {
    setSelectedOp(o)
    const p = parseAgentesStr(o.agentes ?? "", internosSet)
    setVendedor(p.vendedor);     setVendedorExt(p.vendedorExt)
    setComprador(p.comprador);   setCompradorExt(p.compradorExt)
    setDosPuntas(p.dosPuntas)
    setAvisoVendedorExt(nombreParecidoAInterno(p.vendedorExt, agentesInternos))
    setAvisoCompradorExt(nombreParecidoAInterno(p.compradorExt, agentesInternos))
    setForm({
      fecha:              o.fecha,
      direccion:          o.direccion,
      tipo:               o.tipo,
      moneda:             "USD",
      tipo_cambio:        "",
      comision_bruta:     String(Number(o.comision_bruta)),
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

    const agentesStr = buildAgentesStr(vendedor, vendedorExt, comprador, compradorExt, dosPuntas)

    if (!form.direccion.trim()) { setError("La dirección es obligatoria"); return }
    if (!agentesStr)            { setError("El agente vendedor es obligatorio"); return }
    if (form.moneda === "ARS" && !form.tipo_cambio) { setError("Ingresá el tipo de cambio para convertir a USD"); return }

    const tc = parseFloat(form.tipo_cambio) || 1
    const brutoRaw = parseFloat(form.comision_bruta) || 0
    const brutoUSD = form.moneda === "ARS" ? Math.round(brutoRaw / tc * 100) / 100 : brutoRaw

    const payload: OperacionFormData = {
      fecha:              form.fecha,
      direccion:          form.direccion.trim(),
      agentes:            agentesStr,
      tipo:               form.tipo,
      comision_bruta:     brutoUSD,
      comision_neta:      brutoUSD,
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
    background: "var(--crm-surface-2)", borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden",
  }

  // ═══════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      <Topbar moduleName="Operaciones" />

      {/* ── Page Header ──────────────────────────── */}
      <div className="crm-page-header flex-shrink-0" style={{ justifyContent: "flex-end", position: "sticky", top: "62px", zIndex: 15 }}>
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
            title="Comisiones"
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
                fontWeight: 500, color: "var(--crm-text)", background: "var(--crm-input-bg)",
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
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--crm-text)" }}>
              Historial de operaciones
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["Fecha","Dirección","Agente(s)","Tipo","Comisión",""].map(h => (
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
                        <td style={{ padding: "12px 16px", fontSize: "13px", color: "var(--crm-text)", maxWidth: "200px" }}>
                          <span title={o.direccion} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {o.direccion}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "12px", color: "rgba(255,255,255,0.45)", maxWidth: "160px" }}>
                          <span title={cleanAgentes(o.agentes, internosSet)} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {cleanAgentes(o.agentes, internosSet)}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <TipoBadge tipo={o.tipo} />
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 600, color: "var(--crm-text)", whiteSpace: "nowrap" }}>
                          {fmtUSD(Number(o.comision_bruta))}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <button
                              onClick={() => openEditar(o)}
                              style={{
                                padding: "5px 14px", borderRadius: "7px",
                                border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
                                fontSize: "12px", fontWeight: 600, color: "var(--crm-text)",
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
        <Backdrop onClose={closeModal} className="crm-modal" style={{ maxWidth: "540px" }}>
          <ModalHeader
            title={modal === "nuevo" ? "Nueva Operación" : "Editar Operación"}
            subtitle={modal === "nuevo" ? "Registrá una nueva venta o alquiler" : "Modificá los datos de la operación"}
            onClose={closeModal}
          />

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
              <div style={{ marginBottom: "14px" }}>
                <div style={{
                  fontSize: "11px", fontWeight: 700, letterSpacing: "0.8px",
                  textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: "10px",
                }}>
                  Agentes
                </div>

                {/* Vendedor | Comprador */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "10px" }}>

                  {/* Agente Vendedor */}
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.35)", marginBottom: "5px" }}>
                      Agente Vendedor
                    </div>
                    <select
                      value={vendedor}
                      onChange={e => setVendedor(e.target.value)}
                      style={inp}
                    >
                      <option value="">— Sin asignar —</option>
                      {agentesInternos.map(n => <option key={n} value={n}>{n}</option>)}
                      <option value="Otra inmobiliaria">Otra inmobiliaria</option>
                    </select>
                    {vendedor === "Otra inmobiliaria" && (
                      <>
                        <input
                          type="text"
                          placeholder="Nombre de la inmobiliaria"
                          value={vendedorExt}
                          onChange={e => {
                            const val = e.target.value
                            setVendedorExt(val)
                            setAvisoVendedorExt(nombreParecidoAInterno(val, agentesInternos))
                          }}
                          style={{ ...inp, marginTop: "6px" }}
                        />
                        {avisoVendedorExt && (
                          <div style={{
                            marginTop: "6px", padding: "8px 10px", borderRadius: "7px",
                            background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)",
                            fontSize: "11.5px", color: "#fbbf24",
                          }}>
                            ⚠️ ¿Quisiste decir <strong>{avisoVendedorExt}</strong>? Verificá que no sea un agente interno mal escrito.
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Agente Comprador */}
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.35)", marginBottom: "5px" }}>
                      Agente Comprador
                    </div>
                    <select
                      value={dosPuntas ? vendedor : comprador}
                      onChange={e => setComprador(e.target.value)}
                      disabled={dosPuntas}
                      style={{ ...inp, opacity: dosPuntas ? 0.4 : 1, cursor: dosPuntas ? "not-allowed" : "pointer" }}
                    >
                      <option value="">— Sin asignar —</option>
                      {agentesInternos.map(n => <option key={n} value={n}>{n}</option>)}
                      <option value="Otra inmobiliaria">Otra inmobiliaria</option>
                    </select>
                    {!dosPuntas && comprador === "Otra inmobiliaria" && (
                      <>
                        <input
                          type="text"
                          placeholder="Nombre de la inmobiliaria"
                          value={compradorExt}
                          onChange={e => {
                            const val = e.target.value
                            setCompradorExt(val)
                            setAvisoCompradorExt(nombreParecidoAInterno(val, agentesInternos))
                          }}
                          style={{ ...inp, marginTop: "6px" }}
                        />
                        {avisoCompradorExt && (
                          <div style={{
                            marginTop: "6px", padding: "8px 10px", borderRadius: "7px",
                            background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)",
                            fontSize: "11.5px", color: "#fbbf24",
                          }}>
                            ⚠️ ¿Quisiste decir <strong>{avisoCompradorExt}</strong>? Verificá que no sea un agente interno mal escrito.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Checkbox 2 puntas */}
                <label style={{
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  cursor: "pointer", fontSize: "13px", color: "rgba(255,255,255,0.5)",
                  userSelect: "none",
                }}>
                  <input
                    type="checkbox"
                    checked={dosPuntas}
                    onChange={e => {
                      const checked = e.target.checked
                      setDosPuntas(checked)
                      if (checked) { setComprador(""); setCompradorExt(""); setAvisoCompradorExt(null) }
                    }}
                    style={{ accentColor: "#E31837", width: "15px", height: "15px", cursor: "pointer" }}
                  />
                  Mismo agente (2 puntas)
                </label>
              </div>

              {/* Moneda */}
              <Field label="Moneda de comisiones">
                <div style={{ display: "flex", gap: "8px" }}>
                  {(["USD", "ARS"] as const).map(m => (
                    <button key={m} type="button" onClick={() => setF("moneda", m)} style={{
                      padding: "7px 20px", borderRadius: "8px", border: "1.5px solid",
                      borderColor: form.moneda === m ? "#E31837" : "rgba(255,255,255,0.1)",
                      background: form.moneda === m ? "rgba(227,24,55,0.12)" : "rgba(255,255,255,0.06)",
                      color: form.moneda === m ? "var(--crm-accent)" : "rgba(255,255,255,0.5)",
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

              {/* Comisión */}
              <Field label={`Comisión (${form.moneda})`}>
                <input
                  type="number"
                  min="0"
                  step="any"
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
                  fontSize: "12.5px", color: "var(--crm-accent-light)", marginBottom: "14px",
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
                    background: isPending ? "rgba(255,255,255,0.15)" : "linear-gradient(135deg,#E31837 0%,var(--crm-accent-hover) 100%)",
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
        </Backdrop>
      )}

      {/* ════════════════════════════════════════════
          MODAL — CONFIRMAR ELIMINACIÓN
      ════════════════════════════════════════════ */}
      {deleteId !== null && (
        <Backdrop onClose={() => { if (!isPending) setDeleteId(null) }} className="crm-modal" style={{ maxWidth: "420px" }}>
          <ModalHeader
            title="Eliminar operación"
            subtitle="Esta acción no se puede deshacer."
            onClose={() => { if (!isPending) setDeleteId(null) }}
          />
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
                  background: isPending ? "rgba(255,255,255,0.15)" : "#dc2626",
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
        </Backdrop>
      )}
    </div>
  )
}
