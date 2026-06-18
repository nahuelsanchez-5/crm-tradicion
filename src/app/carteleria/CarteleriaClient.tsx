"use client"

import { useState, useMemo, useTransition, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import KpiCard from "@/components/KpiCard"
import { crearCartel, editarCartel } from "./actions"
import type { CartelFormData } from "./actions"
import { MapPin, AlertTriangle, Award, X, Loader2, Plus, Search, CheckCircle2, Save, RotateCcw, ChevronDown } from "lucide-react"

// ── Types ─────────────────────────────────────────────
export interface CartelRow {
  id:            string
  numero:        number
  direccion:     string
  mlsId:         string
  vencimiento:   string   // YYYY-MM-DD
  diasRestantes: number
  tipo:          string
  agente:        string
}

interface ModalForm {
  numero:      string
  direccion:   string
  mlsId:       string
  vencimiento: string
  tipo:        string
  agente:      string
}

// ── Constants ─────────────────────────────────────────
const TIPOS = ["Casa", "Terreno", "Local", "Departamento", "Campo", "Galpón"]

// Fallback: nombres exactos del singleSelect de Airtable (usados si Supabase devuelve vacío)
const AGENTES_AIRTABLE = [
  "Aleli Portillo", "Anabella Yñiguez", "Analia Olivero",
  "Cecilia Frigerio", "Clara Cabrera", "Erika Valoriani",
  "Florencia Ciacovschi", "Jelena Capitanich", "Juanjo Alunni",
  "Mabel Chamorro", "Marcela Matijasevich", "Mario Speroni",
  "Mateo Feldmann", "Moyra Panzich", "Natalia Miño",
  "Pedro Aleman", "Rocío Vildósola", "Romina Prieto",
  "Romina Villaboa", "Sapo Pagano", "Silvana Ameri",
  "Silvina Scordo", "Vanina Bravo",
]

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]

interface CartelDevuelto {
  id:                 string | number
  airtable_record_id: string
  nro_cartel:         number
  direccion:          string
  agente:             string
  tipo_propiedad:     string
  fecha_devolucion:   string
}

// ── Helpers ───────────────────────────────────────────
function diasColor(d: number): string {
  if (d > 30)  return "#059669"
  if (d >= 10) return "#D97706"
  return "#E11D48"
}

function diasBg(d: number): string {
  if (d > 30)  return "rgba(74,222,128,0.12)"
  if (d >= 10) return "rgba(251,191,36,0.12)"
  return "rgba(248,113,113,0.12)"
}

function fmtDate(iso: string): string {
  if (!iso) return "—"
  const p = iso.split("-")
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso
}

