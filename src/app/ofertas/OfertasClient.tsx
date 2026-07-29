"use client"

import { useState, useMemo, useTransition, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import KpiCard from "@/components/KpiCard"
import { crearOferta } from "./actions"
import type { OfertaFormData } from "./actions"
import {
  Handshake, TrendingUp, CheckCircle2, XCircle,
  X, Loader2, ChevronRight, Save,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────
export interface AgenteSimple {
  id:     string
  nombre: string
}

export interface OfertaRow {
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
  monto_ofertado_usd:       number | null
  precio_publicacion_usd:   number | null
  estado:                   string
  fecha_oferta:             string | null
  es_bis:                   boolean
  numero_padre:             number | null
  updated_at:               string | null
}

interface FormData {
  numero:                   string
  direccion:                string
  agente_vendedor_id:       string
  agente_vendedor_externo:  string
  vendedor_externo:         boolean
  agente_comprador_id:      string
  agente_comprador_externo: string
  comprador_externo:        boolean
  tipologia:                string
  tipo_operacion:           string
  tiene_reserva:            boolean
  monto_reserva_usd:        string
  moneda:                   "USD" | "ARS"
  tipo_cambio:              string
  monto_ofertado_usd:       string
  precio_publicacion_usd:   string
  fecha_oferta:             string
  es_bis:                   boolean
  numero_padre:             string
  notas:                    string
}

// ── Constants ─────────────────────────────────────────
const ESTADOS = [
  "Espera rta. vendedor",
  "Espera rta. comprador",
  "Aceptadas / Pre cierre",
  "Cerradas",
  "Caídas",
] as const

const TIPOLOGIAS = ["Depto", "Casa", "PH", "Terreno", "Oficina", "Cochera", "Campo", "Otro"]

const ESTADO_STYLE: Record<string, { bg: string; color: string }> = {
  "Espera rta. vendedor":    { bg: "rgba(96,165,250,0.12)", color: "#60a5fa" },
  "Espera rta. comprador":   { bg: "rgba(250,204,21,0.12)", color: "#facc15" },
  "Aceptadas / Pre cierre":  { bg: "rgba(251,146,60,0.12)", color: "#fb923c" },
  "Cerradas":                { bg: "rgba(74,222,128,0.12)", color: "#4ade80" },
  "Caídas":                  { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" },
}

const TIPOLOGIA_STYLE: Record<string, { bg: string; color: string }> = {
  Depto:    { bg: "rgba(96,165,250,0.12)", color: "#60a5fa" },
  Casa:     { bg: "rgba(74,222,128,0.12)", color: "#4ade80" },
  PH:       { bg: "rgba(45,212,191,0.12)", color: "#2dd4bf" },
  Terreno:  { bg: "rgba(251,146,60,0.12)", color: "#fb923c" },
  Oficina:  { bg: "rgba(167,139,250,0.12)", color: "#a78bfa" },
  Cochera:  { bg: "rgba(250,204,21,0.12)", color: "#facc15" },
  Campo:    { bg: "rgba(248,113,113,0.12)", color: "#f87171" },
  Otro:     { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" },
}

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]

const todayStr = new Date().toISOString().split("T")[0]

const currentMonth = (() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
})()

// ── Helpers ───────────────────────────────────────────
function fmtUSD(n: number | null | undefined): string {
  if (n == null) return "—"
  const rounded = Math.round(n)
  return `USD ${rounded.toLocaleString("es-AR")}`
}

function fmtFecha(s: string | null): string {
  if (!s) return "—"
  const [a, m, d] = s.split("-")
  return `${parseInt(d)} ${MONTH_NAMES[parseInt(m) - 1].slice(0, 3)} ${a}`
}

function pctNeg(ofertado: number | null, publicacion: number | null): string {
  if (!ofertado || !publicacion || publicacion === 0) return "—"
  const pct = ((publicacion - ofertado) / publicacion) * 100
  return `${pct.toFixed(1)}%`
}

// ── Sub-components ────────────────────────────────────
function EstadoBadge({ estado }: { estado: string }) {
  const s = ESTADO_STYLE[estado] ?? { bg: "#F1F5F9", color: "#64748B" }
  return (
    <span style={{
      ...s, padding: "3px 9px", borderRadius: "20px",
      fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap" as const,
    }}>
      {estado}
    </span>
  )
}

function TipologiaBadge({ tipo }: { tipo: string }) {
  const s = TIPOLOGIA_STYLE[tipo] ?? { bg: "#F1F5F9", color: "#64748B" }
  return (
    <span style={{
      ...s, padding: "2px 8px", borderRadius: "20px",
      fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap" as const,
    }}>
      {tipo}
    </span>
  )
}

function ReservaBadge({ tiene }: { tiene: boolean }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: "20px",
      fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap" as const,
      background: tiene ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
      color: tiene ? "#4ade80" : "#f87171",
    }}>
      {tiene ? "Con reserva" : "SIN RESERVA"}
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

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "9px 14px", borderRadius: "8px", width: "100%",
        border: `1.5px solid ${value ? "#6EE7B7" : "rgba(255,255,255,0.1)"}`,
        background: value ? "#ECFDF5" : "rgba(255,255,255,0.04)",
        cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
      }}
    >
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
  ofertas: OfertaRow[]
  agentes: AgenteSimple[]
}

