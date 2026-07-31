import { createServerClient } from "@/lib/supabase"
import KpiCard from "@/components/KpiCard"
import DashboardActions from "./DashboardActions"
import Topbar from "@/components/Topbar"
import StatusBadge from "@/components/StatusBadge"
import Link from "next/link"
import { Users, Building2, DollarSign, Handshake, Clock } from "lucide-react"
import { fmtUSD } from "@/lib/format"

const MES_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                   "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

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


export default async function DashboardPage() {
  const supabase  = createServerClient()
  const now       = new Date()
  const MES       = now.getMonth() + 1
  const ANIO      = now.getFullYear()
  const MES_LABEL = `${MES_NAMES[MES - 1]} ${ANIO}`

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
    supabase.from("agentes").select("id, activo, fecha_alta, fecha_baja"),
    supabase.from("agentes").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("operaciones").select("id, comision_bruta")
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

  const agentesActivos = (agentesData ?? []).filter((a: { activo: boolean }) => a.activo === true).length

  const hoy = new Date()
  const primerDiaMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const ultimoDiaMesAnterior = new Date(primerDiaMesActual.getTime() - 1)

  const agentesActivosMesAnterior = (agentesData ?? []).filter((a: { activo: boolean; fecha_alta: string | null; fecha_baja: string | null }) => {
    const alta = a.fecha_alta ? new Date(a.fecha_alta + "T00:00:00") : null
    const baja = a.fecha_baja ? new Date(a.fecha_baja + "T00:00:00") : null
    if (!alta || alta > ultimoDiaMesAnterior) return false
    if (!baja) return true
    return baja > ultimoDiaMesAnterior
  }).length

  const variacionAgentes = agentesActivos - agentesActivosMesAnterior
  const opsMesCount         = opsMesData?.length  ?? 0
  const ofertasEnCurso      = ofertasEnCursoCount ?? 0
  const ofertasSinActividad = (ofertasSinActividadRaw ?? []) as OfertaSinActividad[]
  const ofertasActivas      = (ofertasActivasRaw ?? []) as OfertaActiva[]

  const factReal  = ((opsMesData ?? []) as Array<{ comision_bruta: number }>).reduce((s, o) => s + (Number(o.comision_bruta) || 0), 0)
  const factObj   = Number(facturacionData?.objetivo_usd ?? 1)
  const factLabel = fmtUSD(factReal)
  const factPct   = facturacionData?.objetivo_usd ? Math.round((factReal / factObj) * 100) : null

  const opsFeed   = (opsFeedRaw ?? []) as OperacionRow[]
  const pagos     = ((pagosRaw  ?? []) as unknown) as PagoRow[]
  const agentesForActions = (agentesListData ?? []) as { id: string; nombre: string }[]

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <Topbar moduleName="Dashboard" />

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-5 md:mb-6">
          <KpiCard
            title="Agentes activos"
            value={agentesActivos}
            iconBg="bg-rose-500/15"
            iconColor="text-rose-400"
            icon={<Users size={18} />}
            trend={
              variacionAgentes === 0
                ? "Sin cambios vs mes anterior"
                : variacionAgentes > 0
                ? `+${variacionAgentes} vs mes anterior`
                : `${variacionAgentes} vs mes anterior`
            }
            trendUp={variacionAgentes > 0}
            trendDown={variacionAgentes < 0}
            animate
          />
          <KpiCard
            title="Ofertas en curso"
            value={ofertasEnCurso}
            iconBg="bg-amber-500/15"
            iconColor="text-amber-400"
            icon={<Handshake size={18} />}
            animate
          />
          <KpiCard
            title="Operaciones del mes"
            value={opsMesCount}
            iconBg="bg-violet-500/15"
            iconColor="text-violet-400"
            icon={<Building2 size={18} />}
            trend={MES_LABEL}
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
            <div className="crm-section-hd" style={{ background: "var(--crm-surface-2)", borderRadius: "10px 10px 0 0" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <Clock size={14} className="text-amber-400" />
                </div>
                <h2 className="crm-section-title">Ofertas sin actividad +5 días</h2>
                <span
                  className="text-crm-xs font-bold px-2.5 py-0.5 rounded-full"
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
                      <p className="text-crm-md font-semibold m-0 truncate" style={{ color: "var(--crm-text)" }}>{o.direccion}</p>
                      <p className="text-crm-xs mt-0.5 m-0" style={{ color: "var(--crm-text-muted)" }}>
                        {o.estado} · {fmtFechaRelativa(o.updated_at)}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/ofertas/${o.id}`}
                    className="flex-shrink-0 px-3 py-2 rounded-lg text-white text-crm-sm font-semibold no-underline transition-all duration-150 hover:brightness-110"
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
                  <h2 className="crm-section-title">Pagos pendientes</h2>
                </div>
                <Link href="/pagos" className="crm-link-sm">
                  Ver todos →
                </Link>
              </div>
              {pagos.length === 0 ? (
                <div className="px-5 py-8 text-center text-crm-md" style={{ color: "var(--crm-text-muted)" }}>
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
                              <p className="text-crm-xs mt-0.5 m-0" style={{ color: "var(--crm-text-muted)" }}>{MES_LABEL}</p>
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
                            <p className="text-crm-md font-semibold m-0 truncate" style={{ color: "var(--crm-text)" }}>{nombre}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <StatusBadge estado={plan} />
                              <span className="text-crm-xs" style={{ color: "var(--crm-text-muted)" }}>{fmtUSD(p.monto_debe)}</span>
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
                    <p className="text-crm-xs font-semibold mt-1.5 m-0 opacity-80">{label}</p>
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
                <div className="px-5 py-8 text-center text-crm-md" style={{ color: "var(--crm-text-muted)" }}>
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
                        <p className="text-crm-sm font-semibold truncate m-0" style={{ color: "var(--crm-text)" }}>{op.direccion}</p>
                        <p className="text-crm-xs mt-0.5 truncate m-0" style={{ color: "var(--crm-text-muted)" }}>{op.tipo} · {op.agentes}</p>
                        <p className="text-crm-xs mt-1 m-0" style={{ color: "var(--crm-text-muted)" }}>
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
