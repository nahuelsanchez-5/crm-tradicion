"use client"

import { useState, useTransition, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { crearPago } from "@/app/pagos/actions"
import { guardarEncuesta } from "@/app/encuestas/actions"
import { crearOperacion } from "@/app/operaciones/actions"
import { crearOferta } from "@/app/ofertas/actions"
import { agregarMovimiento } from "@/app/ofertas/actions"
import type { OfertaActiva } from "@/app/page"
import {
  X, Loader2, DollarSign, MapPin, ClipboardList,
  Building2, Handshake, RefreshCw, LucideIcon,
} from "lucide-react"

interface AgenteSimple  { id: string; nombre: string }
interface CartelBuscarResult {
  found:               boolean
  airtable_record_id?: string
  nro_cartel?:         number
  direccion?:          string
  agente?:             string
  tipo_propiedad?:     string
  error?:              string
}
interface Props { agentes: AgenteSimple[]; ofertasActivas: OfertaActiva[] }
type ModalT = "none" | "pago" | "carteleria" | "encuesta" | "operacion" | "oferta" | "actualizar_oferta"

const CONCEPTOS_PAGO      = ["FEE mensual", "Licencias CRM", "Mainstreet", "Otros"]
const TIPOS_OP            = ["Venta", "Alquiler", "Alquiler Temporal", "Referido", "Otro"]
const TIPOLOGIAS_OFERTA   = ["Casa", "Departamento", "Terreno", "Local Comercial", "Oficina", "PH", "Campo", "Galpón", "Edificio", "Otro"]
const TIPOS_OP_OFERTA     = ["Venta", "Alquiler", "Alquiler Temporal"]
const TIPOS_MOVIMIENTO    = ["Seguimiento", "Llamada", "Reunión", "Nota", "Documentación", "Otro"]

// ── Shared field wrapper ─────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="crm-label">{label}</label>
      {children}
    </div>
  )
}

