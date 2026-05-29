"use client"

import { useState, useTransition, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { crearPago } from "@/app/pagos/actions"
import { guardarEncuesta } from "@/app/encuestas/actions"
import { crearOperacion } from "@/app/operaciones/actions"
import { crearCartel } from "@/app/carteleria/actions"
import { X, Loader2 } from "lucide-react"

// ── Types ────────────────────────────────────────────
interface AgenteSimple {
  id: string
  nombre: string
}

interface Props {
  agentes: AgenteSimple[]
}

type ModalT = "none" | "pago" | "carteleria" | "encuesta" | "operacion"

// ── Constants ────────────────────────────────────────
const CONCEPTOS_PAGO = ["FEE mensual", "Licencias CRM", "Mainstreet", "Otros"]
const TIPOS_OP       = ["Venta", "Alquiler", "Alquiler Temporal", "Referido", "Otro"]
const TIPOS_CARTEL   = ["Casa", "Terreno", "Local", "Departamento", "Campo", "Galpón"]

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

function ModalShell({
  title, subtitle, onClose, children,
}: {
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
            <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A", margin: 0 }}>
              {title}
            </h2>
            <p style={{ fontSize: "12px", color: "#64748B", margin: 0, marginTop: "2px" }}>
              {subtitle}
            </p>
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

function SubmitRow({
  isPending, onCancel, label,
}: { isPending: boolean; onCancel: () => void; label: string }) {
  return (
    <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
      <button type="button" onClick={onCancel} disabled={isPending}
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
        {isPending ? "Guardando..." : label}
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export default function DashboardActions({ agentes }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [modal,  setModal]  = useState<ModalT>("none")
  const [error,  setError]  = useState("")

  const todayStr = new Date().toISOString().split("T")[0]

  // ── Pago form ──────────────────────────────────────
  const [pagoForm, setPagoForm] = useState({
    agente_id: agentes[0]?.id ?? "",
    concepto:  CONCEPTOS_PAGO[0],
    monto_debe:   "",
    monto_pagado: "0",
    fecha: todayStr,
  })

  // ── Encuesta form ──────────────────────────────────
  const mesActual = new Date().getMonth() + 1
  const anioActual = new Date().getFullYear()
  const [encForm, setEncForm] = useState({
    mes:          mesActual,
    anio:         anioActual,
    enviadas:     "",
    respondidas:  "",
    nps_promedio: "",
  })

  // ── Operación form ─────────────────────────────────
  const [opForm, setOpForm] = useState({
    fecha:              todayStr,
    direccion:          "",
    agentes:            "",
    tipo:               TIPOS_OP[0],
    comision_bruta:     "",
    comision_neta:      "",
    encuesta_comprador: false,
    encuesta_vendedor:  false,
  })

  // ── Cartelería form ────────────────────────────────
  const [cartelForm, setCartelForm] = useState({
    numero:      "",
    direccion:   "",
    mlsId:       "",
    vencimiento: todayStr,
    tipo:        TIPOS_CARTEL[0],
    agente:      "",
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
    setModal(m)
  }

  // ── Submit: Pago ───────────────────────────────────
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

  // ── Submit: Encuesta ───────────────────────────────
  function handleEncuesta(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await guardarEncuesta({
        mes:          encForm.mes,
        anio:         encForm.anio,
        enviadas:     parseInt(encForm.enviadas)    || 0,
        respondidas:  parseInt(encForm.respondidas) || 0,
        nps_promedio: encForm.nps_promedio ? parseFloat(encForm.nps_promedio) : null,
      })
      if (r.error) setError(r.error)
      else { closeModal(); router.refresh() }
    })
  }

  // ── Submit: Operación ──────────────────────────────
  function handleOperacion(e: React.FormEvent) {
    e.preventDefault()
    if (!opForm.direccion) { setError("La dirección es obligatoria"); return }
    startTransition(async () => {
      const r = await crearOperacion({
        fecha:              opForm.fecha,
        direccion:          opForm.direccion,
        agentes:            opForm.agentes,
        tipo:               opForm.tipo,
        comision_bruta:     parseFloat(opForm.comision_bruta) || 0,
        comision_neta:      parseFloat(opForm.comision_neta)  || 0,
        encuesta_comprador: opForm.encuesta_comprador,
        encuesta_vendedor:  opForm.encuesta_vendedor,
      })
      if (r.error) setError(r.error)
      else { closeModal(); router.refresh() }
    })
  }

  // ── Submit: Cartelería ─────────────────────────────
  function handleCarteleria(e: React.FormEvent) {
    e.preventDefault()
    if (!cartelForm.numero || !cartelForm.agente) { setError("Número y agente son obligatorios"); return }
    startTransition(async () => {
      const r = await crearCartel({
        numero:      parseInt(cartelForm.numero) || 0,
        direccion:   cartelForm.direccion,
        mlsId:       cartelForm.mlsId,
        vencimiento: cartelForm.vencimiento,
        tipo:        cartelForm.tipo,
        agente:      cartelForm.agente,
      })
      if (r.error) setError(r.error)
      else { closeModal(); router.refresh() }
    })
  }

  const btnBase: React.CSSProperties = {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: "8px", padding: "18px 12px", borderRadius: "14px",
    border: "1.5px solid #EAECF2", background: "white",
    cursor: "pointer", fontFamily: "inherit",
    fontSize: "13px", fontWeight: 700, color: "#0F172A",
    transition: "all 0.15s", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  }

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
        display: "grid", gridTemplateColumns: "repeat(4,1fr)",
        gap: "12px", margin: "20px 0",
      }}>
        {[
          { emoji: "💰", label: "Registrar\nPago",       m: "pago"       as ModalT },
          { emoji: "🪧", label: "Devolución\nCartelería", m: "carteleria" as ModalT },
          { emoji: "📋", label: "Registrar\nEncuesta",   m: "encuesta"   as ModalT },
          { emoji: "🏠", label: "Registrar\nOperación",  m: "operacion"  as ModalT },
        ].map(({ emoji, label, m }) => (
          <button key={m} onClick={() => openModal(m)} style={btnBase}>
            <span style={{ fontSize: "26px", lineHeight: 1 }}>{emoji}</span>
            <span style={{ textAlign: "center", lineHeight: 1.3, whiteSpace: "pre-line" }}>{label}</span>
          </button>
        ))}
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
              <input
                type="text"
                placeholder="Nombre del agente"
                value={cartelForm.agente}
                onChange={e => setCartelForm(f => ({ ...f, agente: e.target.value }))}
                list="agentes-cartel-list"
                style={inp}
                required
              />
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
                  <input
                    type="checkbox"
                    checked={opForm[key]}
                    onChange={e => setOpForm(f => ({ ...f, [key]: e.target.checked }))}
                    style={{ width: "16px", height: "16px", accentColor: "#E31837" }}
                  />
                  {label}
                </label>
              ))}
            </div>
            <ErrorBox />
            <SubmitRow isPending={isPending} onCancel={closeModal} label="Guardar" />
          </form>
        </ModalShell>
      )}
    </>
  )
}