function fmtDateTime(iso: string): string {
  if (!iso) return "—"
  const d   = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── Shared styles ─────────────────────────────────────
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
interface Props {
  carteles: CartelRow[]
  agentes:  string[]       // de Supabase (fallback a AGENTES_AIRTABLE si vacío)
}

const EMPTY_FORM: ModalForm = {
  numero: "", direccion: "", mlsId: "", vencimiento: "", tipo: "", agente: "",
}

export default function CarteleriaClient({ carteles, agentes }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Filters ────────────────────────────────────────
  const [busqueda,     setBusqueda]     = useState("")
  const [filtroAgente, setFiltroAgente] = useState("")
  const [filtroTipo,   setFiltroTipo]   = useState("")

  // ── Modal ──────────────────────────────────────────
  const [modalMode,   setModalMode]   = useState<"none" | "nuevo" | "editar">("none")
  const [editTarget,  setEditTarget]  = useState<CartelRow | null>(null)
  const [form,        setForm]        = useState<ModalForm>(EMPTY_FORM)
  const [error,       setError]       = useState("")
  const [saveSuccess, setSaveSuccess] = useState(false)

  // ── Devolver ───────────────────────────────────────
  const [devolverTarget,  setDevolverTarget]  = useState<CartelRow | null>(null)
  const [devolverLoading, setDevolverLoading] = useState(false)
  const [devolverError,   setDevolverError]   = useState("")

  // ── Devueltos ──────────────────────────────────────
  const [devueltosOpen,    setDevueltosOpen]    = useState(false)
  const [devueltosMes,     setDevueltosMes]     = useState(() => new Date().getMonth() + 1)
  const [devueltosAnio,    setDevueltosAnio]    = useState(() => new Date().getFullYear())
  const [devueltosData,    setDevueltosData]    = useState<CartelDevuelto[]>([])
  const [devueltosLoading, setDevueltosLoading] = useState(false)

  // ── KPI stats ──────────────────────────────────────
  const stats = useMemo(() => {
    const total    = carteles.length
    const urgentes = carteles.filter(c => c.diasRestantes < 10).length
    const byAgente: Record<string, number> = {}
    carteles.forEach(c => {
      if (c.agente) byAgente[c.agente] = (byAgente[c.agente] ?? 0) + 1
    })
    const top = Object.entries(byAgente).sort((a, b) => b[1] - a[1])[0] ?? null
    return { total, urgentes, top }
  }, [carteles])

  // ── Filtered rows ──────────────────────────────────
  const filtered = useMemo(() => {
    const q = busqueda.toLowerCase()
    return carteles.filter(c => {
      if (q && !c.direccion.toLowerCase().includes(q) && !c.mlsId.toLowerCase().includes(q)) return false
      if (filtroAgente && c.agente !== filtroAgente) return false
      if (filtroTipo   && c.tipo   !== filtroTipo)   return false
      return true
    })
  }, [carteles, busqueda, filtroAgente, filtroTipo])

  // ── Unique values for filter dropdowns ─────────────
  const agentOptions = useMemo(() =>
    Array.from(new Set(carteles.map(c => c.agente).filter(Boolean))).sort()
  , [carteles])

  const tipoOptions = useMemo(() =>
    Array.from(new Set(carteles.map(c => c.tipo).filter(Boolean))).sort()
  , [carteles])

  // ── Modal handlers ─────────────────────────────────
  const closeModal = useCallback(() => {
    setModalMode("none"); setEditTarget(null); setError("")
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal() }
    if (modalMode !== "none") document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [modalMode, closeModal])

  const fetchDevueltos = useCallback(async (mes: number, anio: number) => {
    setDevueltosLoading(true)
    try {
      const res  = await fetch(`/api/carteleria/devueltos?month=${mes}&year=${anio}`)
      const json = await res.json() as { data?: CartelDevuelto[] }
      setDevueltosData(json.data ?? [])
    } catch {
      setDevueltosData([])
    } finally {
      setDevueltosLoading(false)
    }
  }, [])

  useEffect(() => {
    if (devueltosOpen) fetchDevueltos(devueltosMes, devueltosAnio)
  }, [devueltosOpen, devueltosMes, devueltosAnio, fetchDevueltos])

  function openNuevo() {
    setForm(EMPTY_FORM); setError(""); setModalMode("nuevo")
  }

  function openEditar(c: CartelRow) {
    setForm({
      numero:      c.numero > 0 ? String(c.numero) : "",
      direccion:   c.direccion,
      mlsId:       c.mlsId,
      vencimiento: c.vencimiento,
      tipo:        c.tipo,
      agente:      c.agente,
    })
    setError("")
    setEditTarget(c)
    setModalMode("editar")
  }

  function patch(field: keyof ModalForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))
  }

  // ── Submit ─────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    const numero = parseInt(form.numero) || 0
    if (numero <= 0)            { setError("Ingresá el número de cartel"); return }
    if (!form.direccion.trim()) { setError("La dirección es requerida"); return }
    if (!form.vencimiento)      { setError("La fecha de vencimiento es requerida"); return }
    if (!form.tipo)             { setError("Seleccioná el tipo de propiedad"); return }
    if (!form.agente)           { setError("Seleccioná un agente"); return }

    const payload: CartelFormData = {
      numero,
      direccion:   form.direccion.trim(),
      mlsId:       form.mlsId.trim(),
      vencimiento: form.vencimiento,
      tipo:        form.tipo,
      agente:      form.agente,
    }

    startTransition(async () => {
      const result = modalMode === "editar" && editTarget
        ? await editarCartel(editTarget.id, payload)
        : await crearCartel(payload)
      if (result.error) setError(result.error)
      else { setSaveSuccess(true); setTimeout(() => { setSaveSuccess(false); closeModal(); router.refresh() }, 1000) }
    })
  }

  // ── Devolver handler ───────────────────────────────
  async function handleConfirmDevolver() {
    if (!devolverTarget) return
    setDevolverLoading(true)
    setDevolverError("")
    try {
      const res = await fetch("/api/carteleria/devolver", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          airtable_record_id: devolverTarget.id,
          nro_cartel:         devolverTarget.numero,
          direccion:          devolverTarget.direccion,
          agente:             devolverTarget.agente,
          tipo_propiedad:     devolverTarget.tipo,
        }),
      })
      const result = await res.json() as { success: boolean; error?: string }
      if (!result.success) {
        setDevolverError(result.error ?? "Error al registrar la devolución")
      } else {
        setDevolverTarget(null)
        if (devueltosOpen) fetchDevueltos(devueltosMes, devueltosAnio)
        router.refresh()
      }
    } catch {
      setDevolverError("Error de conexión")
    } finally {
      setDevolverLoading(false)
    }
  }

  // ── Agentes para el modal ──────────────────────────
  const modalAgentes = agentes.length > 0 ? agentes : AGENTES_AIRTABLE

  // ── Styles ─────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: "#13131a", borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden",
  }

  const hasFilters = busqueda || filtroAgente || filtroTipo

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Page Header ──────────────────────────── */}
      <div className="crm-page-header flex-shrink-0">
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.3px", margin: 0 }}>
            Cartelería
          </h1>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, marginTop: "1px" }}>
            {stats.total} carteles activos · datos en tiempo real desde Airtable
          </p>
        </div>
        <button
          onClick={openNuevo}
          style={{
            display: "flex", alignItems: "center", gap: "7px",
            padding: "8px 18px", borderRadius: "9px", border: "none",
            background: "linear-gradient(135deg,#E31837 0%,#c0122d 100%)",
            color: "white", fontSize: "13px", fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 2px 8px rgba(227,24,55,0.3)",
          }}
        >
          <Plus size={15} />
          Nuevo cartel
        </button>
      </div>

      {/* ── Scrollable content ────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>

        {/* ── KPI Cards ─────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px", marginBottom: "20px" }}>
          <KpiCard
            title="Total carteles activos"
            value={stats.total}
            badge="En Airtable"
            iconBg="bg-teal-500/15"
            iconColor="text-teal-400"
            icon={<MapPin size={18} />}
          />
          <KpiCard
            title="Vencen en menos de 10 días"
            value={stats.urgentes}
            badge={stats.urgentes > 0 ? "Atención requerida" : "Sin urgencias"}
            iconBg={stats.urgentes > 0 ? "bg-rose-500/15" : "bg-emerald-500/15"}
            iconColor={stats.urgentes > 0 ? "text-rose-400" : "text-emerald-400"}
            icon={<AlertTriangle size={18} />}
          />
          <KpiCard
            title="Agente con más carteles"
            value={stats.top ? stats.top[0].split(" ")[0] : "—"}
            badge={stats.top ? `${stats.top[1]} cartel${stats.top[1] !== 1 ? "es" : ""}` : "Sin datos"}
            iconBg="bg-rose-500/15"
            iconColor="text-rose-400"
            icon={<Award size={18} />}
          />
        </div>

        {/* ── Alerta de vencimiento próximo ────────── */}
        {carteles.filter(c => c.diasRestantes <= 10).length > 0 && (
          <div style={{
            background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.25)",
            borderRadius: "12px", padding: "14px 18px", marginBottom: "16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <AlertTriangle size={14} color="#fb923c" />
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#fb923c" }}>
                Carteles próximos a vencer (≤10 días)
              </span>
              <span style={{
                background: "#EA580C", color: "white",
                padding: "1px 8px", borderRadius: "20px",
                fontSize: "11px", fontWeight: 700,
              }}>
                {carteles.filter(c => c.diasRestantes <= 10).length}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {carteles.filter(c => c.diasRestantes <= 10).map(c => (
                <div key={c.id} style={{
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(251,146,60,0.2)",
                  borderRadius: "10px", padding: "8px 12px",
                  display: "flex", alignItems: "center", gap: "10px",
                }}>
                  <span style={{
                    background: c.diasRestantes <= 0 ? "rgba(248,113,113,0.12)" : "rgba(251,191,36,0.12)",
                    color: c.diasRestantes <= 0 ? "#f87171" : "#fbbf24",
                    padding: "2px 8px", borderRadius: "6px",
                    fontSize: "11px", fontWeight: 700,
                  }}>
                    #{c.numero}
                  </span>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#f1f5f9" }}>{c.direccion || "—"}</div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)" }}>
                      {c.agente} · {c.diasRestantes <= 0 ? "Vencido" : `${c.diasRestantes}d`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Filtros ──────────────────────────────── */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap", alignItems: "center" }}>

          {/* Buscador */}
          <div style={{ position: "relative", flex: "1", minWidth: "220px" }}>
            <Search size={14} style={{
              position: "absolute", left: "11px", top: "50%",
              transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none",
            }} />
            <input
              type="text"
              placeholder="Buscar por dirección o MLS-ID..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{ ...inp, paddingLeft: "33px" }}
            />
          </div>

          {/* Filtro Agente */}
          <select
            value={filtroAgente}
            onChange={e => setFiltroAgente(e.target.value)}
            style={{ ...inp, width: "auto", minWidth: "170px", cursor: "pointer" }}
          >
            <option value="">Todos los agentes</option>
            {agentOptions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          {/* Filtro Tipo */}
          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value)}
            style={{ ...inp, width: "auto", minWidth: "150px", cursor: "pointer" }}
          >
            <option value="">Todos los tipos</option>
            {tipoOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* Clear */}
          {hasFilters && (
            <button
              onClick={() => { setBusqueda(""); setFiltroAgente(""); setFiltroTipo("") }}
              style={{
                padding: "9px 14px", borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
                fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.45)",
                cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* ── Tabla ──────────────────────────────────── */}
        <div style={cardStyle}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E31837" }} />
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9" }}>
                Carteles activos
              </span>
            </div>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>


          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["Nº","Dirección","MLS-ID","Tipo","Agente","Vencimiento","Días restantes",""].map(h => (
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
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{
                      padding: "48px", textAlign: "center",
                      color: "rgba(255,255,255,0.35)", fontSize: "13px",
                    }}>
                      No se encontraron carteles con los filtros aplicados
                    </td>
                  </tr>
                ) : filtered.map((c, i) => {
                  const isLast    = i === filtered.length - 1
                  const urgente   = c.diasRestantes < 10
                  const vencido   = c.diasRestantes < 0

                  return (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.06)",
                        background: urgente ? "rgba(225,29,72,0.04)" : undefined,
                      }}
                    >
                      {/* Nº */}
                      <td style={{ padding: "13px 16px", fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap" }}>
                        {c.numero || "—"}
                      </td>

                      {/* Dirección */}
                      <td style={{ padding: "13px 16px", maxWidth: "240px" }}>
                        <span style={{
                          fontSize: "13px", fontWeight: 600, color: "#f1f5f9",
                          display: "block", overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {c.direccion || "—"}
                        </span>
                      </td>

                      {/* MLS-ID */}
                      <td style={{ padding: "13px 16px", fontSize: "12px", color: "rgba(255,255,255,0.45)", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                        {c.mlsId || <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>}
                      </td>

                      {/* Tipo */}
                      <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }}>
                        {c.tipo ? (
                          <span style={{
                            padding: "2px 10px", borderRadius: "20px",
                            fontSize: "11px", fontWeight: 700,
                            background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)",
                          }}>
                            {c.tipo}
                          </span>
                        ) : <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "13px" }}>—</span>}
                      </td>

                      {/* Agente */}
                      <td style={{ padding: "13px 16px", fontSize: "13px", color: "#f1f5f9", whiteSpace: "nowrap" }}>
                        {c.agente || <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>}
                      </td>

                      {/* Vencimiento */}
                      <td style={{ padding: "13px 16px", fontSize: "13px", color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>
                        {fmtDate(c.vencimiento)}
                      </td>

                      {/* Días restantes */}
                      <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "3px 10px", borderRadius: "20px",
                          fontSize: "12px", fontWeight: 700,
                          background: diasBg(c.diasRestantes),
                          color: diasColor(c.diasRestantes),
                        }}>
                          {vencido
                            ? `Vencido (${Math.abs(c.diasRestantes)}d)`
                            : c.diasRestantes === 0
                              ? "Vence hoy"
                              : `${c.diasRestantes}d`
                          }
                        </span>
                      </td>

                      {/* Acciones */}
                      <td style={{ padding: "13px 16px" }}>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <button
                            onClick={() => openEditar(c)}
                            style={{
                              padding: "5px 14px", borderRadius: "7px",
                              border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
                              fontSize: "12px", fontWeight: 600, color: "#f1f5f9",
                              cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                            }}
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => { setDevolverTarget(c); setDevolverError("") }}
                            title="Registrar devolución"
                            style={{
                              padding: "5px 10px", borderRadius: "7px",
                              border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)",
                              fontSize: "12px", fontWeight: 600, color: "#f87171",
                              cursor: "pointer", fontFamily: "inherit",
                              display: "flex", alignItems: "center", gap: "4px",
                            }}
                          >
                            <RotateCcw size={12} />
                            Devolver
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Carteles Devueltos ─────────────────────── */}
        <div style={{ marginTop: "20px" }}>
          <button
            onClick={() => setDevueltosOpen(o => !o)}
            style={{
              width: "100%",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 20px",
              background: "#13131a",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: devueltosOpen ? "14px 14px 0 0" : "14px",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <ChevronDown
                size={16}
                color="rgba(255,255,255,0.45)"
                style={{ transform: devueltosOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}
              />
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9" }}>Carteles Devueltos</span>
            </div>
            {devueltosOpen && !devueltosLoading && (
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>
                {devueltosData.length} devuelto{devueltosData.length !== 1 ? "s" : ""} en {MONTH_NAMES[devueltosMes - 1]} {devueltosAnio}
              </span>
            )}
          </button>

          {devueltosOpen && (
            <div style={{
              background: "#13131a",
              border: "1px solid rgba(255,255,255,0.07)", borderTop: "none",
              borderRadius: "0 0 14px 14px", padding: "16px 20px",
            }}>
              {/* Selector mes/año */}
              <div style={{ display: "flex", gap: "10px", marginBottom: "16px", alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={devueltosMes}
                  onChange={e => setDevueltosMes(Number(e.target.value))}
                  style={{ ...inp, width: "auto", minWidth: "130px", cursor: "pointer" }}
                >
                  {MONTH_NAMES.map((n, i) => (
                    <option key={i + 1} value={i + 1}>{n}</option>
                  ))}
                </select>
                <select
                  value={devueltosAnio}
                  onChange={e => setDevueltosAnio(Number(e.target.value))}
                  style={{ ...inp, width: "auto", minWidth: "90px", cursor: "pointer" }}
                >
                  {Array.from({ length: new Date().getFullYear() - 2023 }, (_, i) => 2024 + i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)" }}>
                  {devueltosLoading
                    ? "Cargando..."
                    : `${devueltosData.length} cartel${devueltosData.length !== 1 ? "es" : ""} devuelto${devueltosData.length !== 1 ? "s" : ""}`
                  }
                </span>
              </div>

              {/* Tabla devueltos */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      {["Nº Cartel", "Dirección", "Agente", "Fecha Devolución"].map(h => (
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
                    {devueltosData.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{
                          padding: "36px", textAlign: "center",
                          color: "rgba(255,255,255,0.35)", fontSize: "13px",
                        }}>
                          No hay carteles devueltos en este período
                        </td>
                      </tr>
                    ) : devueltosData.map((d, i) => (
                      <tr key={d.id} style={{ borderBottom: i < devueltosData.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                        <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>
                          {d.nro_cartel || "—"}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", color: "#f1f5f9", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.direccion || "—"}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", color: "#f1f5f9", whiteSpace: "nowrap" }}>
                          {d.agente || "—"}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>
                          {fmtDateTime(d.fecha_devolucion)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════
          MODAL — NUEVO / EDITAR CARTEL
      ════════════════════════════════════════════ */}
      {modalMode !== "none" && (
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
                <div className="bg-teal-500/[0.12] rounded-xl p-2.5 flex-shrink-0">
                  <MapPin size={20} className="text-teal-400" />
                </div>
                <div>
                  <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>
                    {modalMode === "nuevo" ? "Nuevo cartel" : "Editar cartel"}
                  </h2>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, marginTop: "2px" }}>
                    {modalMode === "nuevo"
                      ? "Se creará un registro en Airtable"
                      : `Cartel #${editTarget?.numero} · ${editTarget?.direccion}`
                    }
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

              {/* Row 1: Nº + MLS-ID */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <Field label="Nº de cartel *">
                  <input
                    type="number" min="1" step="1"
                    value={form.numero}
                    onChange={patch("numero")}
                    placeholder="296"
                    style={inp}
                    required
                    autoFocus
                  />
                </Field>
                <Field label="MLS-ID">
                  <input
                    type="text"
                    value={form.mlsId}
                    onChange={patch("mlsId")}
                    placeholder="421871024-95"
                    style={inp}
                  />
                </Field>
              </div>

              {/* Dirección */}
              <Field label="Dirección *">
                <input
                  type="text"
                  value={form.direccion}
                  onChange={patch("direccion")}
                  placeholder="Av. San Martín 1234"
                  style={inp}
                  required
                />
              </Field>

              {/* Row 2: Tipo + Vencimiento */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <Field label="Tipo de propiedad *">
                  <select
                    value={form.tipo}
                    onChange={patch("tipo")}
                    style={{ ...inp, cursor: "pointer" }}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Vencimiento *">
                  <input
                    type="date"
                    value={form.vencimiento}
                    onChange={patch("vencimiento")}
                    style={inp}
                    required
                  />
                </Field>
              </div>

              {/* Agente */}
              <Field label="Agente *">
                <select
                  value={form.agente}
                  onChange={patch("agente")}
                  style={{ ...inp, cursor: "pointer" }}
                  required
                >
                  <option value="">Seleccionar agente...</option>
                  {modalAgentes.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>

              {/* Error */}
              {error && (
                <div style={{
                  background: "rgba(227,24,55,0.12)", border: "1px solid rgba(227,24,55,0.25)",
                  borderRadius: "8px", padding: "10px 12px",
                  fontSize: "12.5px", color: "#ff8a9a", marginBottom: "14px",
                }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", alignItems: "center" }}>
                {saveSuccess ? (
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400 bg-emerald-500/[0.12] px-4 py-2.5 rounded-lg">
                    <CheckCircle2 size={15} /> Guardado correctamente
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={closeModal}
                      disabled={isPending}
                      style={{
                        padding: "9px 20px", borderRadius: "8px",
                        border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
                        fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.5)",
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      style={{
                        padding: "9px 24px", borderRadius: "8px", border: "none",
                        background: isPending
                          ? "#CBD5E1"
                          : "linear-gradient(135deg,#E31837 0%,#c0122d 100%)",
                        color: "white", fontSize: "13px", fontWeight: 700,
                        cursor: isPending ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                        display: "flex", alignItems: "center", gap: "6px",
                        boxShadow: isPending ? "none" : "0 2px 8px rgba(227,24,55,0.3)",
                      }}
                    >
                      {isPending && <Loader2 size={14} className="animate-spin" />}
                      {isPending
                        ? "Guardando..."
                        : <><Save size={14} /> {modalMode === "nuevo" ? "Crear cartel" : "Guardar cambios"}</>
                      }
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          MODAL — CONFIRMAR DEVOLUCIÓN
      ════════════════════════════════════════════ */}
      {devolverTarget && (
        <div onClick={() => { setDevolverTarget(null); setDevolverError("") }} className="crm-modal-backdrop">
          <div
            onClick={e => e.stopPropagation()}
            className="crm-modal"
            style={{ maxWidth: "420px" }}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="bg-rose-500/[0.12] rounded-xl p-2.5 flex-shrink-0">
                  <RotateCcw size={18} className="text-rose-400" />
                </div>
                <div>
                  <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>
                    Confirmar devolución
                  </h2>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, marginTop: "2px" }}>
                    Cartel #{devolverTarget.numero} · {devolverTarget.direccion}
                  </p>
                </div>
              </div>
              <button onClick={() => { setDevolverTarget(null); setDevolverError("") }} style={{
                background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "8px",
                width: "32px", height: "32px", display: "flex",
                alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "rgba(255,255,255,0.5)",
              }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: "20px" }}>
              <p style={{ fontSize: "13px", color: "#f1f5f9", marginBottom: "8px", lineHeight: 1.5 }}>
                ¿Confirmar la devolución de este cartel? Se registrará en el historial y se eliminará de Airtable.
              </p>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", marginBottom: "20px" }}>
                Agente: <strong>{devolverTarget.agente || "—"}</strong>
              </p>

              {devolverError && (
                <div style={{
                  background: "rgba(227,24,55,0.12)", border: "1px solid rgba(227,24,55,0.25)",
                  borderRadius: "8px", padding: "10px 12px",
                  fontSize: "12.5px", color: "#ff8a9a", marginBottom: "14px",
                }}>
                  ⚠️ {devolverError}
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => { setDevolverTarget(null); setDevolverError("") }}
                  disabled={devolverLoading}
                  style={{
                    padding: "9px 20px", borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
                    fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.5)",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDevolver}
                  disabled={devolverLoading}
                  style={{
                    padding: "9px 20px", borderRadius: "8px", border: "none",
                    background: devolverLoading ? "#CBD5E1" : "#E11D48",
                    color: "white", fontSize: "13px", fontWeight: 700,
                    cursor: devolverLoading ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: "6px",
                  }}
                >
                  {devolverLoading && <Loader2 size={14} className="animate-spin" />}
                  {devolverLoading ? "Registrando..." : <><RotateCcw size={14} /> Confirmar devolución</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
