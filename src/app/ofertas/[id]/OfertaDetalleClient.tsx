"use client"

import { useState, useTransition, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cambiarEstado, agregarMovimiento, toggleChecklist, registrarCierre } from "../actions"
import {
  ArrowLeft, X, Loader2, ChevronRight,
  DollarSign, Calendar, User, FileText, CheckSquare, Clock,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────
export interface AgenteSimple {
  id:     string
  nombre: string
}

export interface OfertaDetalle {
  id:                       string
  numero:                   number
  agente_vendedor_id:       string | null
  agente_comprador_id:      string | null
  agente_vendedor_externo:  string | null
  agente_comprador_externo: string | null
  direccion:                string
  tipologia:                string
  tipo_operacion:           string
  tiene_reserva:            boolean
  monto_reserva_usd:        number | null
  monto_refuerzo_usd:       number | null
  monto_ofertado_usd:       number | null
  precio_publicacion_usd:   number | null
  precio_acordado_usd:      number | null
  valor_escritura_usd:      number | null
  fecha_oferta:             string | null
  fecha_cierre:             string | null
  estado:                   string
  es_bis:                   boolean
  numero_padre:             number | null
  comision_cobrada:         boolean
  checklist_completado:     boolean
  notas:                    string | null
}

export interface HistorialItem {
  id:          string
  oferta_id:   string
  tipo:        string
  descripcion: string
  monto_usd:   number | null
  created_at:  string
}

export interface ChecklistItem {
  id:          string
  oferta_id:   string
  item:        string
  completado:  boolean
  orden:       number
}

// ── Constants ─────────────────────────────────────────
const ESTADOS = [
  "Espera rta. vendedor",
  "Espera rta. comprador",
  "Aceptadas / Pre cierre",
  "Cerradas",
  "Caídas",
] as const

const TIPOS_MOVIMIENTO = [
  "Contraoferta", "Rechazo", "Aceptación",
  "Seña", "Refuerzo", "Nota", "Otro",
] as const

const ESTADO_STYLE: Record<string, { bg: string; color: string }> = {
  "Espera rta. vendedor":    { bg: "rgba(96,165,250,0.12)", color: "#60a5fa" },
  "Espera rta. comprador":   { bg: "rgba(250,204,21,0.12)", color: "#facc15" },
  "Aceptadas / Pre cierre":  { bg: "rgba(251,146,60,0.12)", color: "#fb923c" },
  "Cerradas":                { bg: "rgba(74,222,128,0.12)", color: "#4ade80" },
  "Caídas":                  { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" },
}

const TIPO_MOV_STYLE: Record<string, { bg: string; color: string }> = {
  Alta:             { bg: "rgba(74,222,128,0.12)", color: "#4ade80" },
  "Cambio de estado":{ bg: "rgba(96,165,250,0.12)", color: "#60a5fa" },
  Contraoferta:     { bg: "rgba(250,204,21,0.12)", color: "#facc15" },
  Rechazo:          { bg: "rgba(248,113,113,0.12)", color: "#f87171" },
  Aceptación:       { bg: "rgba(74,222,128,0.12)", color: "#4ade80" },
  Seña:             { bg: "rgba(45,212,191,0.12)", color: "#2dd4bf" },
  Refuerzo:         { bg: "rgba(45,212,191,0.12)", color: "#2dd4bf" },
  Nota:             { bg: "rgba(167,139,250,0.12)", color: "#a78bfa" },
  Otro:             { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" },
}

const CHECKLIST_CATS: Array<{ id: "pre_sena" | "documentacion" | "post_cierre"; label: string; from: number; to: number }> = [
  { id: "pre_sena",      label: "Pre-seña",      from: 1,  to: 12 },
  { id: "documentacion", label: "Documentación", from: 13, to: 22 },
  { id: "post_cierre",   label: "Post-cierre",   from: 23, to: 36 },
]

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]

// ── Helpers ───────────────────────────────────────────
function fmtUSD(n: number | null | undefined): string {
  if (n == null) return "—"
  return `USD ${Math.round(n).toLocaleString("es-AR")}`
}

function fmtFecha(s: string | null): string {
  if (!s) return "—"
  const [a, m, d] = s.split("-")
  return `${parseInt(d)} ${MONTH_NAMES[parseInt(m) - 1]} ${a}`
}

function fmtDateTime(s: string): string {
  const d = new Date(s)
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function pctNeg(ofertado: number | null, publicacion: number | null): string {
  if (!ofertado || !publicacion || publicacion === 0) return "—"
  return `${(((publicacion - ofertado) / publicacion) * 100).toFixed(1)}%`
}

// ── Sub-components ────────────────────────────────────
function EstadoBadge({ estado, large }: { estado: string; large?: boolean }) {
  const s = ESTADO_STYLE[estado] ?? { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }
  return (
    <span style={{
      ...s,
      padding: large ? "6px 16px" : "3px 9px",
      borderRadius: "20px",
      fontSize: large ? "13px" : "11px",
      fontWeight: 700, whiteSpace: "nowrap" as const,
    }}>
      {estado}
    </span>
  )
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", fontWeight: 600, minWidth: "180px", flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: "13px", color: "#f1f5f9", fontWeight: 500 }}>
        {value}
      </span>
    </div>
  )
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#13131a", borderRadius: "14px",
      border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden",
      marginBottom: "16px",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        <div style={{
          width: "28px", height: "28px", borderRadius: "8px",
          background: "linear-gradient(135deg,#E31837 0%,#c0122d 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9" }}>{title}</span>
      </div>
      <div style={{ padding: "0 20px 4px" }}>
        {children}
      </div>
    </div>
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

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
interface Props {
  oferta:   OfertaDetalle
  historial: HistorialItem[]
  checklist: ChecklistItem[]
  agentes:  AgenteSimple[]
}

export default function OfertaDetalleClient({ oferta, historial, checklist, agentes }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Agent lookup ───────────────────────────────────
  const agenteMap = new Map(agentes.map(a => [a.id, a.nombre]))
  function agenteName(id: string | null, externo: string | null): string {
    if (id)      return agenteMap.get(id) ?? "Desconocido"
    if (externo) return `${externo} (ext.)`
    return "Sin agente"
  }

  // ── Checklist local state (optimistic) ─────────────
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>(
    () => Object.fromEntries(checklist.map(ci => [ci.id, ci.completado])),
  )
  const totalItems    = checklist.length
  const doneItems     = Object.values(checklistState).filter(Boolean).length

  async function handleToggle(ci: ChecklistItem) {
    const newVal = !checklistState[ci.id]
    setChecklistState(prev => ({ ...prev, [ci.id]: newVal }))
    const result = await toggleChecklist(ci.id, oferta.id, newVal)
    if (result.error) {
      setChecklistState(prev => ({ ...prev, [ci.id]: !newVal }))
    }
  }

  // ── Modal: Cambiar estado ──────────────────────────
  const [modalEstado, setModalEstado]   = useState(false)
  const [nuevoEstado,  setNuevoEstado]  = useState(oferta.estado)
  const [descEstado,   setDescEstado]   = useState("")
  const [montoEstado,  setMontoEstado]  = useState("")
  const [errEstado,    setErrEstado]    = useState("")

  // ── Modal: Agregar movimiento ──────────────────────
  const [modalMov,   setModalMov]    = useState(false)
  const [tipoMov,    setTipoMov]     = useState<string>("Nota")
  const [descMov,    setDescMov]     = useState("")
  const [montoMov,   setMontoMov]    = useState("")
  const [errMov,     setErrMov]      = useState("")

  // ── Modal: Registrar cierre ────────────────────────
  const [modalCierre,    setModalCierre]    = useState(false)
  const [cierreFecha,    setCierreFecha]    = useState("")
  const [cierrePrecio,   setCierrePrecio]   = useState("")
  const [cierreComision, setCierreComision] = useState("")
  const [errCierre,      setErrCierre]      = useState("")

  const closeAll = useCallback(() => {
    setModalEstado(false)
    setModalMov(false)
    setModalCierre(false)
    setErrEstado("")
    setErrMov("")
    setErrCierre("")
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeAll() }
    if (modalEstado || modalMov || modalCierre) document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [modalEstado, modalMov, modalCierre, closeAll])

  // ── Submit: cambiar estado ─────────────────────────
  function handleSubmitEstado(e: React.FormEvent) {
    e.preventDefault()
    if (nuevoEstado === "Cerradas") {
      setCierreFecha(new Date().toISOString().split("T")[0])
      setCierrePrecio("")
      setCierreComision("")
      setErrCierre("")
      setModalEstado(false)
      setModalCierre(true)
      return
    }
    if (!descEstado.trim()) { setErrEstado("La descripción es obligatoria"); return }
    startTransition(async () => {
      const result = await cambiarEstado(
        oferta.id,
        nuevoEstado,
        descEstado.trim(),
        montoEstado ? parseFloat(montoEstado) : null,
      )
      if (result.error) { setErrEstado(result.error); return }
      closeAll()
      router.refresh()
    })
  }

  // ── Submit: agregar movimiento ─────────────────────
  function handleSubmitMov(e: React.FormEvent) {
    e.preventDefault()
    if (!descMov.trim()) { setErrMov("La descripción es obligatoria"); return }
    startTransition(async () => {
      const result = await agregarMovimiento(
        oferta.id,
        tipoMov,
        descMov.trim(),
        montoMov ? parseFloat(montoMov) : null,
      )
      if (result.error) { setErrMov(result.error); return }
      setDescMov("")
      setMontoMov("")
      closeAll()
      router.refresh()
    })
  }

  // ── Submit: registrar cierre ───────────────────────
  function handleSubmitCierre(e: React.FormEvent) {
    e.preventDefault()
    const precio   = parseFloat(cierrePrecio)
    const comision = parseFloat(cierreComision)
    if (isNaN(precio) || isNaN(comision)) { setErrCierre("Precio y comisión son obligatorios"); return }
    const vName = agenteName(oferta.agente_vendedor_id, oferta.agente_vendedor_externo)
    const cName = agenteName(oferta.agente_comprador_id, oferta.agente_comprador_externo)
    const parts: string[] = []
    if (vName !== "Sin agente") parts.push(vName)
    if (cName !== "Sin agente" && cName !== vName) parts.push(cName)
    startTransition(async () => {
      const result = await registrarCierre(
        oferta.id,
        cierreFecha,
        precio,
        comision,
        oferta.direccion,
        oferta.tipo_operacion,
        parts.join(" / "),
      )
      if (result.error) { setErrCierre(result.error); return }
      closeAll()
      router.refresh()
    })
  }

  // ── seña total ─────────────────────────────────────
  const seniaTotal = (oferta.monto_reserva_usd ?? 0) + (oferta.monto_refuerzo_usd ?? 0)

  // ═══════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Header ──────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        minHeight: "70px", padding: "0 24px",
        background: "rgba(10,10,26,0.8)", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0,
        gap: "16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Link href="/ofertas" style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "34px", height: "34px", borderRadius: "9px",
            border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.5)", textDecoration: "none",
          }}
            className="hover:bg-[rgba(255,255,255,0.05)]"
          >
            <ArrowLeft size={16} />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "rgba(255,255,255,0.35)", fontSize: "12px" }}>
            <Link href="/ofertas" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>Ofertas</Link>
            <ChevronRight size={12} />
            <span style={{ color: "#f1f5f9", fontWeight: 600 }}>#{oferta.numero}</span>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h1 style={{ fontSize: "18px", fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.3px", margin: 0 }}>
                Oferta #{oferta.numero}
              </h1>
              <EstadoBadge estado={oferta.estado} large />
            </div>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, marginTop: "2px" }}>
              {oferta.direccion}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setNuevoEstado(oferta.estado); setDescEstado(""); setMontoEstado(""); setModalEstado(true) }}
          style={{
            background: "linear-gradient(135deg,#E31837 0%,#c0122d 100%)",
            color: "white", border: "none",
            padding: "8px 18px", borderRadius: "9px",
            fontSize: "13px", fontWeight: 700, cursor: "pointer",
            boxShadow: "0 2px 10px rgba(227,24,55,0.35)",
            fontFamily: "inherit", flexShrink: 0,
          }}
        >
          Cambiar estado
        </button>
      </div>

      {/* ── Content ─────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>

        {/* ── Sección 1: Datos de la oferta ─────────── */}
        <SectionCard title="Datos de la oferta" icon={<FileText size={14} color="white" />}>
          <DataRow label="Agente vendedor"
            value={agenteName(oferta.agente_vendedor_id, oferta.agente_vendedor_externo)} />
          <DataRow label="Agente comprador"
            value={agenteName(oferta.agente_comprador_id, oferta.agente_comprador_externo)} />
          <DataRow label="Tipología" value={
            <span style={{
              padding: "2px 8px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
              background: "rgba(96,165,250,0.12)", color: "#60a5fa",
            }}>{oferta.tipologia}</span>
          } />
          <DataRow label="Tipo de operación" value={oferta.tipo_operacion} />

          <div style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.35)", marginBottom: "10px" }}>
              Montos
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px" }}>
              {[
                { label: "Monto ofertado",    val: oferta.monto_ofertado_usd },
                { label: "Precio publicación", val: oferta.precio_publicacion_usd },
                { label: "% Negociación",      val: null, text: pctNeg(oferta.monto_ofertado_usd, oferta.precio_publicacion_usd) },
                { label: "Precio acordado",    val: oferta.precio_acordado_usd },
                { label: "Valor escritura",    val: oferta.valor_escritura_usd },
              ].map(({ label, val, text }) => (
                <div key={label} style={{
                  background: "rgba(255,255,255,0.06)", borderRadius: "10px", padding: "10px 12px",
                }}>
                  <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.35)", fontWeight: 600, marginBottom: "4px" }}>{label}</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9" }}>
                    {text ?? fmtUSD(val)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {oferta.tiene_reserva && (
            <div style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.35)", marginBottom: "10px" }}>
                Seña / Reserva
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px" }}>
                {[
                  { label: "Monto reserva",  val: oferta.monto_reserva_usd },
                  { label: "Monto refuerzo", val: oferta.monto_refuerzo_usd },
                  { label: "Seña total",     val: seniaTotal || null },
                ].map(({ label, val }) => (
                  <div key={label} style={{
                    background: "rgba(74,222,128,0.12)", borderRadius: "10px", padding: "10px 12px",
                  }}>
                    <div style={{ fontSize: "10.5px", color: "#4ade80", fontWeight: 600, marginBottom: "4px" }}>{label}</div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#4ade80" }}>
                      {fmtUSD(val)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DataRow label="Fecha de oferta"  value={fmtFecha(oferta.fecha_oferta)} />
          <DataRow label="Fecha de cierre"  value={fmtFecha(oferta.fecha_cierre)} />
          <DataRow label="Es BIS"           value={oferta.es_bis ? `Sí (padre: #${oferta.numero_padre ?? "—"})` : "No"} />
          <DataRow label="Comisión cobrada" value={oferta.comision_cobrada ? "Sí" : "No"} />
          {oferta.notas && (
            <DataRow label="Notas" value={
              <span style={{ whiteSpace: "pre-wrap", fontSize: "13px", color: "#f1f5f9" }}>
                {oferta.notas}
              </span>
            } />
          )}
        </SectionCard>

        {/* ── Sección 2: Historial ──────────────────── */}
        <SectionCard title="Historial de movimientos" icon={<Clock size={14} color="white" />}>
          <div style={{ padding: "8px 0" }}>
            {historial.length === 0 ? (
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", padding: "16px 0" }}>Sin movimientos registrados.</p>
            ) : (
              <div style={{ position: "relative" }}>
                <div style={{
                  position: "absolute", left: "11px", top: 0, bottom: 0,
                  width: "2px", background: "rgba(255,255,255,0.08)",
                }} />
                {historial.map(h => {
                  const s = TIPO_MOV_STYLE[h.tipo] ?? TIPO_MOV_STYLE.Otro
                  return (
                    <div key={h.id} style={{ display: "flex", gap: "16px", marginBottom: "16px", position: "relative" }}>
                      <div style={{
                        width: "24px", height: "24px", borderRadius: "50%",
                        background: s.bg, border: `2px solid ${s.color}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, zIndex: 1,
                      }}>
                        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: s.color }} />
                      </div>
                      <div style={{ flex: 1, paddingTop: "2px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" as const }}>
                          <span style={{
                            ...s, padding: "2px 8px", borderRadius: "12px",
                            fontSize: "10.5px", fontWeight: 700,
                          }}>
                            {h.tipo}
                          </span>
                          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{fmtDateTime(h.created_at)}</span>
                          {h.monto_usd != null && (
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#4ade80" }}>
                              {fmtUSD(h.monto_usd)}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: "13px", color: "#f1f5f9", margin: 0 }}>{h.descripcion}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "12px 0 8px" }}>
            <button
              onClick={() => { setDescMov(""); setMontoMov(""); setTipoMov("Nota"); setModalMov(true) }}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "7px 16px", borderRadius: "8px",
                border: "1.5px solid #E31837", background: "rgba(227,24,55,0.08)",
                fontSize: "12px", fontWeight: 700, color: "#E31837",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              + Agregar movimiento
            </button>
          </div>
        </SectionCard>

        {/* ── Sección 3: Checklist (solo Venta) ─────── */}
        {oferta.tipo_operacion === "Venta" && checklist.length > 0 && (
          <SectionCard title="Checklist de cierre" icon={<CheckSquare size={14} color="white" />}>
            {/* Progreso */}
            <div style={{ padding: "14px 0 10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#f1f5f9" }}>
                  {doneItems} / {totalItems} completados
                </span>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
                  {totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0}%
                </span>
              </div>
              <div style={{
                width: "100%", height: "8px", borderRadius: "4px",
                background: "rgba(255,255,255,0.1)", overflow: "hidden",
              }}>
                <div style={{
                  width: `${totalItems > 0 ? (doneItems / totalItems) * 100 : 0}%`,
                  height: "100%", borderRadius: "4px",
                  background: doneItems === totalItems ? "#059669" : "#2563EB",
                  transition: "width 0.3s ease",
                }} />
              </div>
            </div>

            {/* Items por categoría */}
            {CHECKLIST_CATS.map(cat => {
              const items = checklist.filter(ci => ci.orden >= cat.from && ci.orden <= cat.to)
              if (items.length === 0) return null
              return (
                <div key={cat.id} style={{ marginBottom: "16px" }}>
                  <div style={{
                    fontSize: "10.5px", fontWeight: 700, letterSpacing: "1px",
                    textTransform: "uppercase" as const, color: "rgba(255,255,255,0.35)",
                    marginBottom: "8px", marginTop: "4px",
                  }}>
                    {cat.label}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {items.map(ci => {
                      const done = checklistState[ci.id] ?? ci.completado
                      return (
                        <button
                          key={ci.id}
                          onClick={() => handleToggle(ci)}
                          style={{
                            display: "flex", alignItems: "center", gap: "10px",
                            padding: "8px 10px", borderRadius: "8px",
                            background: done ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.04)",
                            border: `1.5px solid ${done ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.1)"}`,
                            cursor: "pointer", fontFamily: "inherit",
                            textAlign: "left" as const, width: "100%",
                            transition: "all 0.15s",
                          }}
                        >
                          <div style={{
                            width: "18px", height: "18px", borderRadius: "5px",
                            border: `2px solid ${done ? "#059669" : "rgba(255,255,255,0.2)"}`,
                            background: done ? "#059669" : "rgba(255,255,255,0.06)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, transition: "all 0.15s",
                          }}>
                            {done && <span style={{ color: "white", fontSize: "11px", fontWeight: 700 }}>✓</span>}
                          </div>
                          <span style={{
                            fontSize: "12.5px", color: done ? "#4ade80" : "#f1f5f9",
                            fontWeight: done ? 600 : 400,
                            textDecoration: done ? "line-through" : "none",
                          }}>
                            {ci.item}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </SectionCard>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          MODAL — CAMBIAR ESTADO
      ══════════════════════════════════════════════ */}
      {modalEstado && (
        <div
          onClick={closeAll}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: "20px",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "rgba(12,12,36,0.97)", borderRadius: "16px",
              width: "100%", maxWidth: "480px",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>Cambiar estado</h2>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, marginTop: "2px" }}>
                  Oferta #{oferta.numero} — {oferta.direccion}
                </p>
              </div>
              <button onClick={closeAll} style={{
                background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "8px",
                width: "32px", height: "32px", display: "flex",
                alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "rgba(255,255,255,0.5)",
              }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmitEstado} style={{ padding: "20px" }}>
              <Field label="Nuevo estado *">
                <select value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value)} style={inp} required>
                  {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </Field>
              <Field label="Descripción *">
                <textarea value={descEstado} onChange={e => setDescEstado(e.target.value)}
                  rows={3} placeholder="¿Qué pasó? Describí el motivo del cambio..."
                  style={{ ...inp, resize: "vertical" as const }} required />
              </Field>
              <Field label="Monto (USD, opcional)">
                <input type="number" value={montoEstado} onChange={e => setMontoEstado(e.target.value)}
                  min="0" step="100" placeholder="Si hubo movimiento de dinero" style={inp} />
              </Field>
              {errEstado && (
                <div style={{
                  background: "rgba(227,24,55,0.12)", border: "1px solid rgba(227,24,55,0.25)",
                  borderRadius: "8px", padding: "10px 12px",
                  fontSize: "12.5px", color: "#ff8a9a", marginBottom: "14px",
                }}>
                  ⚠️ {errEstado}
                </div>
              )}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={closeAll} disabled={isPending}
                  style={{
                    padding: "9px 20px", borderRadius: "8px",
                    border: "1.5px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
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
                    fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px",
                    boxShadow: isPending ? "none" : "0 2px 8px rgba(227,24,55,0.3)",
                  }}>
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  {isPending ? "Guardando..." : "Confirmar cambio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          MODAL — AGREGAR MOVIMIENTO
      ══════════════════════════════════════════════ */}
      {modalMov && (
        <div
          onClick={closeAll}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: "20px",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "rgba(12,12,36,0.97)", borderRadius: "16px",
              width: "100%", maxWidth: "480px",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>Agregar movimiento</h2>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, marginTop: "2px" }}>
                  Registrá un evento en el historial de la oferta
                </p>
              </div>
              <button onClick={closeAll} style={{
                background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "8px",
                width: "32px", height: "32px", display: "flex",
                alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "rgba(255,255,255,0.5)",
              }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmitMov} style={{ padding: "20px" }}>
              <Field label="Tipo *">
                <select value={tipoMov} onChange={e => setTipoMov(e.target.value)} style={inp} required>
                  {TIPOS_MOVIMIENTO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Descripción *">
                <textarea value={descMov} onChange={e => setDescMov(e.target.value)}
                  rows={3} placeholder="Describí el movimiento..."
                  style={{ ...inp, resize: "vertical" as const }} required />
              </Field>
              <Field label="Monto (USD, opcional)">
                <input type="number" value={montoMov} onChange={e => setMontoMov(e.target.value)}
                  min="0" step="100" placeholder="Si hubo movimiento de dinero" style={inp} />
              </Field>
              {errMov && (
                <div style={{
                  background: "rgba(227,24,55,0.12)", border: "1px solid rgba(227,24,55,0.25)",
                  borderRadius: "8px", padding: "10px 12px",
                  fontSize: "12.5px", color: "#ff8a9a", marginBottom: "14px",
                }}>
                  ⚠️ {errMov}
                </div>
              )}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={closeAll} disabled={isPending}
                  style={{
                    padding: "9px 20px", borderRadius: "8px",
                    border: "1.5px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
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
                    fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px",
                    boxShadow: isPending ? "none" : "0 2px 8px rgba(227,24,55,0.3)",
                  }}>
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  {isPending ? "Guardando..." : "Registrar movimiento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          MODAL — REGISTRAR CIERRE
      ══════════════════════════════════════════════ */}
      {modalCierre && (
        <div
          onClick={closeAll}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: "20px",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "rgba(12,12,36,0.97)", borderRadius: "16px",
              width: "100%", maxWidth: "520px",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>Registrar cierre</h2>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, marginTop: "2px" }}>
                  Oferta #{oferta.numero} — completá los datos de la operación
                </p>
              </div>
              <button onClick={closeAll} style={{
                background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "8px",
                width: "32px", height: "32px", display: "flex",
                alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "rgba(255,255,255,0.5)",
              }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmitCierre} style={{ padding: "20px" }}>
              <Field label="Fecha de cierre *">
                <input type="date" value={cierreFecha} onChange={e => setCierreFecha(e.target.value)}
                  style={{ ...inp, colorScheme: "dark" as const }} required />
              </Field>
              <Field label="Precio de cierre (USD) *">
                <input type="number" value={cierrePrecio} onChange={e => setCierrePrecio(e.target.value)}
                  min="0" placeholder="0" style={inp} required />
              </Field>
              <Field label="Comisión total (USD) *">
                <input type="number" value={cierreComision} onChange={e => setCierreComision(e.target.value)}
                  min="0" placeholder="0" style={inp} required />
              </Field>
              {errCierre && (
                <div style={{
                  background: "rgba(227,24,55,0.12)", border: "1px solid rgba(227,24,55,0.25)",
                  borderRadius: "8px", padding: "10px 12px",
                  fontSize: "12.5px", color: "#ff8a9a", marginBottom: "14px",
                }}>
                  ⚠️ {errCierre}
                </div>
              )}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={closeAll} disabled={isPending}
                  style={{
                    padding: "9px 20px", borderRadius: "8px",
                    border: "1.5px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
                    fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.5)",
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                  Cancelar
                </button>
                <button type="submit" disabled={isPending}
                  style={{
                    padding: "9px 24px", borderRadius: "8px", border: "none",
                    background: isPending ? "#CBD5E1" : "linear-gradient(135deg,#4ade80 0%,#22c55e 100%)",
                    color: isPending ? "#666" : "#0a1a0a", fontSize: "13px", fontWeight: 700,
                    cursor: isPending ? "not-allowed" : "pointer",
                    fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px",
                    boxShadow: isPending ? "none" : "0 2px 8px rgba(74,222,128,0.3)",
                  }}>
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  {isPending ? "Guardando..." : "Registrar cierre"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
