"use client"

import { useState, useMemo, useTransition, useEffect, useCallback, Fragment } from "react"
import { useRouter } from "next/navigation"
import { registrarEncuesta, editarEncuesta, eliminarEncuesta } from "./actions"
import type { RegistroEncuestaData, EditarEncuestaData } from "./actions"
import type { RegistroRow } from "./page"
import { ClipboardList, TrendingUp, Star, X, Loader2, ChevronDown, ChevronRight, CheckCircle2, Save, BarChart2, Pencil, Trash2, AlertTriangle } from "lucide-react"
import KpiCardGlobal from "@/components/KpiCard"

// ── Constants ────────────────────────────────────────
const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]

// ── Types ────────────────────────────────────────────
interface Agente {
  id:     string
  nombre: string
}

interface Props {
  registros:  RegistroRow[]
  objetivoPct: number
  mesActual:  number
  anio:       number
}

interface FormState {
  tipo:       "ESPONTANEA" | "MAILING"
  subtipo:    string
  referencia: string
  nps:        string
  comentario: string
  fecha:      string
}

// ── Helpers ──────────────────────────────────────────
function npsColor(nps: number | null): string {
  if (nps === null) return "rgba(255,255,255,0.35)"
  if (nps >= 8) return "#4ade80"
  if (nps >= 6) return "#fbbf24"
  return "#f87171"
}

function npsLabel(nps: number | null): string {
  if (nps === null) return "—"
  if (nps >= 9) return "Promotor"
  if (nps >= 7) return "Neutral"
  return "Detractor"
}

function fmtFecha(fechaStr: string): string {
  if (!fechaStr) return "—"
  const [a, m, d] = fechaStr.split("-")
  return `${parseInt(d).toString().padStart(2,"0")}/${parseInt(m).toString().padStart(2,"0")}/${a}`
}

function mesKey(fechaStr: string): string {
  return fechaStr.substring(0, 7) // "YYYY-MM"
}