export default function OfertasClient({ ofertas, agentes }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Lookup map ─────────────────────────────────────
  const agenteMap = useMemo(
    () => new Map(agentes.map(a => [a.id, a.nombre])),
    [agentes],
  )

  function agenteName(id: string | null, externo: string | null): string {
    if (id)      return agenteMap.get(id) ?? "Desconocido"
    if (externo) return externo
    return "Sin agente"
  }

  // ── Next numero ────────────────────────────────────
  const nextNumero = useMemo(() => {
    if (ofertas.length === 0) return 1
    return Math.max(...ofertas.map(o => o.numero)) + 1
  }, [ofertas])

  // ── View mode ──────────────────────────────────────
  const [viewMode, setViewMode] = useState<"kanban" | "lista">("kanban")
  const [mobileKanbanTab, setMobileKanbanTab] = useState<typeof ESTADOS[number]>(ESTADOS[0])

  // ── Filters ────────────────────────────────────────
  const [filterEstado,     setFilterEstado]     = useState("todos")
  const [filterAgente,     setFilterAgente]     = useState("todos")
  const [filterTipoOp,     setFilterTipoOp]     = useState("todos")

  const filtered = useMemo(() => {
    return ofertas.filter(o => {
      if (filterEstado !== "todos" && o.estado !== filterEstado) return false
      if (filterAgente !== "todos") {
        if (o.agente_vendedor_id !== filterAgente && o.agente_comprador_id !== filterAgente) return false
      }
      if (filterTipoOp !== "todos" && o.tipo_operacion !== filterTipoOp) return false
      return true
    })
  }, [ofertas, filterEstado, filterAgente, filterTipoOp])

  // ── KPIs ───────────────────────────────────────────
  const kpis = useMemo(() => {
    const activas      = ofertas.filter(o => o.estado !== "Cerradas" && o.estado !== "Caídas").length
    const negociacion  = ofertas.filter(o => o.estado === "Espera rta. vendedor" || o.estado === "Espera rta. comprador").length
    const preCierre    = ofertas.filter(o => o.estado === "Aceptadas / Pre cierre").length
    const cerradasMes  = ofertas.filter(o => o.estado === "Cerradas" && (o.updated_at ?? o.fecha_oferta ?? "").startsWith(currentMonth)).length
    return { activas, negociacion, preCierre, cerradasMes }
  }, [ofertas])

  // ── Modal ──────────────────────────────────────────
  const [modal,       setModal]       = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [form,  setForm]  = useState<FormData>({
    numero:                   String(nextNumero),
    direccion:                "",
    agente_vendedor_id:       "",
    agente_vendedor_externo:  "",
    vendedor_externo:         false,
    agente_comprador_id:      "",
    agente_comprador_externo: "",
    comprador_externo:        false,
    tipologia:                "Depto",
    tipo_operacion:           "Venta",
    tiene_reserva:            false,
    monto_reserva_usd:        "",
    moneda:                   "USD",
    tipo_cambio:              "",
    monto_ofertado_usd:       "",
    precio_publicacion_usd:   "",
    fecha_oferta:             todayStr,
    es_bis:                   false,
    numero_padre:             "",
    notas:                    "",
  })
  const [formError, setFormError] = useState("")

  function setF<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  const closeModal = useCallback(() => { setModal(false); setFormError("") }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal() }
    if (modal) document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [modal, closeModal])

  function openNueva() {
    setForm(f => ({ ...f, numero: String(nextNumero), fecha_oferta: todayStr }))
    setFormError("")
    setModal(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError("")

    if (!form.direccion.trim()) { setFormError("La dirección es obligatoria"); return }
    if (!form.monto_ofertado_usd)  { setFormError("El monto ofertado es obligatorio"); return }
    if (form.moneda === "ARS" && !form.tipo_cambio) { setFormError("Ingresá el tipo de cambio para convertir a USD"); return }

    const montoRaw = parseFloat(form.monto_ofertado_usd) || null
    const tc       = parseFloat(form.tipo_cambio) || 1
    const montoUSD = form.moneda === "ARS" && montoRaw ? Math.round(montoRaw / tc) : montoRaw

    const pubRaw   = form.precio_publicacion_usd ? parseFloat(form.precio_publicacion_usd) : null
    const pubUSD   = form.moneda === "ARS" && pubRaw ? Math.round(pubRaw / tc) : pubRaw

    const payload: OfertaFormData = {
      numero:                   parseInt(form.numero) || nextNumero,
      direccion:                form.direccion.trim(),
      agente_vendedor_id:       !form.vendedor_externo  && form.agente_vendedor_id  ? form.agente_vendedor_id  : null,
      agente_comprador_id:      !form.comprador_externo && form.agente_comprador_id ? form.agente_comprador_id : null,
      agente_vendedor_externo:  form.vendedor_externo   ? form.agente_vendedor_externo.trim()  || null : null,
      agente_comprador_externo: form.comprador_externo  ? form.agente_comprador_externo.trim() || null : null,
      tipologia:                form.tipologia,
      tipo_operacion:           form.tipo_operacion,
      tiene_reserva:            form.tiene_reserva,
      monto_reserva_usd:        form.tiene_reserva && form.monto_reserva_usd ? parseFloat(form.monto_reserva_usd) : null,
      monto_ofertado_usd:       montoUSD,
      precio_publicacion_usd:   pubUSD,
      fecha_oferta:             form.fecha_oferta,
      es_bis:                   form.es_bis,
      numero_padre:             form.es_bis && form.numero_padre ? parseInt(form.numero_padre) : null,
      notas:                    form.notas.trim() || null,
    }

    startTransition(async () => {
      const result = await crearOferta(payload)
      if (result.error) { setFormError(result.error); return }
      setSaveSuccess(true)
      setTimeout(() => { setSaveSuccess(false); closeModal(); router.refresh() }, 1000)
    })
  }

  // ── Styles ─────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: "var(--crm-surface-2)", borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden",
  }

  const selStyle: React.CSSProperties = {
    padding: "6px 10px", borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.1)", fontSize: "12.5px",
    fontWeight: 500, color: "var(--crm-text)", background: "var(--crm-input-bg)",
    cursor: "pointer", fontFamily: "inherit", outline: "none",
  }

  // ═══════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Header ──────────────────────────────────── */}
      <div className="crm-page-header flex-shrink-0">
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: "var(--crm-text)", letterSpacing: "-0.3px", margin: 0 }}>
            Ofertas
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Kanban / Lista toggle */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.08)", borderRadius: "8px", padding: "3px", gap: "2px" }}>
            {(["kanban", "lista"] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} style={{
                padding: "5px 12px", borderRadius: "6px", border: "none",
                background: viewMode === mode ? "rgba(255,255,255,0.12)" : "transparent",
                boxShadow: viewMode === mode ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                fontSize: "12px", fontWeight: 600,
                color: viewMode === mode ? "var(--crm-text)" : "rgba(255,255,255,0.35)",
                cursor: "pointer", fontFamily: "inherit",
                textTransform: "capitalize" as const,
              }}>
                {mode === "kanban" ? "Kanban" : "Lista"}
              </button>
            ))}
          </div>
          <button
            onClick={openNueva}
            style={{
              background: "linear-gradient(135deg,#E31837 0%,var(--crm-accent-hover) 100%)",
              color: "white", border: "none",
              padding: "8px 18px", borderRadius: "9px",
              fontSize: "13px", fontWeight: 700, cursor: "pointer",
              boxShadow: "0 2px 10px rgba(227,24,55,0.35)",
              fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span> Nueva Oferta
          </button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-5 md:p-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-5">
          <KpiCard
            title="Ofertas activas"
            value={String(kpis.activas)}
            iconBg="bg-blue-500/15"
            iconColor="text-blue-400"
            icon={<Handshake size={18} />}
          />
          <KpiCard
            title="En negociación"
            value={String(kpis.negociacion)}
            badge="Espera respuesta"
            iconBg="bg-amber-500/15"
            iconColor="text-amber-400"
            icon={<TrendingUp size={18} />}
          />
          <KpiCard
            title="Pre cierre"
            value={String(kpis.preCierre)}
            badge="Aceptadas"
            iconBg="bg-orange-500/15"
            iconColor="text-orange-400"
            icon={<CheckCircle2 size={18} />}
          />
          <KpiCard
            title="Cerradas este mes"
            value={String(kpis.cerradasMes)}
            iconBg="bg-teal-500/15"
            iconColor="text-teal-400"
            icon={<XCircle size={18} />}
          />
        </div>

        {/* Filtros */}
        <div style={{
          ...cardStyle, overflow: "visible",
          display: "flex", alignItems: "center", gap: "12px",
          flexWrap: "wrap" as const,
          padding: "12px 18px", marginBottom: "16px",
        }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>FILTRAR POR</span>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)" }}>Estado:</span>
            <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} style={selStyle}>
              <option value="todos">Todos</option>
              {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)" }}>Agente:</span>
            <select value={filterAgente} onChange={e => setFilterAgente(e.target.value)} style={selStyle}>
              <option value="todos">Todos</option>
              {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)" }}>Tipo:</span>
            <select value={filterTipoOp} onChange={e => setFilterTipoOp(e.target.value)} style={selStyle}>
              <option value="todos">Todos</option>
              <option value="Venta">Venta</option>
              <option value="Alquiler">Alquiler</option>
            </select>
          </div>

          <span style={{ marginLeft: "auto", fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
            {filtered.length} oferta{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* ── KANBAN VIEW ─────────────────────────── */}
        {viewMode === "kanban" && (
          <>
            {/* Mobile: tab pills */}
            <div className="md:hidden flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1" style={{ scrollbarWidth: "none" as React.CSSProperties["scrollbarWidth"] }}>
              {ESTADOS.map(estado => {
                const count = filtered.filter(o => o.estado === estado).length
                return (
                  <button
                    key={estado}
                    type="button"
                    onClick={() => setMobileKanbanTab(estado)}
                    className={[
                      "flex-shrink-0 px-3 py-2 rounded-lg text-crm-xs font-bold border transition-all whitespace-nowrap",
                      mobileKanbanTab === estado
                        ? "bg-[rgba(255,255,255,0.15)] text-white border-[rgba(255,255,255,0.2)]"
                        : "bg-[rgba(255,255,255,0.06)] text-white/40 border-[rgba(255,255,255,0.1)]",
                    ].join(" ")}
                  >
                    {estado} <span className="opacity-60 ml-1">{count}</span>
                  </button>
                )
              })}
            </div>

            {/* Mobile: single column for active tab */}
            <div className="md:hidden flex flex-col gap-3">
              {(() => {
                const colOfertas = filtered.filter(o => o.estado === mobileKanbanTab)
                if (colOfertas.length === 0) return (
                  <div style={{
                    padding: "32px 14px", borderRadius: "10px",
                    border: "1px dashed rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.03)",
                    textAlign: "center", fontSize: "13px", color: "rgba(255,255,255,0.2)",
                  }}>
                    Sin ofertas en esta etapa
                  </div>
                )
                return colOfertas.map(o => {
                  const vendedor = agenteName(o.agente_vendedor_id, o.agente_vendedor_externo)
                  const diasAct  = o.updated_at
                    ? Math.floor((Date.now() - new Date(o.updated_at).getTime()) / (1000 * 60 * 60 * 24))
                    : null
                  return (
                    <Link key={o.id} href={`/ofertas/${o.id}`} style={{ textDecoration: "none" }}>
                      <div style={{
                        background: "var(--crm-surface-2)", borderRadius: "10px",
                        border: "1px solid rgba(255,255,255,0.07)", padding: "14px 16px",
                        cursor: "pointer", transition: "box-shadow 0.15s",
                      }} className="hover:shadow-md">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                          <span style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)", padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>#{o.numero}</span>
                          <TipologiaBadge tipo={o.tipologia} />
                        </div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--crm-text)", lineHeight: 1.3, marginBottom: "4px" }}>{o.direccion}</div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", marginBottom: "8px" }}>{vendedor}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--crm-text)" }}>{fmtUSD(o.monto_ofertado_usd)}</span>
                          {diasAct !== null && (
                            <span style={{ fontSize: "11px", color: diasAct >= 5 ? "#f87171" : "rgba(255,255,255,0.35)", fontWeight: diasAct >= 5 ? 700 : 400 }}>
                              {diasAct === 0 ? "Hoy" : `${diasAct}d`}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })
              })()}
            </div>

            {/* Desktop: full multi-column kanban */}
            <div className="hidden md:block" style={{ overflowX: "auto", paddingBottom: "8px" }}>
              <div style={{ display: "flex", gap: "14px", minWidth: "fit-content" }}>
                {ESTADOS.map(estado => {
                  const colOfertas = filtered.filter(o => o.estado === estado)
                  const colStyle   = ESTADO_STYLE[estado] ?? { bg: "#F1F5F9", color: "#64748B" }
                  return (
                    <div key={estado} style={{ width: "240px", flexShrink: 0 }}>
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        marginBottom: "10px", padding: "0 2px",
                      }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--crm-text)" }}>{estado}</span>
                        <span style={{ ...colStyle, padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 700 }}>
                          {colOfertas.length}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {colOfertas.length === 0 ? (
                          <div style={{
                            padding: "20px 14px", borderRadius: "10px",
                            border: "1px dashed rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.03)",
                            textAlign: "center", fontSize: "12px", color: "rgba(255,255,255,0.2)",
                          }}>
                            Sin ofertas
                          </div>
                        ) : (
                          colOfertas.map(o => {
                            const vendedor = agenteName(o.agente_vendedor_id, o.agente_vendedor_externo)
                            const diasAct  = o.updated_at
                              ? Math.floor((Date.now() - new Date(o.updated_at).getTime()) / (1000 * 60 * 60 * 24))
                              : null
                            return (
                              <Link key={o.id} href={`/ofertas/${o.id}`} style={{ textDecoration: "none" }}>
                                <div style={{
                                  background: "var(--crm-surface-2)", borderRadius: "10px",
                                  border: "1px solid rgba(255,255,255,0.07)", padding: "12px 14px",
                                  cursor: "pointer", transition: "box-shadow 0.15s",
                                }} className="hover:shadow-md">
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                                    <span style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)", padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>#{o.numero}</span>
                                    <TipologiaBadge tipo={o.tipologia} />
                                  </div>
                                  <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--crm-text)", lineHeight: 1.3, marginBottom: "6px" }}>{o.direccion}</div>
                                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", marginBottom: "8px" }}>{vendedor}</div>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--crm-text)" }}>{fmtUSD(o.monto_ofertado_usd)}</span>
                                    {diasAct !== null && (
                                      <span style={{ fontSize: "10px", color: diasAct >= 5 ? "#f87171" : "rgba(255,255,255,0.35)", fontWeight: diasAct >= 5 ? 700 : 400 }}>
                                        {diasAct === 0 ? "Hoy" : `${diasAct}d`}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </Link>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ── LISTA VIEW ───────────────────────────── */}
        {viewMode === "lista" && (
          <div style={cardStyle}>
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E31837" }} />
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--crm-text)" }}>
                Ofertas en curso
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    {["N°","Dirección","Vendedor / Comprador","Tipología","Ofertado","% Neg.","Reserva","Estado","Fecha",""].map(h => (
                      <th key={h} style={{
                        padding: "10px 14px", textAlign: "left",
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
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: "48px 40px", textAlign: "center" }}>
                        <div style={{ fontSize: "28px", marginBottom: "10px", opacity: 0.4 }}>🤝</div>
                        <div style={{ fontWeight: 600, fontSize: "14px", color: "#64748B", marginBottom: "4px" }}>
                          No hay ofertas con estos filtros
                        </div>
                        <div style={{ fontSize: "12px", color: "#94A3B8" }}>
                          Ajustá los filtros o creá una nueva oferta con el botón &quot;+ Nueva Oferta&quot;.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((o, i) => {
                      const isLast    = i === filtered.length - 1
                      const vendedor  = agenteName(o.agente_vendedor_id, o.agente_vendedor_externo)
                      const comprador = agenteName(o.agente_comprador_id, o.agente_comprador_externo)
                      return (
                        <tr key={o.id} style={{ borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.06)" }} className="hover:bg-[rgba(255,255,255,0.03)]">
                          <td style={{ padding: "12px 14px", fontSize: "13px", fontWeight: 700, color: "var(--crm-text)" }}>{o.numero}</td>
                          <td style={{ padding: "12px 14px", fontSize: "13px", color: "var(--crm-text)", maxWidth: "180px" }}>
                            <span title={o.direccion} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.direccion}</span>
                          </td>
                          <td style={{ padding: "12px 14px", maxWidth: "160px" }}>
                            <div style={{ fontSize: "12px", color: "var(--crm-text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={vendedor}>{vendedor}</div>
                            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={comprador}>{comprador}</div>
                          </td>
                          <td style={{ padding: "12px 14px" }}><TipologiaBadge tipo={o.tipologia} /></td>
                          <td style={{ padding: "12px 14px", fontSize: "13px", fontWeight: 600, color: "var(--crm-text)", whiteSpace: "nowrap" }}>{fmtUSD(o.monto_ofertado_usd)}</td>
                          <td style={{ padding: "12px 14px", fontSize: "12px", color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>{pctNeg(o.monto_ofertado_usd, o.precio_publicacion_usd)}</td>
                          <td style={{ padding: "12px 14px" }}><ReservaBadge tiene={o.tiene_reserva} /></td>
                          <td style={{ padding: "12px 14px" }}><EstadoBadge estado={o.estado} /></td>
                          <td style={{ padding: "12px 14px", fontSize: "12px", color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>{fmtFecha(o.fecha_oferta)}</td>
                          <td style={{ padding: "12px 14px" }}>
                            <Link href={`/ofertas/${o.id}`} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "5px 12px", borderRadius: "7px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", fontSize: "12px", fontWeight: 600, color: "var(--crm-text)", textDecoration: "none", whiteSpace: "nowrap" }} className="hover:bg-[rgba(255,255,255,0.05)]">
                              Ver detalle <ChevronRight size={12} />
                            </Link>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          MODAL — NUEVA OFERTA
      ══════════════════════════════════════════════ */}
      {modal && (
        <div onClick={closeModal} className="crm-modal-backdrop">
          <div
            onClick={e => e.stopPropagation()}
            className="crm-modal"
            style={{ maxWidth: "600px" }}
          >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="bg-blue-500/[0.12] rounded-xl p-2.5 flex-shrink-0">
                  <Handshake size={20} className="text-blue-600" />
                </div>
                <div>
                  <h2 style={{ fontSize: "16px", fontWeight: 800, color: "var(--crm-text)", margin: 0 }}>Nueva Oferta</h2>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, marginTop: "2px" }}>
                    Registrá los datos de la operación
                  </p>
                </div>
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

              {/* SECCIÓN: Propiedad */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.35)" }}>Propiedad</span>
                <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
              </div>

              {/* Número + Fecha */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="N° Oferta *">
                  <input type="number" value={form.numero} onChange={e => setF("numero", e.target.value)}
                    style={inp} min="1" required />
                </Field>
                <Field label="Fecha de oferta *">
                  <input type="date" value={form.fecha_oferta} onChange={e => setF("fecha_oferta", e.target.value)}
                    style={inp} required />
                </Field>
              </div>

              {/* Dirección */}
              <Field label="Dirección *">
                <input type="text" value={form.direccion} onChange={e => setF("direccion", e.target.value)}
                  placeholder="Av. San Martín 1250, Resistencia" style={inp} required />
              </Field>

              {/* Tipología + Tipo operación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Tipología *">
                  <select value={form.tipologia} onChange={e => setF("tipologia", e.target.value)} style={inp} required>
                    {TIPOLOGIAS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Tipo de operación *">
                  <select value={form.tipo_operacion} onChange={e => setF("tipo_operacion", e.target.value)} style={inp} required>
                    <option value="Venta">Venta</option>
                    <option value="Alquiler">Alquiler</option>
                  </select>
                </Field>
              </div>

              {/* SECCIÓN: Participantes */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", marginTop: "8px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.35)" }}>Participantes</span>
                <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
              </div>

              {/* Agente vendedor */}
              <Field label="Agente vendedor">
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <Toggle
                    value={form.vendedor_externo}
                    onChange={v => setF("vendedor_externo", v)}
                    label="Inmobiliaria externa"
                  />
                  {form.vendedor_externo ? (
                    <input type="text" value={form.agente_vendedor_externo}
                      onChange={e => setF("agente_vendedor_externo", e.target.value)}
                      placeholder="Nombre de la inmobiliaria" style={inp} />
                  ) : (
                    <select value={form.agente_vendedor_id} onChange={e => setF("agente_vendedor_id", e.target.value)} style={inp}>
                      <option value="">— Sin agente interno —</option>
                      {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                  )}
                </div>
              </Field>

              {/* Agente comprador */}
              <Field label="Agente comprador">
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <Toggle
                    value={form.comprador_externo}
                    onChange={v => setF("comprador_externo", v)}
                    label="Inmobiliaria externa"
                  />
                  {form.comprador_externo ? (
                    <input type="text" value={form.agente_comprador_externo}
                      onChange={e => setF("agente_comprador_externo", e.target.value)}
                      placeholder="Nombre de la inmobiliaria" style={inp} />
                  ) : (
                    <select value={form.agente_comprador_id} onChange={e => setF("agente_comprador_id", e.target.value)} style={inp}>
                      <option value="">— Sin agente interno —</option>
                      {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                  )}
                </div>
              </Field>

              {/* SECCIÓN: Montos */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", marginTop: "8px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.35)" }}>Montos</span>
                <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
              </div>

              {/* Moneda + Tipo de cambio */}
              <Field label="Moneda del monto">
                <div style={{ display: "flex", gap: "8px" }}>
                  {(["USD", "ARS"] as const).map(m => (
                    <button key={m} type="button" onClick={() => setF("moneda", m)} style={{
                      padding: "7px 20px", borderRadius: "8px", border: "1.5px solid",
                      borderColor: form.moneda === m ? "#E31837" : "rgba(255,255,255,0.1)",
                      background: form.moneda === m ? "rgba(227,24,55,0.12)" : "rgba(255,255,255,0.06)",
                      color: form.moneda === m ? "var(--crm-accent)" : "rgba(255,255,255,0.45)",
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

              {/* Montos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={`Monto ofertado (${form.moneda}) *`}>
                  <input type="number" value={form.monto_ofertado_usd} min="0" step="100"
                    onChange={e => setF("monto_ofertado_usd", e.target.value)}
                    placeholder={form.moneda === "ARS" ? "180000000" : "150000"} style={inp} required />
                  {form.moneda === "ARS" && form.tipo_cambio && form.monto_ofertado_usd && (
                    <div style={{ fontSize: "11px", color: "#2dd4bf", marginTop: "4px", fontWeight: 600 }}>
                      ≈ USD {Math.round(parseFloat(form.monto_ofertado_usd) / parseFloat(form.tipo_cambio)).toLocaleString("es-AR")}
                    </div>
                  )}
                </Field>
                <Field label={`Precio publicación (${form.moneda})`}>
                  <input type="number" value={form.precio_publicacion_usd} min="0" step="100"
                    onChange={e => setF("precio_publicacion_usd", e.target.value)}
                    placeholder={form.moneda === "ARS" ? "200000000" : "165000"} style={inp} />
                </Field>
              </div>

              {/* Reserva */}
              <Field label="Reserva">
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <Toggle
                    value={form.tiene_reserva}
                    onChange={v => setF("tiene_reserva", v)}
                    label="Tiene reserva"
                  />
                  {form.tiene_reserva && (
                    <input type="number" value={form.monto_reserva_usd} min="0" step="100"
                      onChange={e => setF("monto_reserva_usd", e.target.value)}
                      placeholder="Monto reserva (USD)" style={inp} />
                  )}
                </div>
              </Field>

              {/* Es BIS */}
              <Field label="¿Es BIS?">
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <Toggle value={form.es_bis} onChange={v => setF("es_bis", v)} label="Es oferta BIS" />
                  {form.es_bis && (
                    <input type="number" value={form.numero_padre}
                      onChange={e => setF("numero_padre", e.target.value)}
                      placeholder="N° de oferta padre" style={inp} />
                  )}
                </div>
              </Field>

              {/* Notas */}
              <Field label="Notas">
                <textarea value={form.notas} onChange={e => setF("notas", e.target.value)}
                  rows={3} placeholder="Observaciones relevantes..."
                  style={{ ...inp, resize: "vertical" as const }} />
              </Field>

              {formError && (
                <div style={{
                  background: "rgba(227,24,55,0.12)", border: "1px solid rgba(227,24,55,0.25)",
                  borderRadius: "8px", padding: "10px 12px",
                  fontSize: "12.5px", color: "var(--crm-accent-light)", marginBottom: "14px",
                }}>
                  ⚠️ {formError}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end sm:items-center pt-1">
                {saveSuccess ? (
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400 bg-emerald-500/[0.12] px-4 py-2.5 rounded-lg">
                    <CheckCircle2 size={15} /> Oferta creada correctamente
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={closeModal} disabled={isPending}
                      className="w-full sm:w-auto min-h-[44px]"
                      style={{
                        padding: "9px 20px", borderRadius: "8px",
                        border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
                        fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.5)",
                        cursor: "pointer", fontFamily: "inherit",
                      }}>
                      Cancelar
                    </button>
                    <button type="submit" disabled={isPending}
                      className="w-full sm:w-auto min-h-[44px]"
                      style={{
                        padding: "9px 24px", borderRadius: "8px", border: "none",
                        background: isPending ? "#CBD5E1" : "linear-gradient(135deg,#E31837 0%,var(--crm-accent-hover) 100%)",
                        color: "white", fontSize: "13px", fontWeight: 700,
                        cursor: isPending ? "not-allowed" : "pointer",
                        fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                        boxShadow: isPending ? "none" : "0 2px 8px rgba(227,24,55,0.3)",
                      }}>
                      {isPending && <Loader2 size={14} className="animate-spin" />}
                      {isPending ? "Guardando..." : <><Save size={14} /> Crear oferta</>}
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
