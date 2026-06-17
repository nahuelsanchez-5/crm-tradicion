import { createServerClient } from "@/lib/supabase"
import KpiCard from "@/components/KpiCard"
import DashboardActions from "./DashboardActions"
import DashboardClock from "./DashboardClock"
import Image from "next/image"
import Link from "next/link"
import { Users, Building2, DollarSign, Handshake, Clock } from "lucide-react"

const _now      = new Date()
const MES       = _now.getMonth() + 1
const ANIO      = _now.getFullYear()
const MES_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                   "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
const MES_LABEL = `${MES_NAMES[MES - 1]} ${ANIO}`

function fmtUSD(n: number): string {
  const rounded = Math.round(n * 100) / 100
  if (rounded === Math.floor(rounded)) return `USD ${rounded.toLocaleString("es-AR")}`
  return `USD ${rounded.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtFecha(fechaStr: string) {
  const [, m, d] = fechaStr.split("-")
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
  return `${parseInt(d)} ${meses[parseInt(m) - 1]}`
}

function fmtFechaRelativa(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return "Hoy"
  if (days === 1) return "Ayer"
  return `Hace ${days} días`
}

function tipoColor(tipo: string) {
  if (tipo === "Venta") return "#0D9488"
  if (tipo.startsWith("Alquiler")) return "#2563EB"
  return "#64748B"
}

function extractPlan(concepto: string) {
  const match = concepto.match(/Plan\s+(PRO\+|PRO|B_QR|B_OFI)/)
  return match ? match[1] : "—"
}

interface PagoRow {
  concepto: string
  monto_debe: number
  monto_pagado: number
  estado: string
  agentes: { nombre: string } | null
}

interface OperacionRow {
  fecha: string
  direccion: string
  agentes: string
  tipo: string
  comision_neta: number
}

export interface OfertaSinActividad {
  id: string
  numero: number
  direccion: string
  estado: string
  updated_at: string
}

export interface OfertaActiva {
  id: string
  numero: number
  direccion: string
  estado: string
}

function StatusBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    Pendiente: "bg-rose-500/15 text-rose-400 border-rose-500/25",
    Parcial:   "bg-amber-500/15 text-amber-400 border-amber-500/25",
    Pagado:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    "PRO+":    "bg-violet-500/15 text-violet-400 border-violet-500/25",
    PRO:       "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
    B_QR:      "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
    B_OFI:     "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  }
  const cls = map[estado] ?? "bg-white/[0.08] text-white/50 border-white/15"
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      {estado}
    </span>
  )
}

export default async function DashboardPage() {
  const supabase = createServerClient()

  const mesStr       = String(MES).padStart(2, "0")
  const mesSiguiente = String(MES === 12 ? 1 : MES + 1).padStart(2, "0")
  const anioSig      = MES === 12 ? ANIO + 1 : ANIO
  const cutoff5d     = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: agentesData },
    { data: agentesListData },
    { data: opsMesData },
    { data: facturacionData },
    { count: ofertasEnCursoCount },
    { data: ofertasSinActividadRaw },
    { data: ofertasActivasRaw },
    { data: opsFeedRaw },
    { data: cartelesData },
    { data: encuestasData },
    { data: pagosRaw },
  ] = await Promise.all([
    supabase.from("agentes").select("id").eq("activo", true),
    supabase.from("agentes").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("operaciones").select("id")
      .gte("fecha", `${ANIO}-${mesStr}-01`)
      .lt("fecha",  `${anioSig}-${mesSiguiente}-01`),
    supabase.from("facturacion")
      .select("objetivo_usd, real_usd")
      .eq("mes", MES).eq("anio", ANIO)
      .maybeSingle(),
    supabase.from("ofertas")
      .select("id", { count: "exact", head: true })
      .neq("estado", "Cerradas")
      .neq("estado", "Caídas"),
    supabase.from("ofertas")
      .select("id, numero, direccion, estado, updated_at")
      .neq("estado", "Cerradas")
      .neq("estado", "Caídas")
      .lt("updated_at", cutoff5d)
      .order("updated_at", { ascending: true })
      .limit(10),
    supabase.from("ofertas")
      .select("id, numero, direccion, estado")
      .neq("estado", "Cerradas")
      .neq("estado", "Caídas")
      .order("numero", { ascending: false })
      .limit(50),
    supabase.from("operaciones")
      .select("fecha, direccion, agentes, tipo, comision_neta")
      .order("fecha", { ascending: false })
      .limit(5),
    supabase.from("carteles")
      .select("total_entregados, total_recuperados")
      .eq("mes", MES).eq("anio", ANIO)
      .maybeSingle(),
    supabase.from("encuestas")
      .select("total_enviadas, total_respondidas")
      .eq("mes", MES).eq("anio", ANIO)
      .maybeSingle(),
    supabase.from("pagos")
      .select("concepto, monto_debe, monto_pagado, estado, agentes(nombre)")
      .in("estado", ["Pendiente", "Parcial"])
      .order("fecha", { ascending: false })
      .limit(5),
  ])

  const agentesCount        = agentesData?.length ?? 0
  const opsMesCount         = opsMesData?.length  ?? 0
  const ofertasEnCurso      = ofertasEnCursoCount ?? 0
  const ofertasSinActividad = (ofertasSinActividadRaw ?? []) as OfertaSinActividad[]
  const ofertasActivas      = (ofertasActivasRaw ?? []) as OfertaActiva[]

  const factReal  = Number(facturacionData?.real_usd  ?? 0)
  const factObj   = Number(facturacionData?.objetivo_usd ?? 1)
  const factLabel = fmtUSD(factReal)
  const factPct   = facturacionData ? Math.round((factReal / factObj) * 100) : null

  const opsFeed   = (opsFeedRaw ?? []) as OperacionRow[]
  const pagos     = ((pagosRaw  ?? []) as unknown) as PagoRow[]
  const agentesForActions = (agentesListData ?? []) as { id: string; nombre: string }[]

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div
        className="flex items-center flex-shrink-0"
        style={{ minHeight: "62px", padding: "0 24px 0 64px", background: "rgba(10,10,26,0.8)", borderBottom: "1px solid var(--crm-divider)", backdropFilter: "blur(8px)" }}
      >
        {/* Clock — hidden on mobile */}
        <div className="hidden md:block flex-1">
          <DashboardClock />
        </div>
        <div className="flex-1 md:flex-none flex justify-center md:justify-start">
          <Image
            src="/logo.png" alt="REMAX Tradición"
            width={200} height={22}
            priority
            className="md:w-[240px] md:h-[27px]"
          />
        </div>
        <div className="flex-1 flex justify-end">
          <div
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] md:text-[12.5px] font-semibold"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--crm-text)" }}
          >
            <span style={{ color: "var(--crm-text-muted)" }}>📅</span>
            <span className="hidden sm:inline">{MES_LABEL}</span>
            <span className="sm:hidden">{MES_LABEL.slice(0, 3)}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-5 md:mb-6">
          <KpiCard
            title="Agentes activos"
            value={agentesCount}
            iconBg="bg-rose-500/15"
            iconColor="text-rose-400"
            icon={<Users size={18} />}
            trend="Sin cambios"
            animate
          />
          <KpiCard
            title="Ofertas en curso"
            value={ofertasEnCurso}
            iconBg="bg-amber-500/15"
            iconColor="text-amber-400"
            icon={<Handshake size={18} />}
            trend="Activas"
            animate
          />
          <KpiCard
            title="Operaciones del mes"
            value={opsMesCount}
            iconBg="bg-violet-500/15"
            iconColor="text-violet-400"
            icon={<Building2 size={18} />}
            trend={`↑ ${MES_LABEL}`}
            trendUp
            animate
          />
          <KpiCard
            title="Facturación USD"
            value={factLabel}
            iconBg="bg-teal-500/15"
            iconColor="text-teal-400"
            icon={<DollarSign size={18} />}
            badge={factPct !== null ? `${factPct}% obj.` : undefined}
            trend={factPct !== null ? (factPct >= 100 ? "↑ Objetivo alcanzado" : `${factPct}% del objetivo`) : undefined}
            trendUp={factPct !== null && factPct >= 100}
            primary
          />
        </div>

        {/* Quick actions */}
        <DashboardActions agentes={agentesForActions} ofertasActivas={ofertasActivas} />

        {/* Ofertas sin actividad +5 días */}
        {ofertasSinActividad.length > 0 && (
          <div className="crm-glass-section mb-6">
            <div className="crm-section-hd" style={{ background: "#13131a", borderRadius: "10px 10px 0 0" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <Clock size={14} className="text-amber-400" />
                </div>
                <h2 className="crm-section-title">Ofertas sin actividad +5 días</h2>
                <span
                  className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.25)" }}
                >
                  {ofertasSinActividad.length}
                </span>
              </div>
            </div>
            <div>
              {ofertasSinActividad.map((o, i) => (
                <div
                  key={o.id}
                  className="crm-row flex items-center justify-between px-4 md:px-5 py-3 gap-3"
                  style={i < ofertasSinActividad.length - 1 ? { borderBottom: "1px solid var(--crm-divider)" } : {}}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="crm-num-badge">#{o.numero}</span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold m-0 truncate" style={{ color: "var(--crm-text)" }}>{o.direccion}</p>
                      <p className="text-[11px] mt-0.5 m-0" style={{ color: "var(--crm-text-muted)" }}>
                        {o.estado} · {fmtFechaRelativa(o.updated_at)}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/ofertas/${o.id}`}
                    className="flex-shrink-0 px-3 py-2 rounded-lg text-white text-[12px] font-semibold no-underline transition-all duration-150 hover:brightness-110"
                    style={{ background: "var(--crm-accent)" }}
                  >
                    Ver →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom 2-col */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-[1fr_340px]">

          {/* Left column */}
          <div className="flex flex-col gap-4">

            {/* Pagos pendientes */}
            <div className="crm-glass-section">
              <div className="crm-section-hd">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <h2 className="crm-section-title">Pagos pendientes — {MES_LABEL}</h2>
                </div>
                <Link href="/pagos" className="crm-link-sm">
                  Ver todos →
                </Link>
              </div>
              {pagos.length === 0 ? (
                <div className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--crm-text-muted)" }}>
                  ✓ No hay pagos pendientes este mes
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <table className="hidden md:table w-full border-collapse crm-table">
                    <thead>
                      <tr>
                        {["Agente", "Plan", "Debe", "Pagado", "Estado"].map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pagos.map((p, i) => {
                        const agentesField = p.agentes as { nombre: string } | null
                        const nombre = agentesField?.nombre ?? "—"
                        const plan   = extractPlan(p.concepto)
                        return (
                          <tr key={i}>
                            <td>
                              <p className="font-semibold m-0" style={{ color: "var(--crm-text)" }}>{nombre}</p>
                              <p className="text-[11px] mt-0.5 m-0" style={{ color: "var(--crm-text-muted)" }}>{MES_LABEL}</p>
                            </td>
                            <td><StatusBadge estado={plan} /></td>
                            <td className="font-bold" style={{ color: "var(--crm-text)" }}>{fmtUSD(p.monto_debe)}</td>
                            <td style={{ color: "var(--crm-text-muted)" }}>{fmtUSD(p.monto_pagado)}</td>
                            <td><StatusBadge estado={p.estado} /></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {/* Mobile card list */}
                  <div className="md:hidden">
                    {pagos.map((p, i) => {
                      const agentesField = p.agentes as { nombre: string } | null
                      const nombre = agentesField?.nombre ?? "—"
                      const plan   = extractPlan(p.concepto)
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between px-4 py-3 gap-3"
                          style={i < pagos.length - 1 ? { borderBottom: "1px solid var(--crm-divider)" } : {}}
                        >
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold m-0 truncate" style={{ color: "var(--crm-text)" }}>{nombre}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <StatusBadge estado={plan} />
                              <span className="text-[11px]" style={{ color: "var(--crm-text-muted)" }}>{fmtUSD(p.monto_debe)}</span>
                            </div>
                          </div>
                          <StatusBadge estado={p.estado} />
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Mini stats */}
            <div className="crm-glass-section">
              <div className="crm-section-hd">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <h2 className="crm-section-title">Resumen rápido — {MES_LABEL}</h2>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
                {[
                  { n: cartelesData?.total_entregados  ?? 0, label: "Carteles entregados",  cls: "bg-rose-500/[0.12] text-rose-400" },
                  { n: cartelesData?.total_recuperados ?? 0, label: "Carteles recuperados", cls: "bg-emerald-500/[0.12] text-emerald-400" },
                  { n: encuestasData?.total_enviadas   ?? 0, label: "Encuestas enviadas",   cls: "bg-blue-500/[0.12] text-blue-400" },
                  { n: encuestasData?.total_respondidas ?? 0, label: "Encuestas resp.",     cls: "bg-amber-500/[0.12] text-amber-400" },
                ].map(({ n, label, cls }) => (
                  <div
                    key={label}
                    className={`${cls} rounded-xl p-4 text-center`}
                    style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <p className="text-[22px] font-bold leading-none m-0">{n}</p>
                    <p className="text-[10.5px] font-semibold mt-1.5 m-0 opacity-80">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — Operaciones feed */}
          <div className="crm-glass-section flex flex-col" style={{ overflow: "hidden" }}>
            <div className="crm-section-hd">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-teal-400" />
                <h2 className="crm-section-title">Últimas operaciones</h2>
              </div>
              <Link href="/operaciones" className="crm-link-sm">
                Ver todas
              </Link>
            </div>
            <div className="flex-1">
              {opsFeed.length === 0 ? (
                <div className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--crm-text-muted)" }}>
                  No hay operaciones registradas
                </div>
              ) : (
                opsFeed.map((op, i) => {
                  const isLast = i === opsFeed.length - 1
                  const color  = tipoColor(op.tipo)
                  return (
                    <div
                      key={i}
                      className="crm-row flex gap-3 px-5 py-3.5"
                      style={!isLast ? { borderBottom: "1px solid var(--crm-divider)" } : {}}
                    >
                      <div className="flex flex-col items-center pt-1">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                        {!isLast && <div className="w-px flex-1 mt-1" style={{ background: "var(--crm-divider)" }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold truncate m-0" style={{ color: "var(--crm-text)" }}>{op.direccion}</p>
                        <p className="text-[11px] mt-0.5 truncate m-0" style={{ color: "var(--crm-text-muted)" }}>{op.tipo} · {op.agentes}</p>
                        <p className="text-[10.5px] mt-1 m-0" style={{ color: "var(--crm-text-muted)" }}>
                          {fmtFecha(op.fecha)} ·{" "}
                          <span className="font-semibold" style={{ color }}>{fmtUSD(op.comision_neta)}</span>
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
