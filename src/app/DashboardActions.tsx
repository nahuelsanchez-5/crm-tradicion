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

interface AgenteSimple { id: string; nombre: string }
interface Props { agentes: AgenteSimple[]; ofertasActivas: OfertaActiva[] }
type ModalT = "none" | "pago" | "carteleria" | "encuesta" | "operacion" | "oferta" | "actualizar_oferta"

const CONCEPTOS_PAGO      = ["FEE mensual", "Licencias CRM", "Mainstreet", "Otros"]
const TIPOS_OP            = ["Venta", "Alquiler", "Alquiler Temporal", "Referido", "Otro"]
const TIPOS_CARTEL        = ["Casa", "Terreno", "Local", "Departamento", "Campo", "Galpón"]
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
            <h2 className="text-[17px] font-bold text-slate-900 m-0">{title}</h2>
            <p className="text-[12px] text-slate-500 m-0 mt-0.5">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 border-none rounded-lg w-8 h-8 flex items-center justify-center cursor-pointer text-slate-500 transition-colors duration-150"
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
        className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors duration-150 disabled:opacity-50 min-h-[44px]"
        style={{ fontFamily: "inherit" }}
      >
        Cancelar
      </button>
      <button
        type="submit" disabled={isPending}
        className="w-full sm:w-auto px-6 py-3 sm:py-2.5 rounded-lg border-none bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold cursor-pointer flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-md min-h-[44px]"
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

  const [pagoForm,      setPagoForm]      = useState({ agente_id: agentes[0]?.id ?? "", concepto: CONCEPTOS_PAGO[0], monto_debe: "", monto_pagado: "0", fecha: todayStr })
  const [encForm,       setEncForm]       = useState({ mes: mesActual, anio: anioActual, enviadas: "", respondidas: "", nps_promedio: "" })
  const [opForm,        setOpForm]        = useState({ fecha: todayStr, direccion: "", agentes: "", tipo: TIPOS_OP[0], comision_bruta: "", comision_neta: "", encuesta_comprador: false, encuesta_vendedor: false })
  const [cartelForm,    setCartelForm]    = useState({ numero: "", direccion: "", mlsId: "", vencimiento: todayStr, tipo: TIPOS_CARTEL[0], agente: "" })
  const [ofertaForm,    setOfertaForm]    = useState({ numero: "", direccion: "", tipologia: TIPOLOGIAS_OFERTA[0], tipo_operacion: TIPOS_OP_OFERTA[0], agente_vendedor_id: agentes[0]?.id ?? "", agente_comprador_id: "", monto_ofertado_usd: "", precio_publicacion_usd: "", fecha_oferta: todayStr, notas: "" })
  const [actualizarForm, setActualizarForm] = useState({ oferta_id: ofertasActivas[0]?.id ?? "", tipo: TIPOS_MOVIMIENTO[0], descripcion: "", monto_usd: "" })

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

  function handleCarteleria(e: React.FormEvent) {
    e.preventDefault()
    if (!cartelForm.numero || !cartelForm.agente) { setError("Número y agente son obligatorios"); return }
    startTransition(async () => {
      const r = await crearCartel({ numero: parseInt(cartelForm.numero) || 0, direccion: cartelForm.direccion, mlsId: cartelForm.mlsId, vencimiento: cartelForm.vencimiento, tipo: cartelForm.tipo, agente: cartelForm.agente })
      if (r.error) setError(r.error)
      else { closeModal(); router.refresh() }
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
    iconBg: string; iconColor: string; cardBg: string; cardBorder: string
  }> = [
    { icon: DollarSign,  label: "Registrar",  sublabel: "Pago",        m: "pago",             iconBg: "bg-emerald-50",  iconColor: "text-emerald-600", cardBg: "bg-emerald-50/60",  cardBorder: "border-emerald-200" },
    { icon: MapPin,      label: "Devolución", sublabel: "Cartelería",  m: "carteleria",       iconBg: "bg-amber-50",    iconColor: "text-amber-600",   cardBg: "bg-amber-50/60",    cardBorder: "border-amber-200" },
    { icon: ClipboardList, label: "Registrar", sublabel: "Encuesta",   m: "encuesta",         iconBg: "bg-blue-50",     iconColor: "text-blue-600",    cardBg: "bg-blue-50/60",     cardBorder: "border-blue-200" },
    { icon: Building2,   label: "Registrar",  sublabel: "Operación",   m: "operacion",        iconBg: "bg-orange-50",   iconColor: "text-orange-600",  cardBg: "bg-orange-50/60",   cardBorder: "border-orange-200" },
    { icon: Handshake,   label: "Registrar",  sublabel: "Oferta",      m: "oferta",           iconBg: "bg-violet-50",   iconColor: "text-violet-600",  cardBg: "bg-violet-50/60",   cardBorder: "border-violet-200" },
    { icon: RefreshCw,   label: "Actualizar", sublabel: "Oferta",      m: "actualizar_oferta",iconBg: "bg-sky-50",      iconColor: "text-sky-600",     cardBg: "bg-sky-50/60",      cardBorder: "border-sky-200" },
  ]

  const ErrorBox = () => error ? (
    <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5 text-[12.5px] text-rose-600 mb-4">
      ⚠️ {error}
    </div>
  ) : null

  const inp = "crm-input"

  return (
    <>
      {/* Quick action buttons */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5 md:gap-3 mb-5 md:mb-6">
        {QUICK_BTNS.map(({ icon: Icon, label, sublabel, m, iconBg, iconColor, cardBg, cardBorder }) => (
          <button
            key={m}
            onClick={() => openModal(m)}
            className={`flex flex-col items-center justify-center gap-2 md:gap-3 p-3 md:p-5 rounded-2xl border ${cardBorder} ${cardBg} cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 min-h-[88px] md:min-h-[110px]`}
            style={{ fontFamily: "inherit" }}
          >
            <div className={`w-9 h-9 md:w-11 md:h-11 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
              <Icon size={18} className={`${iconColor} md:text-[22px]`} strokeWidth={1.75} />
            </div>
            <div className="text-center leading-tight">
              <p className={`text-[9.5px] md:text-[10.5px] font-medium ${iconColor} opacity-70 m-0`}>{label}</p>
              <p className={`text-[12px] md:text-[13px] font-bold ${iconColor} mt-0.5 m-0`}>{sublabel}</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Monto que debe (USD) *">
                <input type="number" min="0" step="0.01" placeholder="95.25" value={pagoForm.monto_debe} onChange={e => setPagoForm(f => ({ ...f, monto_debe: e.target.value }))} className={inp} required />
              </Field>
              <Field label="Monto pagado (USD)">
                <input type="number" min="0" step="0.01" placeholder="0" value={pagoForm.monto_pagado} onChange={e => setPagoForm(f => ({ ...f, monto_pagado: e.target.value }))} className={inp} />
              </Field>
            </div>
            <ErrorBox />
            <SubmitRow isPending={isPending} onCancel={closeModal} label="Guardar" />
          </form>
        </ModalShell>
      )}

      {/* MODAL CARTELERÍA */}
      {modal === "carteleria" && (
        <ModalShell title="Devolución de Cartelería" subtitle="Registrar devolución en Airtable" onClose={closeModal}>
          <form onSubmit={handleCarteleria} className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Número de cartel *">
                <input type="number" min="1" placeholder="42" value={cartelForm.numero} onChange={e => setCartelForm(f => ({ ...f, numero: e.target.value }))} className={inp} required />
              </Field>
              <Field label="Tipo de propiedad">
                <select value={cartelForm.tipo} onChange={e => setCartelForm(f => ({ ...f, tipo: e.target.value }))} className={inp}>
                  {TIPOS_CARTEL.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Dirección">
              <input type="text" placeholder="Av. Colón 1234" value={cartelForm.direccion} onChange={e => setCartelForm(f => ({ ...f, direccion: e.target.value }))} className={inp} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="MLS ID">
                <input type="text" placeholder="MLS-001" value={cartelForm.mlsId} onChange={e => setCartelForm(f => ({ ...f, mlsId: e.target.value }))} className={inp} />
              </Field>
              <Field label="Vencimiento">
                <input type="date" value={cartelForm.vencimiento} onChange={e => setCartelForm(f => ({ ...f, vencimiento: e.target.value }))} className={inp} />
              </Field>
            </div>
            <Field label="Agente *">
              <input type="text" placeholder="Nombre del agente" value={cartelForm.agente} onChange={e => setCartelForm(f => ({ ...f, agente: e.target.value }))} list="agentes-cartel-list" className={inp} required />
              <datalist id="agentes-cartel-list">
                {agentes.map(a => <option key={a.id} value={a.nombre} />)}
              </datalist>
            </Field>
            <ErrorBox />
            <SubmitRow isPending={isPending} onCancel={closeModal} label="Registrar" />
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
                <label key={key} className="flex items-center gap-2 text-[13px] cursor-pointer text-slate-700">
                  <input type="checkbox" checked={opForm[key]} onChange={e => setOpForm(f => ({ ...f, [key]: e.target.checked }))} className="w-4 h-4 accent-blue-600" />
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
              <div className="py-8 text-center text-slate-400 text-[13px]">
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
