"use client"

import { useState, useTransition, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { crearPago } from "@/app/pagos/actions"
import { guardarEncuesta } from "@/app/encuestas/actions"
import { crearOperacion } from "@/app/operaciones/actions"
import { crearCartel } from "@/app/carteleria/actions"
import { crearOferta } from "@/app/ofertas/actions"
import { agregarMovimiento } from "@/app/ofertas/actions"
import type { OfertaActiva } from "@/app/page"
import {
  X, Loader2, DollarSign, MapPin, ClipboardList,
  Building2, Handshake, RefreshCw, LucideIcon,
} from "lucide-react"

// ── Types ────────────────────────────────────────────
interface AgenteSimple {
  id: string
  nombre: string
}

interface Props {
  agentes: AgenteSimple[]
  ofertasActivas: OfertaActiva[]
}

type ModalT = "none" | "pago" | "carteleria" | "encuesta" | "operacion" | "oferta" | "actualizar_oferta"

// ── Constants ────────────────────────────────────────
const CONCEPTOS_PAGO = ["FEE mensual", "Licencias CRM", "Mainstreet", "Otros"]
const TIPOS_OP       = ["Venta", "Alquiler", "Alquiler Temporal", "Referido", "Otro"]
const TIPOS_CARTEL   = ["Casa", "Terreno", "Local", "Departamento", "Campo", "Galpón"]
const TIPOLOGIAS_OFERTA = ["Casa", "Departamento", "Terreno", "Local Comercial", "Oficina", "PH", "Campo", "Galpón", "Edificio", "Otro"]
const TIPOS_OP_OFERTA   = ["Venta", "Alquiler", "Alquiler Temporal"]
const TIPOS_MOVIMIENTO  = ["Seguimiento", "Llamada", "Reunión", "Nota", "Documentación", "Otro"]

// ── Styles ────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  borderRadius: "8px", border: "1.5px solid #EAECF2",
  fontSize: "13px", fontFamily: "inherit",
  color: "#0F172A", outline: "none", background: "white",
  boxSizing: "border-box",
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

function ModalShell({ title, subtitle, onClose, children }: {
  title: string; subtitle: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div
      onClick={onClose}
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
          width: "100%", maxWidth: "500px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden",
          maxHeight: "90vh", display: "flex", flexDirection: "column",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px", borderBottom: "1px solid #EAECF2", flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A", margin: 0 }}>{title}</h2>
            <p style={{ fontSize: "12px", color: "#64748B", margin: 0, marginTop: "2px" }}>{subtitle}</p>
          </div>
          <button onClick={onClose} style={{
            background: "#F8F9FC", border: "none", borderRadius: "8px",
            width: "32px", height: "32px", display: "flex",
            alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#64748B",
          }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function SubmitRow({ isPending, onCancel, label }: { isPending: boolean; onCancel: () => void; label: string }) {
  return (
    <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
      <button type="button" onClick={onCancel} disabled={isPending} style={{
        padding: "9px 20px", borderRadius: "8px",
        border: "1.5px solid #EAECF2", background: "white",
        fontSize: "13px", fontWeight: 600, color: "#64748B",
        cursor: "pointer", fontFamily: "inherit",
      }}>
        Cancelar
      </button>
      <button type="submit" disabled={isPending} style={{
        padding: "9px 24px", borderRadius: "8px", border: "none",
        background: isPending ? "#CBD5E1" : "linear-gradient(135deg,#E31837 0%,#c0122d 100%)",
        color: "white", fontSize: "13px", fontWeight: 700,
        cursor: isPending ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        display: "flex", alignItems: "center", gap: "6px",
        boxShadow: isPending ? "none" : "0 2px 8px rgba(227,24,55,0.3)",
      }}>
        {isPending && <Loader2 size={14} className="animate-spin" />}
        {isPending ? "Guardando..." : label}
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export default function DashboardActions({ agentes, ofertasActivas }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [modal,      setModal]      = useState<ModalT>("none")
  const [error,      setError]      = useState("")
  const [hoveredBtn, setHoveredBtn] = useState<ModalT | null>(null)

  const todayStr = new Date().toISOString().split("T")[0]

  // ── Form states ────────────────────────────────────
  const [pagoForm, setPagoForm] = useState({
    agente_id: agentes[0]?.id ?? "",
    concepto:  CONCEPTOS_PAGO[0],
    monto_debe: "", monto_pagado: "0", fecha: todayStr,
  })

  const mesActual  = new Date().getMonth() + 1
  const anioActual = new Date().getFullYear()
  const [encForm, setEncForm] = useState({
    mes: mesActual, anio: anioActual,
    enviadas: "", respondidas: "", nps_promedio: "",
  })

  const [opForm, setOpForm] = useState({
    fecha: todayStr, direccion: "", agentes: "",
    tipo: TIPOS_OP[0], comision_bruta: "", comision_neta: "",
    encuesta_comprador: false, encuesta_vendedor: false,
  })

  const [cartelForm, setCartelForm] = useState({
    numero: "", direccion: "", mlsId: "",
    vencimiento: todayStr, tipo: TIPOS_CARTEL[0], agente: "",
  })

  const [ofertaForm, setOfertaForm] = useState({
    numero: "",
    direccion: "",
    tipologia: TIPOLOGIAS_OFERTA[0],
    tipo_operacion: TIPOS_OP_OFERTA[0],
    agente_vendedor_id: agentes[0]?.id ?? "",
    agente_comprador_id: "",
    monto_ofertado_usd: "",
    precio_publicacion_usd: "",
    fecha_oferta: todayStr,
    notas: "",
  })

  const [actualizarForm, setActualizarForm] = useState({
    oferta_id: ofertasActivas[0]?.id ?? "",
    tipo: TIPOS_MOVIMIENTO[0],
    descripcion: "",
    monto_usd: "",
  })

  const closeModal = useCallback(() => { setModal("none"); setError("") }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal() }
    if (modal !== "none") document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [modal, closeModal])

  function openModal(m: ModalT) {
    setError("")
    setPagoForm({ agente_id: agentes[0]?.id ?? "", concepto: CONCEPTOS_PAGO[0], monto_debe: "", monto_pagado: "0", fecha: todayStr })
    setOpForm({ fecha: todayStr, direccion: "", agentes: "", tipo: TIPOS_OP[0], comision_bruta: "", comision_neta: "", encuesta_comprador: false, encuesta_vendedor: false })
    setCartelForm({ numero: "", direccion: "", mlsId: "", vencimiento: todayStr, tipo: TIPOS_CARTEL[0], agente: "" })
    setOfertaForm({ numero: "", direccion: "", tipologia: TIPOLOGIAS_OFERTA[0], tipo_operacion: TIPOS_OP_OFERTA[0], agente_vendedor_id: agentes[0]?.id ?? "", agente_comprador_id: "", monto_ofertado_usd: "", precio_publicacion_usd: "", fecha_oferta: todayStr, notas: "" })
    setActualizarForm({ oferta_id: ofertasActivas[0]?.id ?? "", tipo: TIPOS_MOVIMIENTO[0], descripcion: "", monto_usd: "" })
    setModal(m)
  }

  // ── Submit handlers ────────────────────────────────
  function handlePago(e: React.FormEvent) {
    e.preventDefault()
    const debe   = parseFloat(pagoForm.monto_debe)   || 0
    const pagado = parseFloat(pagoForm.monto_pagado) || 0
    if (debe <= 0) { setError("El monto debe ser mayor a 0"); return }
    startTransition(async () => {
      const r = await crearPago({ agente_id: pagoForm.agente_id, fecha: pagoForm.fecha, concepto: pagoForm.concepto, monto_debe: debe, monto_pagado: pagado })
      if (r.error) setError(r.error)
      else { closeModal(); router.refresh() }
    })
  }

  function handleEncuesta(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await guardarEncuesta({
        mes: encForm.mes, anio: encForm.anio,
        enviadas: parseInt(encForm.enviadas) || 0,
        respondidas: parseInt(encForm.respondidas) || 0,
        nps_promedio: encForm.nps_promedio ? parseFloat(encForm.nps_promedio) : null,
      })
      if (r.error) setError(r.error)
      else { closeModal(); router.refresh() }
    })
  }

  function handleOperacion(e: React.FormEvent) {
    e.preventDefault()
    if (!opForm.direccion) { setError("La dirección es obligatoria"); return }
    startTransition(async () => {
      const r = await crearOperacion({
        fecha: opForm.fecha, direccion: opForm.direccion,
        agentes: opForm.agentes, tipo: opForm.tipo,
        comision_bruta: parseFloat(opForm.comision_bruta) || 0,
        comision_neta:  parseFloat(opForm.comision_neta)  || 0,
        encuesta_comprador: opForm.encuesta_comprador,
        encuesta_vendedor:  opForm.encuesta_vendedor,
      })
      if (r.error) setError(r.error)
      else { closeModal(); router.refresh() }
    })
  }

  function handleCarteleria(e: React.FormEvent) {
    e.preventDefault()
    if (!cartelForm.numero || !cartelForm.agente) { setError("Número y agente son obligatorios"); return }
    startTransition(async () => {
      const r = await crearCartel({
        numero: parseInt(cartelForm.numero) || 0,
        direccion: cartelForm.direccion, mlsId: cartelForm.mlsId,
        vencimiento: cartelForm.vencimiento, tipo: cartelForm.tipo,
        agente: cartelForm.agente,
      })
      if (r.error) setError(r.error)
      else { closeModal(); router.refresh() }
    })
  }

  function handleOferta(e: React.FormEvent) {
    e.preventDefault()
    if (!ofertaForm.numero || !ofertaForm.direccion) {
      setError("Número y dirección son obligatorios")
      return
    }
    startTransition(async () => {
      const r = await crearOferta({
        numero: parseInt(ofertaForm.numero),
        direccion: ofertaForm.direccion,
        tipologia: ofertaForm.tipologia,
        tipo_operacion: ofertaForm.tipo_operacion,
        agente_vendedor_id: ofertaForm.agente_vendedor_id || null,
        agente_comprador_id: ofertaForm.agente_comprador_id || null,
        agente_vendedor_externo: null,
        agente_comprador_externo: null,
        tiene_reserva: false,
        monto_reserva_usd: null,
        monto_ofertado_usd: ofertaForm.monto_ofertado_usd ? parseFloat(ofertaForm.monto_ofertado_usd) : null,
        precio_publicacion_usd: ofertaForm.precio_publicacion_usd ? parseFloat(ofertaForm.precio_publicacion_usd) : null,
        fecha_oferta: ofertaForm.fecha_oferta,
        es_bis: false,
        numero_padre: null,
        notas: ofertaForm.notas || null,
      })
      if (r.error) setError(r.error)
      else { closeModal(); router.refresh() }
    })
  }

  function handleActualizar(e: React.FormEvent) {
    e.preventDefault()
    if (!actualizarForm.oferta_id || !actualizarForm.descripcion) {
      setError("Seleccioná una oferta y agregá una descripción")
      return
    }
    startTransition(async () => {
      const r = await agregarMovimiento(
        actualizarForm.oferta_id,
        actualizarForm.tipo,
        actualizarForm.descripcion,
        actualizarForm.monto_usd ? parseFloat(actualizarForm.monto_usd) : null,
      )
      if (r.error) setError(r.error)
      else { closeModal(); router.refresh() }
    })
  }

  // ── Quick action buttons config ────────────────────
  const QUICK_BTNS: Array<{
    icon: LucideIcon; label: string; sublabel: string; m: ModalT
    bg: string; bgHover: string; color: string; border: string; shadow: string; shadowHover: string
  }> = [
    {
      icon: DollarSign, label: "Registrar", sublabel: "Pago", m: "pago",
      bg: "#ECFDF5", bgHover: "#D1FAE5", color: "#059669",
      border: "#6EE7B7", shadow: "0 2px 8px rgba(5,150,105,0.12)",
      shadowHover: "0 8px 24px rgba(5,150,105,0.22)",
    },
    {
      icon: MapPin, label: "Devolución", sublabel: "Cartelería", m: "carteleria",
      bg: "#FFFBEB", bgHover: "#FEF3C7", color: "#D97706",
      border: "#FCD34D", shadow: "0 2px 8px rgba(217,119,6,0.12)",
      shadowHover: "0 8px 24px rgba(217,119,6,0.22)",
    },
    {
      icon: ClipboardList, label: "Registrar", sublabel: "Encuesta", m: "encuesta",
      bg: "#EFF6FF", bgHover: "#DBEAFE", color: "#2563EB",
      border: "#93C5FD", shadow: "0 2px 8px rgba(37,99,235,0.12)",
      shadowHover: "0 8px 24px rgba(37,99,235,0.22)",
    },
    {
      icon: Building2, label: "Registrar", sublabel: "Operación", m: "operacion",
      bg: "#FFF7ED", bgHover: "#FFEDD5", color: "#EA580C",
      border: "#FDBA74", shadow: "0 2px 8px rgba(234,88,12,0.12)",
      shadowHover: "0 8px 24px rgba(234,88,12,0.22)",
    },
    {
      icon: Handshake, label: "Registrar", sublabel: "Oferta", m: "oferta",
      bg: "#F5F3FF", bgHover: "#EDE9FE", color: "#7C3AED",
      border: "#C4B5FD", shadow: "0 2px 8px rgba(124,58,237,0.12)",
      shadowHover: "0 8px 24px rgba(124,58,237,0.22)",
    },
    {
      icon: RefreshCw, label: "Actualizar", sublabel: "Oferta", m: "actualizar_oferta",
      bg: "#F0F9FF", bgHover: "#E0F2FE", color: "#0284C7",
      border: "#7DD3FC", shadow: "0 2px 8px rgba(2,132,199,0.12)",
      shadowHover: "0 8px 24px rgba(2,132,199,0.22)",
    },
  ]

  const ErrorBox = () => error ? (
    <div style={{
      background: "#FFF1F2", border: "1px solid #FECDD3",
      borderRadius: "8px", padding: "10px 12px",
      fontSize: "12.5px", color: "#E11D48", marginBottom: "14px",
    }}>
      ⚠️ {error}
    </div>
  ) : null

  return (
    <>
      {/* ── Quick action buttons ─────────────────────── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(6,1fr)",
        gap: "14px", margin: "4px 0 20px",
      }}>
        {QUICK_BTNS.map(({ icon: Icon, label, sublabel, m, bg, bgHover, color, border, shadow, shadowHover }) => {
          const isHovered = hoveredBtn === m
          return (
            <button
              key={m}
              onClick={() => openModal(m)}
              onMouseEnter={() => setHoveredBtn(m)}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: "10px", padding: "20px 12px 16px",
                borderRadius: "16px",
                border: `1.5px solid ${border}`,
                background: isHovered ? bgHover : bg,
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: isHovered ? shadowHover : shadow,
                transform: isHovered ? "translateY(-2px)" : "none",
                transition: "all 0.18s ease",
                minHeight: "110px",
              }}
            >
              <div style={{
                width: "48px", height: "48px", borderRadius: "14px",
                background: "white",
                boxShadow: `0 2px 8px ${color}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Icon size={24} color={color} strokeWidth={1.75} />
              </div>
              <div style={{ textAlign: "center", lineHeight: 1.25 }}>
                <div style={{ fontSize: "11px", fontWeight: 500, color, opacity: 0.7, letterSpacing: "0.2px" }}>{label}</div>
                <div style={{ fontSize: "13px", fontWeight: 800, color, marginTop: "1px" }}>{sublabel}</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* ════════════ MODAL PAGO ════════════ */}
      {modal === "pago" && (
        <ModalShell title="Registrar Pago" subtitle="Nuevo registro de cobro" onClose={closeModal}>
          <form onSubmit={handlePago} style={{ padding: "20px" }}>
            <Field label="Agente *">
              <select value={pagoForm.agente_id} onChange={e => setPagoForm(f => ({ ...f, agente_id: e.target.value }))} style={inp} required>
                {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Concepto *">
                <select value={pagoForm.concepto} onChange={e => setPagoForm(f => ({ ...f, concepto: e.target.value }))} style={inp} required>
                  {CONCEPTOS_PAGO.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Fecha *">
                <input type="date" value={pagoForm.fecha} onChange={e => setPagoForm(f => ({ ...f, fecha: e.target.value }))} style={inp} required />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Monto que debe (USD) *">
                <input type="number" min="0" step="0.01" placeholder="95.25" value={pagoForm.monto_debe} onChange={e => setPagoForm(f => ({ ...f, monto_debe: e.target.value }))} style={inp} required />
              </Field>
              <Field label="Monto pagado (USD)">
                <input type="number" min="0" step="0.01" placeholder="0" value={pagoForm.monto_pagado} onChange={e => setPagoForm(f => ({ ...f, monto_pagado: e.target.value }))} style={inp} />
              </Field>
            </div>
            <ErrorBox />
            <SubmitRow isPending={isPending} onCancel={closeModal} label="Guardar" />
          </form>
        </ModalShell>
      )}

      {/* ════════════ MODAL CARTELERÍA ════════════ */}
      {modal === "carteleria" && (
        <ModalShell title="Devolución de Cartelería" subtitle="Registrar devolución en Airtable" onClose={closeModal}>
          <form onSubmit={handleCarteleria} style={{ padding: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Número de cartel *">
                <input type="number" min="1" placeholder="42" value={cartelForm.numero} onChange={e => setCartelForm(f => ({ ...f, numero: e.target.value }))} style={inp} required />
              </Field>
              <Field label="Tipo de propiedad">
                <select value={cartelForm.tipo} onChange={e => setCartelForm(f => ({ ...f, tipo: e.target.value }))} style={inp}>
                  {TIPOS_CARTEL.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Dirección">
              <input type="text" placeholder="Av. Colón 1234" value={cartelForm.direccion} onChange={e => setCartelForm(f => ({ ...f, direccion: e.target.value }))} style={inp} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="MLS ID">
                <input type="text" placeholder="MLS-001" value={cartelForm.mlsId} onChange={e => setCartelForm(f => ({ ...f, mlsId: e.target.value }))} style={inp} />
              </Field>
              <Field label="Vencimiento">
                <input type="date" value={cartelForm.vencimiento} onChange={e => setCartelForm(f => ({ ...f, vencimiento: e.target.value }))} style={inp} />
              </Field>
            </div>
            <Field label="Agente *">
              <input type="text" placeholder="Nombre del agente" value={cartelForm.agente} onChange={e => setCartelForm(f => ({ ...f, agente: e.target.value }))} list="agentes-cartel-list" style={inp} required />
              <datalist id="agentes-cartel-list">
                {agentes.map(a => <option key={a.id} value={a.nombre} />)}
              </datalist>
            </Field>
            <ErrorBox />
            <SubmitRow isPending={isPending} onCancel={closeModal} label="Registrar" />
          </form>
        </ModalShell>
      )}

      {/* ════════════ MODAL ENCUESTA ════════════ */}
      {modal === "encuesta" && (
        <ModalShell title="Registrar Encuesta" subtitle="Datos de encuestas del mes" onClose={closeModal}>
          <form onSubmit={handleEncuesta} style={{ padding: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Encuestas enviadas *">
                <input type="number" min="0" placeholder="20" value={encForm.enviadas} onChange={e => setEncForm(f => ({ ...f, enviadas: e.target.value }))} style={inp} required />
              </Field>
              <Field label="Encuestas respondidas *">
                <input type="number" min="0" placeholder="15" value={encForm.respondidas} onChange={e => setEncForm(f => ({ ...f, respondidas: e.target.value }))} style={inp} required />
              </Field>
            </div>
            <Field label="NPS promedio (opcional)">
              <input type="number" min="0" max="10" step="0.1" placeholder="8.5" value={encForm.nps_promedio} onChange={e => setEncForm(f => ({ ...f, nps_promedio: e.target.value }))} style={inp} />
            </Field>
            <ErrorBox />
            <SubmitRow isPending={isPending} onCancel={closeModal} label="Guardar" />
          </form>
        </ModalShell>
      )}

      {/* ════════════ MODAL OPERACIÓN ════════════ */}
      {modal === "operacion" && (
        <ModalShell title="Registrar Operación" subtitle="Nueva operación inmobiliaria" onClose={closeModal}>
          <form onSubmit={handleOperacion} style={{ padding: "20px" }}>
            <Field label="Dirección *">
              <input type="text" placeholder="Av. San Martín 456" value={opForm.direccion} onChange={e => setOpForm(f => ({ ...f, direccion: e.target.value }))} style={inp} required />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Tipo *">
                <select value={opForm.tipo} onChange={e => setOpForm(f => ({ ...f, tipo: e.target.value }))} style={inp} required>
                  {TIPOS_OP.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Fecha *">
                <input type="date" value={opForm.fecha} onChange={e => setOpForm(f => ({ ...f, fecha: e.target.value }))} style={inp} required />
              </Field>
            </div>
            <Field label="Agentes">
              <input type="text" placeholder="Juan, María" value={opForm.agentes} onChange={e => setOpForm(f => ({ ...f, agentes: e.target.value }))} style={inp} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Comisión bruta (USD)">
                <input type="number" min="0" step="0.01" placeholder="5000" value={opForm.comision_bruta} onChange={e => setOpForm(f => ({ ...f, comision_bruta: e.target.value }))} style={inp} />
              </Field>
              <Field label="Comisión neta (USD)">
                <input type="number" min="0" step="0.01" placeholder="4200" value={opForm.comision_neta} onChange={e => setOpForm(f => ({ ...f, comision_neta: e.target.value }))} style={inp} />
              </Field>
            </div>
            <div style={{ display: "flex", gap: "16px", marginBottom: "14px" }}>
              {[
                { key: "encuesta_comprador" as const, label: "Encuesta comprador" },
                { key: "encuesta_vendedor"  as const, label: "Encuesta vendedor"  },
              ].map(({ key, label }) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer", color: "#0F172A" }}>
                  <input type="checkbox" checked={opForm[key]} onChange={e => setOpForm(f => ({ ...f, [key]: e.target.checked }))} style={{ width: "16px", height: "16px", accentColor: "#E31837" }} />
                  {label}
                </label>
              ))}
            </div>
            <ErrorBox />
            <SubmitRow isPending={isPending} onCancel={closeModal} label="Guardar" />
          </form>
        </ModalShell>
      )}

      {/* ════════════ MODAL REGISTRAR OFERTA ════════════ */}
      {modal === "oferta" && (
        <ModalShell title="Registrar Oferta" subtitle="Nueva oferta inmobiliaria" onClose={closeModal}>
          <form onSubmit={handleOferta} style={{ padding: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="N° de oferta *">
                <input type="number" min="1" placeholder="42" value={ofertaForm.numero} onChange={e => setOfertaForm(f => ({ ...f, numero: e.target.value }))} style={inp} required />
              </Field>
              <Field label="Fecha *">
                <input type="date" value={ofertaForm.fecha_oferta} onChange={e => setOfertaForm(f => ({ ...f, fecha_oferta: e.target.value }))} style={inp} required />
              </Field>
            </div>
            <Field label="Dirección *">
              <input type="text" placeholder="Av. San Martín 456" value={ofertaForm.direccion} onChange={e => setOfertaForm(f => ({ ...f, direccion: e.target.value }))} style={inp} required />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Tipología *">
                <select value={ofertaForm.tipologia} onChange={e => setOfertaForm(f => ({ ...f, tipologia: e.target.value }))} style={inp} required>
                  {TIPOLOGIAS_OFERTA.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Tipo operación *">
                <select value={ofertaForm.tipo_operacion} onChange={e => setOfertaForm(f => ({ ...f, tipo_operacion: e.target.value }))} style={inp} required>
                  {TIPOS_OP_OFERTA.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Agente vendedor">
                <select value={ofertaForm.agente_vendedor_id} onChange={e => setOfertaForm(f => ({ ...f, agente_vendedor_id: e.target.value }))} style={inp}>
                  <option value="">— Externo —</option>
                  {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </Field>
              <Field label="Agente comprador">
                <select value={ofertaForm.agente_comprador_id} onChange={e => setOfertaForm(f => ({ ...f, agente_comprador_id: e.target.value }))} style={inp}>
                  <option value="">— Externo —</option>
                  {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Monto ofertado (USD)">
                <input type="number" min="0" step="1" placeholder="150000" value={ofertaForm.monto_ofertado_usd} onChange={e => setOfertaForm(f => ({ ...f, monto_ofertado_usd: e.target.value }))} style={inp} />
              </Field>
              <Field label="Precio publicación (USD)">
                <input type="number" min="0" step="1" placeholder="165000" value={ofertaForm.precio_publicacion_usd} onChange={e => setOfertaForm(f => ({ ...f, precio_publicacion_usd: e.target.value }))} style={inp} />
              </Field>
            </div>
            <Field label="Notas">
              <textarea value={ofertaForm.notas} onChange={e => setOfertaForm(f => ({ ...f, notas: e.target.value }))} rows={2} style={{ ...inp, resize: "vertical" }} placeholder="Observaciones iniciales..." />
            </Field>
            <ErrorBox />
            <SubmitRow isPending={isPending} onCancel={closeModal} label="Registrar oferta" />
          </form>
        </ModalShell>
      )}

      {/* ════════════ MODAL ACTUALIZAR OFERTA ════════════ */}
      {modal === "actualizar_oferta" && (
        <ModalShell title="Actualizar Oferta" subtitle="Agregar movimiento a una oferta activa" onClose={closeModal}>
          <form onSubmit={handleActualizar} style={{ padding: "20px" }}>
            {ofertasActivas.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>
                No hay ofertas activas en este momento
              </div>
            ) : (
              <>
                <Field label="Oferta *">
                  <select value={actualizarForm.oferta_id} onChange={e => setActualizarForm(f => ({ ...f, oferta_id: e.target.value }))} style={inp} required>
                    {ofertasActivas.map(o => (
                      <option key={o.id} value={o.id}>
                        #{o.numero} — {o.direccion} ({o.estado})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tipo de movimiento *">
                  <select value={actualizarForm.tipo} onChange={e => setActualizarForm(f => ({ ...f, tipo: e.target.value }))} style={inp} required>
                    {TIPOS_MOVIMIENTO.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Descripción *">
                  <textarea value={actualizarForm.descripcion} onChange={e => setActualizarForm(f => ({ ...f, descripcion: e.target.value }))} rows={3} style={{ ...inp, resize: "vertical" }} placeholder="Descripción del movimiento..." required />
                </Field>
                <Field label="Monto (USD, opcional)">
                  <input type="number" min="0" step="0.01" placeholder="0" value={actualizarForm.monto_usd} onChange={e => setActualizarForm(f => ({ ...f, monto_usd: e.target.value }))} style={inp} />
                </Field>
                <ErrorBox />
                <SubmitRow isPending={isPending} onCancel={closeModal} label="Guardar movimiento" />
              </>
            )}
          </form>
        </ModalShell>
      )}
    </>
  )
}