// ── Modal shell ──────────────────────────────────────
function ModalShell({ title, subtitle, onClose, children }: {
  title: string; subtitle: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div className="crm-modal-backdrop" onClick={onClose}>
      <div className="crm-modal" onClick={e => e.stopPropagation()}>
        <div className="crm-modal-header">
          <div>
            <h2 className="text-[17px] font-bold m-0" style={{ color: "var(--crm-text)" }}>{title}</h2>
            <p className="text-[12px] m-0 mt-0.5" style={{ color: "var(--crm-text-muted)" }}>{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="border-none rounded-lg w-8 h-8 flex items-center justify-center cursor-pointer transition-colors duration-150 hover:bg-white/10"
            style={{ background: "rgba(255,255,255,0.08)", color: "var(--crm-text-muted)" }}
          >
            <X size={15} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

// ── Submit row ───────────────────────────────────────
function SubmitRow({ isPending, onCancel, label }: { isPending: boolean; onCancel: () => void; label: string }) {
  return (
    <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end pt-1">
      <button
        type="button" onClick={onCancel} disabled={isPending}
        className="crm-btn-secondary w-full sm:w-auto px-5 py-3 sm:py-2.5 min-h-[44px]"
        style={{ fontFamily: "inherit" }}
      >
        Cancelar
      </button>
      <button
        type="submit" disabled={isPending}
        className="crm-btn-primary w-full sm:w-auto px-6 py-3 sm:py-2.5 min-h-[44px]"
        style={{ fontFamily: "inherit" }}
      >
        {isPending && <Loader2 size={14} className="animate-spin" />}
        {isPending ? "Guardando..." : label}
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
export default function DashboardActions({ agentes, ofertasActivas }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [modal,      setModal]       = useState<ModalT>("none")
  const [error,      setError]       = useState("")

  const todayStr   = new Date().toISOString().split("T")[0]
  const mesActual  = new Date().getMonth() + 1
  const anioActual = new Date().getFullYear()

  const [pagoForm,      setPagoForm]      = useState({ agente_id: agentes[0]?.id ?? "", concepto: CONCEPTOS_PAGO[0], monto_pagado: "", fecha: todayStr })
  const [encForm,       setEncForm]       = useState({ mes: mesActual, anio: anioActual, enviadas: "", respondidas: "", nps_promedio: "" })
  const [opForm,        setOpForm]        = useState({ fecha: todayStr, direccion: "", agentes: "", tipo: TIPOS_OP[0], comision_bruta: "", comision_neta: "", encuesta_comprador: false, encuesta_vendedor: false })
  const [cartelNro,        setCartelNro]        = useState("")
  const [cartelSearching,  setCartelSearching]  = useState(false)
  const [cartelResult,     setCartelResult]     = useState<CartelBuscarResult | null>(null)
  const [cartelDirEdit,    setCartelDirEdit]    = useState("")
  const [cartelAgenteEdit, setCartelAgenteEdit] = useState("")
  const [toastMsg,         setToastMsg]         = useState("")
  const [ofertaForm,    setOfertaForm]    = useState({ numero: "", direccion: "", tipologia: TIPOLOGIAS_OFERTA[0], tipo_operacion: TIPOS_OP_OFERTA[0], agente_vendedor_id: agentes[0]?.id ?? "", agente_comprador_id: "", monto_ofertado_usd: "", precio_publicacion_usd: "", fecha_oferta: todayStr, notas: "" })
  const [actualizarForm, setActualizarForm] = useState({ oferta_id: ofertasActivas[0]?.id ?? "", tipo: TIPOS_MOVIMIENTO[0], descripcion: "", monto_usd: "" })

  const closeModal = useCallback(() => { setModal("none"); setError("") }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal() }
    if (modal !== "none") document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [modal, closeModal])

  useEffect(() => {
    if (modal !== "carteleria") return
    const n = Number(cartelNro)
    if (!cartelNro || !Number.isFinite(n) || n <= 0) {
      setCartelResult(null)
      setCartelSearching(false)
      return
    }
    setCartelResult(null)
    setCartelSearching(true)
    const t = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/carteleria/buscar?nro=${encodeURIComponent(cartelNro)}`)
        const json = await res.json() as CartelBuscarResult
        setCartelResult(json)
      } catch {
        setCartelResult({ found: false, error: "Error de conexión" })
      } finally {
        setCartelSearching(false)
      }
    }, 600)
    return () => clearTimeout(t)
  }, [cartelNro, modal])

  function openModal(m: ModalT) {
    setError("")
    setPagoForm({ agente_id: agentes[0]?.id ?? "", concepto: CONCEPTOS_PAGO[0], monto_pagado: "", fecha: todayStr })
    setOpForm({ fecha: todayStr, direccion: "", agentes: "", tipo: TIPOS_OP[0], comision_bruta: "", comision_neta: "", encuesta_comprador: false, encuesta_vendedor: false })
    setCartelNro("")
    setCartelResult(null)
    setCartelDirEdit("")
    setCartelAgenteEdit("")
    setOfertaForm({ numero: "", direccion: "", tipologia: TIPOLOGIAS_OFERTA[0], tipo_operacion: TIPOS_OP_OFERTA[0], agente_vendedor_id: agentes[0]?.id ?? "", agente_comprador_id: "", monto_ofertado_usd: "", precio_publicacion_usd: "", fecha_oferta: todayStr, notas: "" })
    setActualizarForm({ oferta_id: ofertasActivas[0]?.id ?? "", tipo: TIPOS_MOVIMIENTO[0], descripcion: "", monto_usd: "" })
    setModal(m)
  }

  function handlePago(e: React.FormEvent) {
    e.preventDefault()
    const pagado = parseFloat(pagoForm.monto_pagado) || 0
    if (pagado <= 0) { setError("El monto debe ser mayor a 0"); return }
    startTransition(async () => {
      const r = await crearPago({ agente_id: pagoForm.agente_id, fecha: pagoForm.fecha, concepto: pagoForm.concepto, monto_debe: pagado, monto_pagado: pagado })
      if (r.error) setError(r.error)
      else { closeModal(); router.refresh() }
    })
  }

  function handleEncuesta(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await guardarEncuesta({ mes: encForm.mes, anio: encForm.anio, enviadas: parseInt(encForm.enviadas) || 0, respondidas: parseInt(encForm.respondidas) || 0, nps_promedio: encForm.nps_promedio ? parseFloat(encForm.nps_promedio) : null })
      if (r.error) setError(r.error)
      else { closeModal(); router.refresh() }
    })
  }

  function handleOperacion(e: React.FormEvent) {
    e.preventDefault()
    if (!opForm.direccion) { setError("La dirección es obligatoria"); return }
    startTransition(async () => {
      const r = await crearOperacion({ fecha: opForm.fecha, direccion: opForm.direccion, agentes: opForm.agentes, tipo: opForm.tipo, comision_bruta: parseFloat(opForm.comision_bruta) || 0, comision_neta: parseFloat(opForm.comision_neta) || 0, encuesta_comprador: opForm.encuesta_comprador, encuesta_vendedor: opForm.encuesta_vendedor })
      if (r.error) setError(r.error)
      else { closeModal(); router.refresh() }
    })
  }

  function handleConfirmDevolucion(e: React.FormEvent) {
    e.preventDefault()
    if (!cartelResult || !cartelNro) return
    const nro = Number(cartelNro)
    startTransition(async () => {
      try {
        const body = cartelResult.found
          ? {
              airtable_record_id: cartelResult.airtable_record_id,
              nro_cartel:         nro,
              direccion:          cartelResult.direccion,
              agente:             cartelResult.agente,
              tipo_propiedad:     cartelResult.tipo_propiedad,
            }
          : {
              airtable_record_id: null,
              nro_cartel:         nro,
              direccion:          cartelDirEdit.trim() || null,
              agente:             cartelAgenteEdit.trim() || null,
              tipo_propiedad:     null,
            }
        const res    = await fetch("/api/carteleria/devolver", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(body),
        })
        const result = await res.json() as { success: boolean; error?: string }
        if (!result.success) {
          setError(result.error ?? "Error al registrar la devolución")
        } else {
          closeModal()
          setToastMsg(`Cartel Nº ${nro} registrado como devuelto`)
          setTimeout(() => setToastMsg(""), 4000)
          router.refresh()
        }
      } catch {
        setError("Error de conexión")
      }
    })
  }

  function handleOferta(e: React.FormEvent) {
    e.preventDefault()
    if (!ofertaForm.numero || !ofertaForm.direccion) { setError("Número y dirección son obligatorios"); return }
    startTransition(async () => {
      const r = await crearOferta({ numero: parseInt(ofertaForm.numero), direccion: ofertaForm.direccion, tipologia: ofertaForm.tipologia, tipo_operacion: ofertaForm.tipo_operacion, agente_vendedor_id: ofertaForm.agente_vendedor_id || null, agente_comprador_id: ofertaForm.agente_comprador_id || null, agente_vendedor_externo: null, agente_comprador_externo: null, tiene_reserva: false, monto_reserva_usd: null, monto_ofertado_usd: ofertaForm.monto_ofertado_usd ? parseFloat(ofertaForm.monto_ofertado_usd) : null, precio_publicacion_usd: ofertaForm.precio_publicacion_usd ? parseFloat(ofertaForm.precio_publicacion_usd) : null, fecha_oferta: ofertaForm.fecha_oferta, es_bis: false, numero_padre: null, notas: ofertaForm.notas || null })
      if (r.error) setError(r.error)
      else { closeModal(); router.refresh() }
    })
  }

  function handleActualizar(e: React.FormEvent) {
    e.preventDefault()
    if (!actualizarForm.oferta_id || !actualizarForm.descripcion) { setError("Seleccioná una oferta y agregá una descripción"); return }
    startTransition(async () => {
      const r = await agregarMovimiento(actualizarForm.oferta_id, actualizarForm.tipo, actualizarForm.descripcion, actualizarForm.monto_usd ? parseFloat(actualizarForm.monto_usd) : null)
      if (r.error) setError(r.error)
      else { closeModal(); router.refresh() }
    })
  }

  const QUICK_BTNS: Array<{
    icon: LucideIcon; label: string; sublabel: string; m: ModalT
    iconBg: string; iconColor: string
  }> = [
    { icon: DollarSign,    label: "Registrar",  sublabel: "Pago",       m: "pago",             iconBg: "bg-emerald-500/[0.12]", iconColor: "text-emerald-400" },
    { icon: MapPin,        label: "Devolución", sublabel: "Cartelería", m: "carteleria",       iconBg: "bg-amber-500/[0.12]",   iconColor: "text-amber-400"   },
    { icon: ClipboardList, label: "Registrar",  sublabel: "Encuesta",   m: "encuesta",         iconBg: "bg-blue-500/[0.12]",    iconColor: "text-blue-400"    },
    { icon: Building2,     label: "Registrar",  sublabel: "Operación",  m: "operacion",        iconBg: "bg-orange-500/[0.12]",  iconColor: "text-orange-400"  },
    { icon: Handshake,     label: "Registrar",  sublabel: "Oferta",     m: "oferta",           iconBg: "bg-violet-500/[0.12]",  iconColor: "text-violet-400"  },
    { icon: RefreshCw,     label: "Actualizar", sublabel: "Oferta",     m: "actualizar_oferta",iconBg: "bg-sky-500/[0.12]",     iconColor: "text-sky-400"     },
  ]

  const ErrorBox = () => error ? (
    <div
      className="rounded-lg px-3 py-2.5 text-[12.5px] mb-4"
      style={{ background: "rgba(227,24,55,0.12)", border: "1px solid rgba(227,24,55,0.25)", color: "var(--crm-accent-light)" }}
    >
      ⚠️ {error}
    </div>
  ) : null

  const inp = "crm-input"

  return (
    <>
      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: "fixed", top: "20px", right: "20px", zIndex: 9999,
          background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)",
          borderRadius: "10px", padding: "12px 18px",
          color: "#34d399", fontSize: "13px", fontWeight: 600,
          backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", gap: "8px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}>
          ✓ {toastMsg}
        </div>
      )}

      {/* Quick action buttons */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5 md:gap-3 mb-5 md:mb-6">
        {QUICK_BTNS.map(({ icon: Icon, label, sublabel, m, iconBg, iconColor }) => (
          <button
            key={m}
            onClick={() => m === "encuesta" ? router.push("/encuestas") : openModal(m)}
            className="crm-quick-btn flex flex-col items-center justify-center gap-2 md:gap-3 p-3 md:p-5 cursor-pointer min-h-[88px] md:min-h-[110px] backdrop-blur-[4px]"
            style={{ fontFamily: "inherit" }}
          >
            <div className={`w-11 h-11 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>
              <Icon size={18} className={iconColor} strokeWidth={1.75} />
            </div>
            <div className="text-center leading-tight">
              <p className="text-[9.5px] md:text-[10.5px] font-medium text-white/50 m-0">{label}</p>
              <p className="text-[12px] md:text-[13px] font-bold text-white m-0 mt-0.5">{sublabel}</p>
            </div>
          </button>
        ))}
      </div>

      {/* MODAL PAGO */}
      {modal === "pago" && (
        <ModalShell title="Registrar Pago" subtitle="Nuevo registro de cobro" onClose={closeModal}>
          <form onSubmit={handlePago} className="p-6">
            <Field label="Agente *">
              <select value={pagoForm.agente_id} onChange={e => setPagoForm(f => ({ ...f, agente_id: e.target.value }))} className={inp} required>
                {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Concepto *">
                <select value={pagoForm.concepto} onChange={e => setPagoForm(f => ({ ...f, concepto: e.target.value }))} className={inp} required>
                  {CONCEPTOS_PAGO.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Fecha *">
                <input type="date" value={pagoForm.fecha} onChange={e => setPagoForm(f => ({ ...f, fecha: e.target.value }))} className={inp} required />
              </Field>
            </div>
            <Field label="Monto pagado (USD) *">
              <input type="number" min="0" step="0.01" placeholder="95.25" value={pagoForm.monto_pagado} onChange={e => setPagoForm(f => ({ ...f, monto_pagado: e.target.value }))} className={inp} required />
            </Field>
            <ErrorBox />
            <SubmitRow isPending={isPending} onCancel={closeModal} label="Guardar" />
          </form>
        </ModalShell>
      )}

      {/* MODAL CARTELERÍA — DEVOLUCIÓN */}
      {modal === "carteleria" && (
        <ModalShell title="Devolución de Cartelería" subtitle="Ingresá el número de cartel" onClose={closeModal}>
          <form onSubmit={handleConfirmDevolucion} className="p-6">

            {/* Paso 1 — Búsqueda */}
            <Field label="Nº de cartel">
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  min="1"
                  placeholder="Ej: 42"
                  value={cartelNro}
                  onChange={e => setCartelNro(e.target.value)}
                  className={inp}
                  autoFocus
                />
                {cartelSearching && (
                  <span style={{
                    position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
                    display: "flex", alignItems: "center",
                  }}>
                    <Loader2 size={14} className="animate-spin" style={{ color: "var(--crm-text-muted)" }} />
                  </span>
                )}
              </div>
            </Field>

            {/* Paso 2A — Encontrado */}
            {cartelResult?.found && (
              <>
                <div style={{
                  background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)",
                  borderRadius: "8px", padding: "8px 12px", fontSize: "12px", color: "#34d399",
                  marginBottom: "14px",
                }}>
                  ✓ Cartel encontrado en Airtable
                </div>
                <Field label="Dirección">
                  <input
                    type="text" readOnly
                    value={cartelResult.direccion || "—"}
                    className={inp}
                    style={{ opacity: 0.6, cursor: "default" }}
                  />
                </Field>
                <Field label="Agente">
                  <input
                    type="text" readOnly
                    value={cartelResult.agente || "—"}
                    className={inp}
                    style={{ opacity: 0.6, cursor: "default" }}
                  />
                </Field>
              </>
            )}

            {/* Paso 2B — No encontrado */}
            {cartelResult && !cartelResult.found && (
              <>
                <div style={{
                  background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)",
                  borderRadius: "8px", padding: "8px 12px", fontSize: "12px", color: "#fbbf24",
                  marginBottom: "14px",
                }}>
                  ⚠ Cartel no encontrado en Airtable
                </div>
                <Field label="Dirección (opcional)">
                  <input
                    type="text"
                    placeholder="Av. San Martín 456"
                    value={cartelDirEdit}
                    onChange={e => setCartelDirEdit(e.target.value)}
                    className={inp}
                  />
                </Field>
                <Field label="Agente (opcional)">
                  <input
                    type="text"
                    placeholder="Nombre del agente"
                    value={cartelAgenteEdit}
                    onChange={e => setCartelAgenteEdit(e.target.value)}
                    className={inp}
                  />
                </Field>
              </>
            )}

            <ErrorBox />

            <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end pt-1">
              <button
                type="button" onClick={closeModal} disabled={isPending}
                className="crm-btn-secondary w-full sm:w-auto px-5 py-3 sm:py-2.5 min-h-[44px]"
                style={{ fontFamily: "inherit" }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending || cartelSearching || !cartelResult || !cartelNro}
                className="crm-btn-primary w-full sm:w-auto px-6 py-3 sm:py-2.5 min-h-[44px]"
                style={{ fontFamily: "inherit" }}
              >
                {isPending && <Loader2 size={14} className="animate-spin" />}
                {isPending ? "Registrando..." : "Confirmar devolución"}
              </button>
            </div>

          </form>
        </ModalShell>
      )}

      {/* MODAL ENCUESTA */}
      {modal === "encuesta" && (
        <ModalShell title="Registrar Encuesta" subtitle="Datos de encuestas del mes" onClose={closeModal}>
          <form onSubmit={handleEncuesta} className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Encuestas enviadas *">
                <input type="number" min="0" placeholder="20" value={encForm.enviadas} onChange={e => setEncForm(f => ({ ...f, enviadas: e.target.value }))} className={inp} required />
              </Field>
              <Field label="Encuestas respondidas *">
                <input type="number" min="0" placeholder="15" value={encForm.respondidas} onChange={e => setEncForm(f => ({ ...f, respondidas: e.target.value }))} className={inp} required />
              </Field>
            </div>
            <Field label="NPS promedio (opcional)">
              <input type="number" min="0" max="10" step="0.1" placeholder="8.5" value={encForm.nps_promedio} onChange={e => setEncForm(f => ({ ...f, nps_promedio: e.target.value }))} className={inp} />
            </Field>
            <ErrorBox />
            <SubmitRow isPending={isPending} onCancel={closeModal} label="Guardar" />
          </form>
        </ModalShell>
      )}

      {/* MODAL OPERACIÓN */}
      {modal === "operacion" && (
        <ModalShell title="Registrar Operación" subtitle="Nueva operación inmobiliaria" onClose={closeModal}>
          <form onSubmit={handleOperacion} className="p-6">
            <Field label="Dirección *">
              <input type="text" placeholder="Av. San Martín 456" value={opForm.direccion} onChange={e => setOpForm(f => ({ ...f, direccion: e.target.value }))} className={inp} required />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Tipo *">
                <select value={opForm.tipo} onChange={e => setOpForm(f => ({ ...f, tipo: e.target.value }))} className={inp} required>
                  {TIPOS_OP.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Fecha *">
                <input type="date" value={opForm.fecha} onChange={e => setOpForm(f => ({ ...f, fecha: e.target.value }))} className={inp} required />
              </Field>
            </div>
            <Field label="Agentes">
              <input type="text" placeholder="Juan, María" value={opForm.agentes} onChange={e => setOpForm(f => ({ ...f, agentes: e.target.value }))} className={inp} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Comisión bruta (USD)">
                <input type="number" min="0" step="0.01" placeholder="5000" value={opForm.comision_bruta} onChange={e => setOpForm(f => ({ ...f, comision_bruta: e.target.value }))} className={inp} />
              </Field>
              <Field label="Comisión neta (USD)">
                <input type="number" min="0" step="0.01" placeholder="4200" value={opForm.comision_neta} onChange={e => setOpForm(f => ({ ...f, comision_neta: e.target.value }))} className={inp} />
              </Field>
            </div>
            <div className="flex gap-5 mb-5">
              {([
                { key: "encuesta_comprador" as const, label: "Encuesta comprador" },
                { key: "encuesta_vendedor"  as const, label: "Encuesta vendedor" },
              ] as const).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: "var(--crm-text-muted)" }}>
                  <input type="checkbox" checked={opForm[key]} onChange={e => setOpForm(f => ({ ...f, [key]: e.target.checked }))} className="w-4 h-4 accent-[#E31837]" />
                  {label}
                </label>
              ))}
            </div>
            <ErrorBox />
            <SubmitRow isPending={isPending} onCancel={closeModal} label="Guardar" />
          </form>
        </ModalShell>
      )}

      {/* MODAL REGISTRAR OFERTA */}
      {modal === "oferta" && (
        <ModalShell title="Registrar Oferta" subtitle="Nueva oferta inmobiliaria" onClose={closeModal}>
          <form onSubmit={handleOferta} className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="N° de oferta *">
                <input type="number" min="1" placeholder="42" value={ofertaForm.numero} onChange={e => setOfertaForm(f => ({ ...f, numero: e.target.value }))} className={inp} required />
              </Field>
              <Field label="Fecha *">
                <input type="date" value={ofertaForm.fecha_oferta} onChange={e => setOfertaForm(f => ({ ...f, fecha_oferta: e.target.value }))} className={inp} required />
              </Field>
            </div>
            <Field label="Dirección *">
              <input type="text" placeholder="Av. San Martín 456" value={ofertaForm.direccion} onChange={e => setOfertaForm(f => ({ ...f, direccion: e.target.value }))} className={inp} required />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Tipología *">
                <select value={ofertaForm.tipologia} onChange={e => setOfertaForm(f => ({ ...f, tipologia: e.target.value }))} className={inp} required>
                  {TIPOLOGIAS_OFERTA.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Tipo operación *">
                <select value={ofertaForm.tipo_operacion} onChange={e => setOfertaForm(f => ({ ...f, tipo_operacion: e.target.value }))} className={inp} required>
                  {TIPOS_OP_OFERTA.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Agente vendedor">
                <select value={ofertaForm.agente_vendedor_id} onChange={e => setOfertaForm(f => ({ ...f, agente_vendedor_id: e.target.value }))} className={inp}>
                  <option value="">— Externo —</option>
                  {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </Field>
              <Field label="Agente comprador">
                <select value={ofertaForm.agente_comprador_id} onChange={e => setOfertaForm(f => ({ ...f, agente_comprador_id: e.target.value }))} className={inp}>
                  <option value="">— Externo —</option>
                  {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Monto ofertado (USD)">
                <input type="number" min="0" step="1" placeholder="150000" value={ofertaForm.monto_ofertado_usd} onChange={e => setOfertaForm(f => ({ ...f, monto_ofertado_usd: e.target.value }))} className={inp} />
              </Field>
              <Field label="Precio publicación (USD)">
                <input type="number" min="0" step="1" placeholder="165000" value={ofertaForm.precio_publicacion_usd} onChange={e => setOfertaForm(f => ({ ...f, precio_publicacion_usd: e.target.value }))} className={inp} />
              </Field>
            </div>
            <Field label="Notas">
              <textarea value={ofertaForm.notas} onChange={e => setOfertaForm(f => ({ ...f, notas: e.target.value }))} rows={2} className={`${inp} resize-y`} placeholder="Observaciones iniciales..." />
            </Field>
            <ErrorBox />
            <SubmitRow isPending={isPending} onCancel={closeModal} label="Registrar oferta" />
          </form>
        </ModalShell>
      )}

      {/* MODAL ACTUALIZAR OFERTA */}
      {modal === "actualizar_oferta" && (
        <ModalShell title="Actualizar Oferta" subtitle="Agregar movimiento a una oferta activa" onClose={closeModal}>
          <form onSubmit={handleActualizar} className="p-6">
            {ofertasActivas.length === 0 ? (
              <div className="py-8 text-center text-[13px]" style={{ color: "var(--crm-text-muted)" }}>
                No hay ofertas activas en este momento
              </div>
            ) : (
              <>
                <Field label="Oferta *">
                  <select value={actualizarForm.oferta_id} onChange={e => setActualizarForm(f => ({ ...f, oferta_id: e.target.value }))} className={inp} required>
                    {ofertasActivas.map(o => (
                      <option key={o.id} value={o.id}>#{o.numero} — {o.direccion} ({o.estado})</option>
                    ))}
                  </select>
                </Field>
                <Field label="Tipo de movimiento *">
                  <select value={actualizarForm.tipo} onChange={e => setActualizarForm(f => ({ ...f, tipo: e.target.value }))} className={inp} required>
                    {TIPOS_MOVIMIENTO.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Descripción *">
                  <textarea value={actualizarForm.descripcion} onChange={e => setActualizarForm(f => ({ ...f, descripcion: e.target.value }))} rows={3} className={`${inp} resize-y`} placeholder="Descripción del movimiento..." required />
                </Field>
                <Field label="Monto (USD, opcional)">
                  <input type="number" min="0" step="0.01" placeholder="0" value={actualizarForm.monto_usd} onChange={e => setActualizarForm(f => ({ ...f, monto_usd: e.target.value }))} className={inp} />
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
