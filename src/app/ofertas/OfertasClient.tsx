"use client"

import { useState, useMemo, useTransition, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import KpiCard from "@/components/KpiCard"
import { crearOferta } from "./actions"
import type { OfertaFormData } from "./actions"
import {
  Handshake, TrendingUp, CheckCircle2, XCircle,
  X, Loader2, ChevronRight,
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
  "Espera rta. vendedor":    { bg: "#EFF6FF", color: "#2563EB" },
  "Espera rta. comprador":   { bg: "#FEFCE8", color: "#A16207" },
  "Aceptadas / Pre cierre":  { bg: "#FFF7ED", color: "#C2410C" },
  "Cerradas":                { bg: "#ECFDF5", color: "#059669" },
  "Caídas":                  { bg: "#F8FAFC", color: "#64748B" },
}

const TIPOLOGIA_STYLE: Record<string, { bg: string; color: string }> = {
  Depto:    { bg: "#EFF6FF", color: "#2563EB" },
  Casa:     { bg: "#ECFDF5", color: "#059669" },
  PH:       { bg: "#F0FDFA", color: "#0D9488" },
  Terreno:  { bg: "#FFF7ED", color: "#C2410C" },
  Oficina:  { bg: "#F5F3FF", color: "#7C3AED" },
  Cochera:  { bg: "#FEFCE8", color: "#A16207" },
  Campo:    { bg: "#FFF1F2", color: "#E11D48" },
  Otro:     { bg: "#F1F5F9", color: "#64748B" },
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
      background: tiene ? "#ECFDF5" : "#FFF1F2",
      color: tiene ? "#059669" : "#E11D48",
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

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "9px 14px", borderRadius: "8px", width: "100%",
        border: `1.5px solid ${value ? "#6EE7B7" : "#EAECF2"}`,
        background: value ? "#ECFDF5" : "white",
        cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
      }}
    >
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
    if (id)     return agenteMap.get(id) ?? "Desconocido"
    if (externo) return `${externo} (ext.)`
    return "Sin agente"
  }

  // ── Next numero ────────────────────────────────────
  const nextNumero = useMemo(() => {
    if (ofertas.length === 0) return 1
    return Math.max(...ofertas.map(o => o.numero)) + 1
  }, [ofertas])

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
    const cerradasMes  = ofertas.filter(o => o.estado === "Cerradas" && o.fecha_oferta?.startsWith(currentMonth)).length
    return { activas, negociacion, preCierre, cerradasMes }
  }, [ofertas])

  // ── Modal ──────────────────────────────────────────
  const [modal, setModal] = useState(false)
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
      monto_ofertado_usd:       parseFloat(form.monto_ofertado_usd) || null,
      precio_publicacion_usd:   form.precio_publicacion_usd ? parseFloat(form.precio_publicacion_usd) : null,
      fecha_oferta:             form.fecha_oferta,
      es_bis:                   form.es_bis,
      numero_padre:             form.es_bis && form.numero_padre ? parseInt(form.numero_padre) : null,
      notas:                    form.notas.trim() || null,
    }

    startTransition(async () => {
      const result = await crearOferta(payload)
      if (result.error) { setFormError(result.error); return }
      closeModal()
      router.refresh()
    })
  }

  // ── Styles ─────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: "white", borderRadius: "14px",
    border: "1.5px solid #EAECF2", overflow: "hidden",
  }

  const selStyle: React.CSSProperties = {
    padding: "6px 10px", borderRadius: "8px",
    border: "1.5px solid #EAECF2", fontSize: "12.5px",
    fontWeight: 500, color: "#0F172A", background: "white",
    cursor: "pointer", fontFamily: "inherit", outline: "none",
  }

  // ═══════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Header ──────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        minHeight: "62px", padding: "0 24px",
        background: "white", borderBottom: "1px solid #EAECF2", flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", letterSpacing: "-0.3px", margin: 0 }}>
            Ofertas
          </h1>
          <p style={{ fontSize: "12px", color: "#64748B", margin: 0, marginTop: "1px" }}>
            Seguimiento de ofertas inmobiliarias — reemplaza Notion
          </p>
        </div>
        <button
          onClick={openNueva}
          style={{
            background: "linear-gradient(135deg,#E31837 0%,#c0122d 100%)",
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

      {/* ── Content ─────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px", marginBottom: "20px" }}>
          <KpiCard
            title="Ofertas activas"
            value={String(kpis.activas)}
            gradient="linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%)"
            shadowColor="rgba(37,99,235,0.3)"
            icon={<Handshake size={20} color="white" />}
          />
          <KpiCard
            title="En negociación"
            value={String(kpis.negociacion)}
            badge="Espera respuesta"
            gradient="linear-gradient(135deg,#D97706 0%,#B45309 100%)"
            shadowColor="rgba(217,119,6,0.3)"
            icon={<TrendingUp size={20} color="white" />}
          />
          <KpiCard
            title="Pre cierre"
            value={String(kpis.preCierre)}
            badge="Aceptadas"
            gradient="linear-gradient(135deg,#EA580C 0%,#C2410C 100%)"
            shadowColor="rgba(234,88,12,0.3)"
            icon={<CheckCircle2 size={20} color="white" />}
          />
          <KpiCard
            title="Cerradas este mes"
            value={String(kpis.cerradasMes)}
            gradient="linear-gradient(135deg,#0D9488 0%,#0F766E 100%)"
            shadowColor="rgba(13,148,136,0.3)"
            icon={<XCircle size={20} color="white" />}
          />
        </div>

        {/* Filtros */}
        <div style={{
          ...cardStyle, overflow: "visible",
          display: "flex", alignItems: "center", gap: "12px",
          flexWrap: "wrap" as const,
          padding: "12px 18px", marginBottom: "16px",
        }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#94A3B8" }}>FILTRAR POR</span>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "#64748B" }}>Estado:</span>
            <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} style={selStyle}>
              <option value="todos">Todos</option>
              {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "#64748B" }}>Agente:</span>
            <select value={filterAgente} onChange={e => setFilterAgente(e.target.value)} style={selStyle}>
              <option value="todos">Todos</option>
              {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "#64748B" }}>Tipo:</span>
            <select value={filterTipoOp} onChange={e => setFilterTipoOp(e.target.value)} style={selStyle}>
              <option value="todos">Todos</option>
              <option value="Venta">Venta</option>
              <option value="Alquiler">Alquiler</option>
            </select>
          </div>

          <span style={{ marginLeft: "auto", fontSize: "12px", color: "#94A3B8" }}>
            {filtered.length} oferta{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Tabla */}
        <div style={cardStyle}>
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "14px 20px", borderBottom: "1px solid #EAECF2",
          }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E31837" }} />
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
              Ofertas en curso
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8F9FC", borderBottom: "1px solid #EAECF2" }}>
                  {["N°","Dirección","Vendedor / Comprador","Tipología","Ofertado","% Neg.","Reserva","Estado","Fecha",""].map(h => (
                    <th key={h} style={{
                      padding: "10px 14px", textAlign: "left",
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
                    const isLast = i === filtered.length - 1
                    const vendedor  = agenteName(o.agente_vendedor_id, o.agente_vendedor_externo)
                    const comprador = agenteName(o.agente_comprador_id, o.agente_comprador_externo)
                    return (
                      <tr
                        key={o.id}
                        style={{ borderBottom: isLast ? "none" : "1px solid #F3F4F6" }}
                        className="hover:bg-[#FAFBFF]"
                      >
                        <td style={{ padding: "12px 14px", fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>
                          {o.numero}
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: "13px", color: "#0F172A", maxWidth: "180px" }}>
                          <span title={o.direccion} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {o.direccion}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", maxWidth: "160px" }}>
                          <div style={{ fontSize: "12px", color: "#0F172A", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={vendedor}>
                            {vendedor}
                          </div>
                          <div style={{ fontSize: "11px", color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={comprador}>
                            {comprador}
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <TipologiaBadge tipo={o.tipologia} />
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: "13px", fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap" }}>
                          {fmtUSD(o.monto_ofertado_usd)}
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: "12px", color: "#64748B", whiteSpace: "nowrap" }}>
                          {pctNeg(o.monto_ofertado_usd, o.precio_publicacion_usd)}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <ReservaBadge tiene={o.tiene_reserva} />
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <EstadoBadge estado={o.estado} />
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: "12px", color: "#64748B", whiteSpace: "nowrap" }}>
                          {fmtFecha(o.fecha_oferta)}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <Link
                            href={`/ofertas/${o.id}`}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: "4px",
                              padding: "5px 12px", borderRadius: "7px",
                              border: "1.5px solid #EAECF2", background: "white",
                              fontSize: "12px", fontWeight: 600, color: "#0F172A",
                              textDecoration: "none", whiteSpace: "nowrap",
                            }}
                            className="hover:bg-[#F8F9FC]"
                          >
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
      </div>

      {/* ══════════════════════════════════════════════
          MODAL — NUEVA OFERTA
      ══════════════════════════════════════════════ */}
      {modal && (
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
              width: "100%", maxWidth: "600px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              maxHeight: "92vh", display: "flex", flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "18px 20px", borderBottom: "1px solid #EAECF2", flexShrink: 0,
            }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A", margin: 0 }}>Nueva Oferta</h2>
                <p style={{ fontSize: "12px", color: "#64748B", margin: 0, marginTop: "2px" }}>
                  Estado inicial: Espera rta. vendedor
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

              {/* Número + Fecha */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
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

              {/* Tipología + Tipo operación */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
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

              {/* Montos */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Monto ofertado (USD) *">
                  <input type="number" value={form.monto_ofertado_usd} min="0" step="100"
                    onChange={e => setF("monto_ofertado_usd", e.target.value)}
                    placeholder="150000" style={inp} required />
                </Field>
                <Field label="Precio publicación (USD)">
                  <input type="number" value={form.precio_publicacion_usd} min="0" step="100"
                    onChange={e => setF("precio_publicacion_usd", e.target.value)}
                    placeholder="165000" style={inp} />
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
                  background: "#FFF1F2", border: "1px solid #FECDD3",
                  borderRadius: "8px", padding: "10px 12px",
                  fontSize: "12.5px", color: "#E11D48", marginBottom: "14px",
                }}>
                  ⚠️ {formError}
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
                    fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px",
                    boxShadow: isPending ? "none" : "0 2px 8px rgba(227,24,55,0.3)",
                  }}>
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  {isPending ? "Guardando..." : "Crear oferta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