function mesNombre(key: string): string {
  const [y, m] = key.split("-")
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`
}

function NpsBadge({ nps }: { nps: number | null }) {
  const color = npsColor(nps)
  const bg    = nps === null ? "rgba(255,255,255,0.08)" : nps >= 8 ? "rgba(74,222,128,0.12)" : nps >= 6 ? "rgba(251,191,36,0.12)" : "rgba(248,113,113,0.12)"
  return (
    <span style={{
      background: bg, color, padding: "2px 9px",
      borderRadius: "12px", fontSize: "11px", fontWeight: 700,
      display: "inline-block",
    }}>
      {nps !== null ? `NPS ${nps}` : "Sin NPS"}
    </span>
  )
}

function TipoBadge({ tipo }: { tipo: string }) {
  const isMailling = tipo === "MAILING"
  return (
    <span style={{
      background: isMailling ? "rgba(96,165,250,0.12)" : "rgba(167,139,250,0.12)",
      color:      isMailling ? "#60a5fa" : "#a78bfa",
      padding: "2px 9px", borderRadius: "12px",
      fontSize: "10.5px", fontWeight: 700, display: "inline-block",
    }}>
      {tipo === "ESPONTANEA" ? "ESPONTÁNEA" : "MAILING"}
    </span>
  )
}

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)",
  fontSize: "13px", fontFamily: "inherit",
  color: "#f1f5f9", outline: "none", background: "#1e1e2e",
  boxSizing: "border-box",
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

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export default function EncuestasClient({ registros, objetivoPct, mesActual, anio }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showModal,   setShowModal]   = useState(false)
  const [error,       setError]      = useState("")
  const [saveSuccess, setSaveSuccess] = useState(false)
  const todayStr = new Date().toISOString().split("T")[0]

  // ── Edit state ─────────────────────────────────────
  const [editRow,     setEditRow]     = useState<RegistroRow | null>(null)
  const [editForm,    setEditForm]    = useState<FormState | null>(null)
  const [editStep,    setEditStep]    = useState<"form" | "confirm">("form")
  const [editError,   setEditError]   = useState("")
  const [editSuccess, setEditSuccess] = useState(false)
  const [isEditPending, startEditTrans] = useTransition()

  // ── Delete state ───────────────────────────────────
  const [deleteRow,    setDeleteRow]    = useState<RegistroRow | null>(null)
  const [deleteError,  setDeleteError]  = useState("")
  const [isDelPending, startDelTrans]   = useTransition()

  const [form, setForm] = useState<FormState>({
    tipo:       "ESPONTANEA",
    subtipo:    "Comprador",
    referencia: "",
    nps:        "",
    comentario: "",
    fecha:      todayStr,
  })

  // ── Agentes para dropdown MAILING ─────────────────
  const [agentes,        setAgentes]       = useState<Agente[]>([])
  const [loadingAgentes, setLoadingAgentes] = useState(true)
  const [opCountByMes,   setOpCountByMes]   = useState<Map<string, number>>(new Map())

  useEffect(() => {
    let cancelled = false
    const url    = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    fetch(
      `${url}/rest/v1/agentes?select=id,nombre&activo=eq.true&order=nombre.asc`,
      {
        headers: {
          apikey:        apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
      }
    )
      .then(res => {
        if (!res.ok) throw new Error(`Supabase agentes: ${res.status} ${res.statusText}`)
        return res.json() as Promise<Agente[]>
      })
      .then(data => {
        if (!cancelled) setAgentes(data)
      })
      .catch(err => {
        console.error("[EncuestasClient] Error cargando agentes:", err)
      })
      .finally(() => {
        if (!cancelled) setLoadingAgentes(false)
      })
    return () => { cancelled = true }
  }, [])

  // ── Operaciones por mes (para tasa de respuesta) ───
  useEffect(() => {
    let cancelled = false
    const url    = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    let fromYear  = anio
    let fromMonth = mesActual - 6
    if (fromMonth <= 0) { fromYear--; fromMonth += 12 }
    const fromDate = `${fromYear}-${String(fromMonth).padStart(2, "0")}-01`
    fetch(
      `${url}/rest/v1/operaciones?select=fecha&fecha=gte.${fromDate}`,
      { headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` } }
    )
      .then(res => {
        if (!res.ok) throw new Error(`operaciones: ${res.status}`)
        return res.json() as Promise<{ fecha: string }[]>
      })
      .then(rows => {
        if (cancelled) return
        const counts = new Map<string, number>()
        for (const row of rows) {
          const k = mesKey(row.fecha)
          counts.set(k, (counts.get(k) ?? 0) + 1)
        }
        setOpCountByMes(counts)
      })
      .catch(err => console.error("[EncuestasClient] Error cargando operaciones:", err))
    return () => { cancelled = true }
  }, [anio, mesActual])

  // ── Expanded month rows ────────────────────────────
  const [expandedMeses, setExpandedMeses] = useState<Set<string>>(() => {
    const now = new Date()
    return new Set([`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`])
  })

  function toggleMes(key: string) {
    setExpandedMeses(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ── KPI: current month ─────────────────────────────
  const mesActualStr = `${anio}-${String(mesActual).padStart(2, "0")}`
  const regMesActual = useMemo(() => registros.filter(r => r.fecha.startsWith(mesActualStr)), [registros, mesActualStr])
  const totalMes     = regMesActual.length
  const conNpsMes    = regMesActual.filter(r => r.nps !== null)
  const npsMes       = conNpsMes.length > 0
    ? Math.round(conNpsMes.reduce((s, r) => s + (r.nps ?? 0), 0) / conNpsMes.length)
    : null
  const pctNpsMes    = totalMes > 0 ? Math.round((conNpsMes.length / totalMes) * 100) : 0
  const opsMesActual = opCountByMes.get(mesActualStr) ?? 0
  const tasaActual   = opsMesActual === 0 ? 0 : Math.round((totalMes / (opsMesActual * 2)) * 100)

  // ── Group by month for history ─────────────────────
  const groupedByMes = useMemo(() => {
    const map = new Map<string, RegistroRow[]>()
    for (const r of registros) {
      const k = mesKey(r.fecha)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(r)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [registros])

  // ── Modal ──────────────────────────────────────────
  const closeModal = useCallback(() => { setShowModal(false); setError("") }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal() }
    if (showModal) document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [showModal, closeModal])

  function openModal() {
    setForm({
      tipo:       "ESPONTANEA",
      subtipo:    "Comprador",
      referencia: "",
      nps:        "",
      comentario: "",
      fecha:      todayStr,
    })
    setError("")
    setShowModal(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!form.referencia.trim()) { setError("Ingresá la referencia"); return }
    const nps = form.nps !== "" ? parseInt(form.nps) : null
    if (nps !== null && (isNaN(nps) || nps < 0 || nps > 10)) {
      setError("El NPS debe estar entre 0 y 10"); return
    }

    const payload: RegistroEncuestaData = {
      fecha:      form.fecha,
      tipo:       form.tipo,
      subtipo:    form.tipo === "ESPONTANEA" ? form.subtipo : null,
      referencia: form.referencia,
      nps,
      comentario: form.comentario,
    }

    startTransition(async () => {
      const result = await registrarEncuesta(payload)
      if (result.error) setError(result.error)
      else { setSaveSuccess(true); setTimeout(() => { setSaveSuccess(false); closeModal(); router.refresh() }, 1000) }
    })
  }

  // ── Edit handlers ──────────────────────────────────
  const closeEdit = useCallback(() => {
    setEditRow(null); setEditForm(null)
    setEditStep("form"); setEditError(""); setEditSuccess(false)
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeEdit() }
    if (editRow) document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [editRow, closeEdit])

  function openEdit(row: RegistroRow) {
    setEditForm({
      tipo:       row.tipo as "ESPONTANEA" | "MAILING",
      subtipo:    row.subtipo ?? "Comprador",
      referencia: row.referencia,
      nps:        row.nps !== null ? String(row.nps) : "",
      comentario: row.comentario ?? "",
      fecha:      row.fecha,
    })
    setEditRow(row)
    setEditStep("form")
    setEditError("")
    setEditSuccess(false)
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editForm) return
    setEditError("")
    if (!editForm.referencia.trim()) { setEditError("Ingresá la referencia"); return }
    const nps = editForm.nps !== "" ? parseInt(editForm.nps) : null
    if (nps !== null && (isNaN(nps) || nps < 0 || nps > 10)) {
      setEditError("El NPS debe estar entre 0 y 10"); return
    }
    if (!editForm.fecha) { setEditError("La fecha es obligatoria"); return }
    setEditStep("confirm")
  }

  function handleEditConfirm() {
    if (!editForm || !editRow) return
    const nps = editForm.nps !== "" ? parseInt(editForm.nps) : null
    const payload: EditarEncuestaData = {
      fecha:      editForm.fecha,
      tipo:       editForm.tipo,
      subtipo:    editForm.tipo === "ESPONTANEA" ? editForm.subtipo : null,
      referencia: editForm.referencia,
      nps,
      comentario: editForm.comentario,
    }
    startEditTrans(async () => {
      const result = await editarEncuesta(editRow.id, payload)
      if (result.error) { setEditError(result.error); setEditStep("form") }
      else { setEditSuccess(true); setTimeout(() => { closeEdit(); router.refresh() }, 900) }
    })
  }

  // ── Delete handlers ─────────────────────────────────
  const closeDelete = useCallback(() => {
    setDeleteRow(null); setDeleteError("")
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeDelete() }
    if (deleteRow) document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [deleteRow, closeDelete])

  function openDelete(row: RegistroRow) {
    setDeleteRow(row); setDeleteError("")
  }

  function handleDeleteConfirm() {
    if (!deleteRow) return
    startDelTrans(async () => {
      const result = await eliminarEncuesta(deleteRow.id)
      if (result.error) setDeleteError(result.error)
      else { closeDelete(); router.refresh() }
    })
  }

  const cardStyle: React.CSSProperties = {
    background: "#13131a", borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden",
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Page Header ──────────────────────────── */}
      <div className="crm-page-header flex-shrink-0">
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.3px", margin: 0 }}>
            Encuestas
          </h1>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, marginTop: "1px" }}>
            Satisfacción de clientes y agentes — {MONTH_NAMES[mesActual - 1]} {anio}
          </p>
        </div>
        <button
          onClick={openModal}
          style={{
            background: "linear-gradient(135deg,#E31837 0%,#c0122d 100%)",
            color: "white", border: "none",
            padding: "8px 18px", borderRadius: "9px",
            fontSize: "13px", fontWeight: 700, cursor: "pointer",
            boxShadow: "0 2px 10px rgba(227,24,55,0.35)",
            fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px",
          }}
        >
          <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span> Registrar encuesta
        </button>
      </div>

      {/* ── Scrollable content ────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>

        {/* ── KPI Cards ─────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px", marginBottom: "20px" }}>
          <KpiCardGlobal
            title={`Encuestas — ${MONTH_NAMES[mesActual - 1]}`}
            value={totalMes}
            badge={`${regMesActual.filter(r => r.tipo === "ESPONTANEA").length} espontáneas + ${regMesActual.filter(r => r.tipo === "MAILING").length} mailing`}
            iconBg="bg-teal-500/15"
            iconColor="text-teal-400"
            icon={<ClipboardList size={18} />}
          />
          <KpiCardGlobal
            title="% Con NPS del mes"
            value={`${pctNpsMes}%`}
            badge={pctNpsMes >= objetivoPct ? `✓ Supera objetivo ${objetivoPct}%` : `Meta: ${objetivoPct}%`}
            iconBg={pctNpsMes >= objetivoPct ? "bg-emerald-500/15" : totalMes === 0 ? "bg-slate-500/15" : "bg-rose-500/15"}
            iconColor={pctNpsMes >= objetivoPct ? "text-emerald-400" : totalMes === 0 ? "text-slate-400" : "text-rose-400"}
            icon={<TrendingUp size={18} />}
          />
          <KpiCardGlobal
            title="NPS promedio del mes"
            value={npsMes !== null ? String(npsMes) : "—"}
            badge={
              npsMes === null ? "Sin respuestas NPS"
              : npsMes >= 8   ? "Excelente"
              : npsMes >= 6   ? "Bueno"
              :                 "Por mejorar"
            }
            iconBg={npsMes === null ? "bg-slate-500/15" : npsMes >= 8 ? "bg-emerald-500/15" : npsMes >= 6 ? "bg-amber-500/15" : "bg-rose-500/15"}
            iconColor={npsMes === null ? "text-slate-400" : npsMes >= 8 ? "text-emerald-400" : npsMes >= 6 ? "text-amber-400" : "text-rose-400"}
            icon={<Star size={18} />}
          />
          <KpiCardGlobal
            title="Tasa de respuesta"
            value={`${tasaActual}%`}
            badge={opsMesActual === 0 ? "Sin operaciones este mes" : `${totalMes} enc / ${opsMesActual * 2} esperadas`}
            iconBg={tasaActual >= 50 ? "bg-blue-500/15" : tasaActual > 0 ? "bg-amber-500/15" : "bg-slate-500/15"}
            iconColor={tasaActual >= 50 ? "text-blue-400" : tasaActual > 0 ? "text-amber-400" : "text-slate-400"}
            icon={<BarChart2 size={18} />}
          />
        </div>

        {/* ── Historial por mes ─────────────────── */}
        <div style={cardStyle}>
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E31837" }} />
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9" }}>
              Historial de encuestas
            </span>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginLeft: "4px" }}>
              {registros.length} registros — últimos 6 meses
            </span>
          </div>

          {groupedByMes.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: "13px" }}>
              No hay encuestas registradas. Hacé clic en &quot;+ Registrar encuesta&quot; para empezar.
            </div>
          ) : (
            <div>
              {groupedByMes.map(([mesK, regs], gi) => {
                const isOpen    = expandedMeses.has(mesK)
                const isLast    = gi === groupedByMes.length - 1
                const conNps    = regs.filter(r => r.nps !== null)
                const npsAvg    = conNps.length > 0
                  ? Math.round(conNps.reduce((s, r) => s + (r.nps ?? 0), 0) / conNps.length)
                  : null
                const pctNps    = regs.length > 0 ? Math.round(conNps.length / regs.length * 100) : 0
                const opsMes    = opCountByMes.get(mesK) ?? 0
                const tasaMes   = opsMes === 0 ? 0 : Math.round((regs.length / (opsMes * 2)) * 100)

                return (
                  <Fragment key={mesK}>
                    {/* Month header row */}
                    <div
                      onClick={() => toggleMes(mesK)}
                      style={{
                        display: "flex", alignItems: "center",
                        padding: "12px 20px",
                        borderBottom: isOpen || (!isLast) ? "1px solid rgba(255,255,255,0.06)" : "none",
                        cursor: "pointer",
                        background: isOpen ? "rgba(255,255,255,0.03)" : "transparent",
                        transition: "background 0.1s",
                        userSelect: "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                        {isOpen
                          ? <ChevronDown size={14} color="rgba(255,255,255,0.35)" />
                          : <ChevronRight size={14} color="rgba(255,255,255,0.35)" />
                        }
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#f1f5f9" }}>
                          {mesNombre(mesK)}
                        </span>
                        {mesK === mesActualStr && (
                          <span style={{
                            fontSize: "10px", fontWeight: 700,
                            background: "rgba(248,113,113,0.12)", color: "#f87171",
                            padding: "1px 7px", borderRadius: "10px",
                          }}>
                            HOY
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>
                          <strong style={{ color: "#f1f5f9" }}>{regs.length}</strong> encuestas
                        </span>
                        {npsAvg !== null && (
                          <span style={{
                            fontSize: "12px", fontWeight: 700, color: npsColor(npsAvg),
                          }}>
                            NPS {npsAvg}
                          </span>
                        )}
                        <span style={{
                          fontSize: "11px", fontWeight: 700,
                          background: pctNps >= objetivoPct ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.08)",
                          color: pctNps >= objetivoPct ? "#4ade80" : "rgba(255,255,255,0.35)",
                          padding: "2px 9px", borderRadius: "10px",
                        }}>
                          {pctNps}% NPS
                        </span>
                        <span style={{
                          fontSize: "11px", fontWeight: 700,
                          background: tasaMes >= 50 ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.08)",
                          color: tasaMes >= 50 ? "#60a5fa" : "rgba(255,255,255,0.35)",
                          padding: "2px 9px", borderRadius: "10px",
                        }}>
                          {tasaMes}% resp
                        </span>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div style={{
                        background: "rgba(255,255,255,0.02)", borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.06)",
                        overflowX: "auto",
                      }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                              {["Fecha","Tipo","Referencia","Subtipo","NPS","Calificación","Comentario","Acciones"].map(h => (
                                <th key={h} style={{
                                  padding: "8px 16px", textAlign: "left",
                                  fontSize: "10px", fontWeight: 700,
                                  textTransform: "uppercase" as const,
                                  letterSpacing: "0.7px", color: "rgba(255,255,255,0.35)",
                                  whiteSpace: "nowrap",
                                }}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {regs.map((r, ri) => (
                              <tr
                                key={r.id}
                                style={{
                                  borderTop: ri > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
                                  background: "transparent",
                                }}
                              >
                                <td style={{ padding: "10px 16px", fontSize: "12px", color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>
                                  {fmtFecha(r.fecha)}
                                </td>
                                <td style={{ padding: "10px 16px" }}>
                                  <TipoBadge tipo={r.tipo} />
                                </td>
                                <td style={{ padding: "10px 16px", fontSize: "12px", fontWeight: 600, color: "#f1f5f9" }}>
                                  {r.referencia}
                                </td>
                                <td style={{ padding: "10px 16px", fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>
                                  {r.subtipo ?? "—"}
                                </td>
                                <td style={{ padding: "10px 16px" }}>
                                  <NpsBadge nps={r.nps} />
                                </td>
                                <td style={{ padding: "10px 16px", fontSize: "11.5px", color: npsColor(r.nps), fontWeight: 600 }}>
                                  {npsLabel(r.nps)}
                                </td>
                                <td style={{ padding: "10px 16px", fontSize: "12px", color: "rgba(255,255,255,0.45)",
                                  maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {r.comentario ?? <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>}
                                </td>
                                <td style={{ padding: "10px 16px", whiteSpace: "nowrap" }}>
                                  <div style={{ display: "flex", gap: "6px" }}>
                                    <button
                                      onClick={e => { e.stopPropagation(); openEdit(r) }}
                                      title="Editar encuesta"
                                      style={{
                                        background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)",
                                        borderRadius: "6px", color: "#60a5fa",
                                        width: "28px", height: "28px", padding: 0,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        cursor: "pointer",
                                      }}
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    <button
                                      onClick={e => { e.stopPropagation(); openDelete(r) }}
                                      title="Eliminar encuesta"
                                      style={{
                                        background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)",
                                        borderRadius: "6px", color: "#f87171",
                                        width: "28px", height: "28px", padding: 0,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        cursor: "pointer",
                                      }}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Fragment>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════
          MODAL — EDITAR ENCUESTA
      ════════════════════════════════════════════ */}
      {editRow && editForm && (
        <div onClick={closeEdit} className="crm-modal-backdrop">
          <div onClick={e => e.stopPropagation()} className="crm-modal" style={{ maxWidth: "500px" }}>

            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="bg-blue-500/[0.12] rounded-xl p-2.5 flex-shrink-0">
                  <Pencil size={18} className="text-blue-400" />
                </div>
                <div>
                  <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>
                    {editStep === "confirm" ? "Confirmá los cambios" : "Editar Encuesta"}
                  </h2>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, marginTop: "2px" }}>
                    {editStep === "confirm" ? "Revisá y confirmá antes de guardar" : fmtFecha(editRow.fecha) + " · " + editRow.referencia}
                  </p>
                </div>
              </div>
              <button onClick={closeEdit} disabled={isEditPending} style={{
                background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "8px",
                width: "32px", height: "32px", display: "flex",
                alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "rgba(255,255,255,0.5)",
              }}>
                <X size={16} />
              </button>
            </div>

            {editStep === "form" ? (
              <form onSubmit={handleEditSubmit} style={{ padding: "20px" }}>

                {/* Tipo selector */}
                <Field label="Tipo de encuesta *">
                  <div style={{ display: "flex", gap: "8px" }}>
                    {(["ESPONTANEA", "MAILING"] as const).map(t => (
                      <button key={t} type="button"
                        onClick={() => setEditForm(f => f ? { ...f, tipo: t, referencia: "" } : f)}
                        style={{
                          flex: 1, padding: "10px 0", borderRadius: "9px",
                          fontSize: "12.5px", fontWeight: editForm.tipo === t ? 800 : 500,
                          cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                          border: editForm.tipo === t
                            ? `1.5px solid ${t === "ESPONTANEA" ? "#7C3AED" : "#2563EB"}`
                            : "1.5px solid rgba(255,255,255,0.1)",
                          background: editForm.tipo === t
                            ? (t === "ESPONTANEA" ? "rgba(167,139,250,0.12)" : "rgba(96,165,250,0.12)")
                            : "rgba(255,255,255,0.06)",
                          color: editForm.tipo === t
                            ? (t === "ESPONTANEA" ? "#7C3AED" : "#2563EB")
                            : "#64748B",
                        }}
                      >
                        {t === "ESPONTANEA" ? "ESPONTÁNEA" : "MAILING"}
                      </button>
                    ))}
                  </div>
                </Field>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {editForm.tipo === "ESPONTANEA" ? (
                    <Field label="N° de oferta *">
                      <input type="text" placeholder="Ej: 1234"
                        value={editForm.referencia}
                        onChange={e => setEditForm(f => f ? { ...f, referencia: e.target.value } : f)}
                        style={inp} required autoFocus />
                    </Field>
                  ) : (
                    <Field label="Agente *">
                      <select
                        value={editForm.referencia}
                        onChange={e => setEditForm(f => f ? { ...f, referencia: e.target.value } : f)}
                        style={{ ...inp, appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}
                        required disabled={loadingAgentes}
                      >
                        <option value="" disabled>{loadingAgentes ? "Cargando..." : "Seleccionar agente..."}</option>
                        {/* Keep current value even if agent was deactivated */}
                        {editForm.referencia && !agentes.find(a => a.nombre === editForm!.referencia) && (
                          <option value={editForm.referencia}>{editForm.referencia} (inactivo)</option>
                        )}
                        {agentes.map(a => (
                          <option key={a.id} value={a.nombre} style={{ background: "#1e1e2e" }}>{a.nombre}</option>
                        ))}
                      </select>
                    </Field>
                  )}

                  {editForm.tipo === "ESPONTANEA" ? (
                    <Field label="Tipo contacto *">
                      <div style={{ display: "flex", gap: "6px" }}>
                        {(["Comprador", "Vendedor"] as const).map(s => (
                          <button key={s} type="button"
                            onClick={() => setEditForm(f => f ? { ...f, subtipo: s } : f)}
                            style={{
                              flex: 1, padding: "9px 0", borderRadius: "8px",
                              fontSize: "12px", fontWeight: editForm.subtipo === s ? 700 : 500,
                              cursor: "pointer", fontFamily: "inherit",
                              border: editForm.subtipo === s ? "1.5px solid #7C3AED" : "1.5px solid rgba(255,255,255,0.1)",
                              background: editForm.subtipo === s ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.06)",
                              color: editForm.subtipo === s ? "#7C3AED" : "rgba(255,255,255,0.45)",
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </Field>
                  ) : (
                    <Field label="Fecha *">
                      <input type="date" value={editForm.fecha}
                        onChange={e => setEditForm(f => f ? { ...f, fecha: e.target.value } : f)}
                        style={inp} required />
                    </Field>
                  )}
                </div>

                {editForm.tipo === "ESPONTANEA" && (
                  <Field label="Fecha *">
                    <input type="date" value={editForm.fecha}
                      onChange={e => setEditForm(f => f ? { ...f, fecha: e.target.value } : f)}
                      style={inp} required />
                  </Field>
                )}

                <Field label="NPS (0 a 10)">
                  <input type="number" min="0" max="10" step="1"
                    placeholder="Opcional — ej: 7"
                    value={editForm.nps}
                    onChange={e => setEditForm(f => f ? { ...f, nps: e.target.value } : f)}
                    style={inp}
                  />
                  {editForm.nps !== "" && (
                    <div style={{ marginTop: "5px" }}>
                      <NpsBadge nps={parseInt(editForm.nps) || null} />
                      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", marginLeft: "6px" }}>
                        {npsLabel(parseInt(editForm.nps) || null)}
                      </span>
                    </div>
                  )}
                </Field>

                <Field label="Comentario">
                  <textarea rows={2} placeholder="Feedback libre (opcional)"
                    value={editForm.comentario}
                    onChange={e => setEditForm(f => f ? { ...f, comentario: e.target.value } : f)}
                    style={{ ...inp, resize: "vertical", lineHeight: 1.5 }}
                  />
                </Field>

                {editError && (
                  <div style={{
                    background: "rgba(227,24,55,0.12)", border: "1px solid rgba(227,24,55,0.25)",
                    borderRadius: "8px", padding: "10px 12px",
                    fontSize: "12.5px", color: "#ff8a9a", marginBottom: "14px",
                  }}>
                    ⚠️ {editError}
                  </div>
                )}

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button type="button" onClick={closeEdit} style={{
                    padding: "9px 20px", borderRadius: "8px",
                    border: "1.5px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
                    fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.5)",
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    Cancelar
                  </button>
                  <button type="submit" style={{
                    padding: "9px 24px", borderRadius: "8px", border: "none",
                    background: "linear-gradient(135deg,#2563EB 0%,#1d4ed8 100%)",
                    color: "white", fontSize: "13px", fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: "6px",
                    boxShadow: "0 2px 8px rgba(37,99,235,0.35)",
                  }}>
                    <Save size={14} /> Guardar
                  </button>
                </div>
              </form>
            ) : (
              /* ── Confirm step ── */
              <div style={{ padding: "20px" }}>
                <div style={{
                  background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)",
                  borderRadius: "10px", padding: "16px", marginBottom: "20px",
                }}>
                  <p style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: 700, color: "#f1f5f9" }}>
                    ¿Confirmás guardar los cambios en esta encuesta?
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    {[
                      ["Fecha",    editForm.fecha],
                      ["Tipo",     editForm.tipo === "ESPONTANEA" ? "Espontánea" : "Mailing"],
                      ["Referencia", editForm.referencia],
                      ["NPS",      editForm.nps !== "" ? `${editForm.nps}/10` : "Sin NPS"],
                    ].map(([k, v]) => (
                      <div key={k} style={{ fontSize: "12px" }}>
                        <span style={{ color: "rgba(255,255,255,0.4)" }}>{k}: </span>
                        <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  {editForm.comentario && (
                    <div style={{ marginTop: "6px", fontSize: "12px" }}>
                      <span style={{ color: "rgba(255,255,255,0.4)" }}>Comentario: </span>
                      <span style={{ color: "#f1f5f9" }}>{editForm.comentario}</span>
                    </div>
                  )}
                </div>

                {editError && (
                  <div style={{
                    background: "rgba(227,24,55,0.12)", border: "1px solid rgba(227,24,55,0.25)",
                    borderRadius: "8px", padding: "10px 12px",
                    fontSize: "12.5px", color: "#ff8a9a", marginBottom: "14px",
                  }}>
                    ⚠️ {editError}
                  </div>
                )}

                {editSuccess ? (
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400 bg-emerald-500/[0.12] px-4 py-2.5 rounded-lg">
                    <CheckCircle2 size={15} /> Cambios guardados
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => setEditStep("form")} disabled={isEditPending} style={{
                      padding: "9px 20px", borderRadius: "8px",
                      border: "1.5px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
                      fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.5)",
                      cursor: "pointer", fontFamily: "inherit",
                    }}>
                      ← Volver
                    </button>
                    <button type="button" onClick={handleEditConfirm} disabled={isEditPending} style={{
                      padding: "9px 24px", borderRadius: "8px", border: "none",
                      background: isEditPending ? "#CBD5E1" : "linear-gradient(135deg,#2563EB 0%,#1d4ed8 100%)",
                      color: "white", fontSize: "13px", fontWeight: 700,
                      cursor: isEditPending ? "not-allowed" : "pointer", fontFamily: "inherit",
                      display: "flex", alignItems: "center", gap: "6px",
                      boxShadow: isEditPending ? "none" : "0 2px 8px rgba(37,99,235,0.35)",
                    }}>
                      {isEditPending && <Loader2 size={14} className="animate-spin" />}
                      {isEditPending ? "Guardando..." : <><CheckCircle2 size={14} /> Sí, confirmar</>}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          MODAL — CONFIRMAR ELIMINACIÓN
      ════════════════════════════════════════════ */}
      {deleteRow && (
        <div onClick={closeDelete} className="crm-modal-backdrop">
          <div onClick={e => e.stopPropagation()} className="crm-modal" style={{ maxWidth: "420px" }}>

            <div style={{ padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "20px" }}>
                <div style={{
                  background: "rgba(248,113,113,0.12)", borderRadius: "12px",
                  padding: "10px", flexShrink: 0,
                }}>
                  <AlertTriangle size={22} color="#f87171" />
                </div>
                <div>
                  <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#f1f5f9", margin: "0 0 6px" }}>
                    ¿Confirmás eliminar esta encuesta?
                  </h2>
                  <div style={{
                    background: "rgba(255,255,255,0.05)", borderRadius: "8px",
                    padding: "10px 12px", fontSize: "12.5px",
                  }}>
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>Fecha: </span>
                    <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{fmtFecha(deleteRow.fecha)}</span>
                    <span style={{ color: "rgba(255,255,255,0.3)", margin: "0 8px" }}>·</span>
                    <TipoBadge tipo={deleteRow.tipo} />
                    <span style={{ color: "rgba(255,255,255,0.3)", margin: "0 8px" }}>·</span>
                    <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{deleteRow.referencia}</span>
                    {deleteRow.nps !== null && (
                      <>
                        <span style={{ color: "rgba(255,255,255,0.3)", margin: "0 8px" }}>·</span>
                        <NpsBadge nps={deleteRow.nps} />
                      </>
                    )}
                  </div>
                  <p style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.35)", margin: "8px 0 0" }}>
                    El registro será marcado como eliminado. No se borrará físicamente de la base de datos.
                  </p>
                </div>
              </div>

              {deleteError && (
                <div style={{
                  background: "rgba(227,24,55,0.12)", border: "1px solid rgba(227,24,55,0.25)",
                  borderRadius: "8px", padding: "10px 12px",
                  fontSize: "12.5px", color: "#ff8a9a", marginBottom: "14px",
                }}>
                  ⚠️ {deleteError}
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={closeDelete} disabled={isDelPending} style={{
                  padding: "9px 20px", borderRadius: "8px",
                  border: "1.5px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
                  fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.5)",
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  Cancelar
                </button>
                <button type="button" onClick={handleDeleteConfirm} disabled={isDelPending} style={{
                  padding: "9px 20px", borderRadius: "8px", border: "none",
                  background: isDelPending ? "#CBD5E1" : "linear-gradient(135deg,#E31837 0%,#c0122d 100%)",
                  color: "white", fontSize: "13px", fontWeight: 700,
                  cursor: isDelPending ? "not-allowed" : "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: "6px",
                  boxShadow: isDelPending ? "none" : "0 2px 8px rgba(227,24,55,0.3)",
                }}>
                  {isDelPending && <Loader2 size={14} className="animate-spin" />}
                  {isDelPending ? "Eliminando..." : <><Trash2 size={14} /> Eliminar</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          MODAL — REGISTRAR ENCUESTA
      ════════════════════════════════════════════ */}
      {showModal && (
        <div onClick={closeModal} className="crm-modal-backdrop">
          <div
            onClick={e => e.stopPropagation()}
            className="crm-modal"
            style={{ maxWidth: "500px" }}
          >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="bg-violet-500/[0.12] rounded-xl p-2.5 flex-shrink-0">
                  <ClipboardList size={20} className="text-violet-400" />
                </div>
                <div>
                  <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>
                    Registrar Encuesta
                  </h2>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, marginTop: "2px" }}>
                    Nueva respuesta de satisfacción
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

            <form onSubmit={handleSubmit} style={{ padding: "20px" }}>

              {/* Tipo selector */}
              <Field label="Tipo de encuesta *">
                <div style={{ display: "flex", gap: "8px" }}>
                  {(["ESPONTANEA", "MAILING"] as const).map(t => (
                    <button
                      key={t} type="button"
                      onClick={() => setForm(f => ({ ...f, tipo: t, referencia: "" }))}
                      style={{
                        flex: 1, padding: "10px 0", borderRadius: "9px",
                        fontSize: "12.5px", fontWeight: form.tipo === t ? 800 : 500,
                        cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                        border: form.tipo === t
                          ? `1.5px solid ${t === "ESPONTANEA" ? "#7C3AED" : "#2563EB"}`
                          : "1.5px solid rgba(255,255,255,0.1)",
                        background: form.tipo === t
                          ? (t === "ESPONTANEA" ? "rgba(167,139,250,0.12)" : "rgba(96,165,250,0.12)")
                          : "rgba(255,255,255,0.06)",
                        color: form.tipo === t
                          ? (t === "ESPONTANEA" ? "#7C3AED" : "#2563EB")
                          : "#64748B",
                      }}
                    >
                      {t === "ESPONTANEA" ? "ESPONTÁNEA" : "MAILING"}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "5px" }}>
                  {form.tipo === "ESPONTANEA"
                    ? "Feedback espontáneo de un cliente en una operación"
                    : "Respuesta a una campaña de mailing enviada a un agente"
                  }
                </div>
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {/* Referencia */}
                {form.tipo === "ESPONTANEA" ? (
                  <Field label="N° de oferta *">
                    <input
                      type="text"
                      placeholder="Ej: 1234"
                      value={form.referencia}
                      onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
                      style={inp} required autoFocus
                    />
                  </Field>
                ) : (
                  <Field label="Agente *">
                    <select
                      value={form.referencia}
                      onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
                      style={{ ...inp, appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}
                      required
                      disabled={loadingAgentes}
                    >
                      <option value="" disabled>
                        {loadingAgentes ? "Cargando agentes..." : "Seleccionar agente..."}
                      </option>
                      {agentes.map(a => (
                        <option key={a.id} value={a.nombre} style={{ background: "#1e1e2e" }}>
                          {a.nombre}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                {/* Subtipo (solo ESPONTANEA) */}
                {form.tipo === "ESPONTANEA" ? (
                  <Field label="Tipo contacto *">
                    <div style={{ display: "flex", gap: "6px" }}>
                      {(["Comprador", "Vendedor"] as const).map(s => (
                        <button
                          key={s} type="button"
                          onClick={() => setForm(f => ({ ...f, subtipo: s }))}
                          style={{
                            flex: 1, padding: "9px 0", borderRadius: "8px",
                            fontSize: "12px", fontWeight: form.subtipo === s ? 700 : 500,
                            cursor: "pointer", fontFamily: "inherit",
                            border: form.subtipo === s ? "1.5px solid #7C3AED" : "1.5px solid rgba(255,255,255,0.1)",
                            background: form.subtipo === s ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.06)",
                            color: form.subtipo === s ? "#7C3AED" : "rgba(255,255,255,0.45)",
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </Field>
                ) : (
                  <Field label="Fecha *">
                    <input type="date" value={form.fecha}
                      onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                      style={inp} required />
                  </Field>
                )}
              </div>

              {form.tipo === "ESPONTANEA" && (
                <Field label="Fecha *">
                  <input type="date" value={form.fecha}
                    onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                    style={inp} required />
                </Field>
              )}

              {/* NPS */}
              <Field label="NPS (0 a 10)">
                <input
                  type="number" min="0" max="10" step="1"
                  placeholder="Opcional — ej: 7"
                  value={form.nps}
                  onChange={e => setForm(f => ({ ...f, nps: e.target.value }))}
                  style={inp}
                />
                {form.nps !== "" && (
                  <div style={{ marginTop: "5px" }}>
                    <NpsBadge nps={parseInt(form.nps) || null} />
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", marginLeft: "6px" }}>
                      {npsLabel(parseInt(form.nps) || null)}
                    </span>
                  </div>
                )}
              </Field>

              {/* Comentario */}
              <Field label="Comentario">
                <textarea
                  rows={2} placeholder="Feedback libre (opcional)"
                  value={form.comentario}
                  onChange={e => setForm(f => ({ ...f, comentario: e.target.value }))}
                  style={{ ...inp, resize: "vertical", lineHeight: 1.5 }}
                />
              </Field>

              {error && (
                <div style={{
                  background: "rgba(227,24,55,0.12)", border: "1px solid rgba(227,24,55,0.25)",
                  borderRadius: "8px", padding: "10px 12px",
                  fontSize: "12.5px", color: "#ff8a9a", marginBottom: "14px",
                }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", alignItems: "center" }}>
                {saveSuccess ? (
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400 bg-emerald-500/[0.12] px-4 py-2.5 rounded-lg">
                    <CheckCircle2 size={15} /> Encuesta registrada
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={closeModal} disabled={isPending}
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
                        cursor: isPending ? "not-allowed" : "pointer", fontFamily: "inherit",
                        display: "flex", alignItems: "center", gap: "6px",
                        boxShadow: isPending ? "none" : "0 2px 8px rgba(227,24,55,0.3)",
                      }}>
                      {isPending && <Loader2 size={14} className="animate-spin" />}
                      {isPending ? "Guardando..." : <><Save size={14} /> Registrar</>}
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
