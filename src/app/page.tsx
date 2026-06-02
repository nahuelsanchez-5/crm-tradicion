import { createServerClient } from "@/lib/supabase"
import KpiCard from "@/components/KpiCard"
import DashboardActions from "./DashboardActions"
import DashboardClock from "./DashboardClock"
import Image from "next/image"
import { Users, Building2, DollarSign, CreditCard } from "lucide-react"

// ── Constantes del mes actual ──────────────────────────
const MES       = 5
const ANIO      = 2026
const MES_LABEL = "Mayo 2026"

// ── Helpers de formato ────────────────────────────────
function fmtUSD(n: number): string {
  const rounded = Math.round(n * 100) / 100
  if (rounded === Math.floor(rounded)) {
    return `USD ${rounded.toLocaleString("es-AR")}`
  }
  return `USD ${rounded.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtFecha(fechaStr: string) {
  const [, m, d] = fechaStr.split("-")
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
  return `${parseInt(d)} ${meses[parseInt(m) - 1]}`
}

function extractPlan(concepto: string) {
  const match = concepto.match(/Plan\s+(PRO\+|PRO|B_QR|B_OFI)/)
  return match ? match[1] : "—"
}

function tipoColor(tipo: string) {
  if (tipo === "Venta") return "#0D9488"
  if (tipo.startsWith("Alquiler")) return "#2563EB"
  return "#64748B"
}

// ── Tipos locales ─────────────────────────────────────
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

// ── Estilos reutilizables ─────────────────────────────
const cardStyle: React.CSSProperties = {
  background: "white",
  borderRadius: "14px",
  border: "1.5px solid #EAECF2",
  overflow: "hidden",
}

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 18px",
  borderBottom: "1px solid #EAECF2",
}

function colorDot(color: string) {
  return (
    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, flexShrink: 0 }} />
  )
}

function Tag({ estado }: { estado: string }) {
  const styles: Record<string, React.CSSProperties> = {
    Pendiente: { background: "#FFF1F2", color: "#E11D48" },
    Parcial:   { background: "#FFFBEB", color: "#D97706" },
    Pagado:    { background: "#ECFDF5", color: "#059669" },
  }
  const planStyles: Record<string, React.CSSProperties> = {
    "PRO+":  { background: "#F5F3FF", color: "#7C3AED" },
    "PRO":   { background: "#ECFEFF", color: "#0891B2" },
    "B_QR":  { background: "#ECFEFF", color: "#0891B2" },
    "B_OFI": { background: "#ECFEFF", color: "#0891B2" },
  }
  const base = styles[estado] ?? planStyles[estado] ?? { background: "#F1F5F9", color: "#64748B" }
  return (
    <span style={{ ...base, display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700 }}>
      {estado}
    </span>
  )
}

// ═══════════════════════════════════════════════════════
//  PAGE COMPONENT
// ═══════════════════════════════════════════════════════
export default async function DashboardPage() {
  const supabase = createServerClient()

  // ── Fetch all data in parallel ──────────────────────
  const [
    { data: agentesData },
    { data: agentesListData },
    { data: opsMesData },
    { data: facturacionData },
    { data: planesData },
    { data: opsFeedRaw },
    { data: cartelesData },
    { data: encuestasData },
    { data: pagosRaw },
  ] = await Promise.all([

    supabase.from("agentes").select("id").eq("activo", true),

    supabase.from("agentes").select("id, nombre").eq("activo", true).order("nombre"),

    supabase.from("operaciones").select("id")
      .gte("fecha", `${ANIO}-${String(MES).padStart(2, "0")}-01`)
      .lt("fecha",  `${ANIO}-${String(MES + 1).padStart(2, "0")}-01`),

    supabase.from("facturacion")
      .select("objetivo_usd, real_usd")
      .eq("mes", MES).eq("anio", ANIO)
      .maybeSingle(),

    supabase.from("planes_crm")
      .select("pagado")
      .eq("mes", MES).eq("anio", ANIO),

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

  // ── Derived values ──────────────────────────────────
  const agentesCount  = agentesData?.length ?? 0
  const opsMesCount   = opsMesData?.length  ?? 0
  const planes        = planesData ?? []
  const planesPagados = planes.filter(p => p.pagado).length
  const planesTotal   = planes.length
  const pendientes    = planesTotal - planesPagados

  const factReal  = Number(facturacionData?.real_usd ?? 0)
  const factObj   = Number(facturacionData?.objetivo_usd ?? 1)
  const factLabel = fmtUSD(factReal)
  const factBadge = facturacionData
    ? `${Math.round((factReal / factObj) * 100)}% obj.`
    : "—"

  const opsFeed            = (opsFeedRaw    ?? []) as OperacionRow[]
  const pagos              = ((pagosRaw     ?? []) as unknown) as PagoRow[]
  const agentesForActions  = (agentesListData ?? []) as { id: string; nombre: string }[]

  // ═══════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Header ─────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        minHeight: "62px",
        padding: "0 24px",
        background: "white",
        borderBottom: "1px solid #EAECF2",
        flexShrink: 0,
      }}>
        {/* Izquierda — reloj en tiempo real */}
        <DashboardClock />

        {/* Centro — logo */}
        <Image
          src="/logo.png"
          alt="REMAX Tradición"
          width={280}
          height={88}
          style={{ objectFit: "contain", maxWidth: "280px", width: "auto", display: "block" }}
          priority
        />

        {/* Derecha */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "#F0F2F7", border: "1.5px solid #EAECF2",
            borderRadius: "8px", padding: "5px 12px",
            fontSize: "12.5px", fontWeight: 600, color: "#0F172A",
          }}>
            📅 {MES_LABEL}
          </div>
        </div>
      </div>

      {/* ── Scrollable content ─────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>

        {/* ── KPI Grid ─────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "20px" }}>
          <KpiCard
            title="Agentes activos"
            value={agentesCount}
            badge="= Sin cambios"
            gradient="linear-gradient(135deg, #E31837 0%, #9B0F26 100%)"
            shadowColor="rgba(227,24,55,0.35)"
            icon={<Users size={20} color="white" />}
          />
          <KpiCard
            title="Operaciones del mes"
            value={opsMesCount}
            badge={`↑ ${MES_LABEL}`}
            gradient="linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)"
            shadowColor="rgba(124,58,237,0.3)"
            icon={<Building2 size={20} color="white" />}
          />
          <KpiCard
            title="Facturación USD"
            value={factLabel}
            badge={factBadge}
            gradient="linear-gradient(135deg, #0D9488 0%, #0F766E 100%)"
            shadowColor="rgba(13,148,136,0.3)"
            icon={<DollarSign size={20} color="white" />}
          />
          <KpiCard
            title="Planes cobrados"
            value={`${planesPagados}/${planesTotal}`}
            badge={pendientes > 0 ? `${pendientes} pend.` : "✓ Todos"}
            gradient="linear-gradient(135deg, #D97706 0%, #B45309 100%)"
            shadowColor="rgba(217,119,6,0.3)"
            icon={<CreditCard size={20} color="white" />}
          />
        </div>

        {/* ── Accesos rápidos ──────────────────────── */}
        <DashboardActions agentes={agentesForActions} />

        {/* ── Bottom 2-col ─────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "16px" }}>

          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Pagos pendientes */}
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {colorDot("#E11D48")}
                  <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    Pagos pendientes — {MES_LABEL}
                  </h2>
                </div>
                <span style={{ fontSize: "12px", color: "#64748B", fontWeight: 500, cursor: "pointer" }}>
                  Ver todos →
                </span>
              </div>

              {pagos.length === 0 ? (
                <div style={{ padding: "28px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>
                  ✓ No hay pagos pendientes este mes
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F8F9FC", borderBottom: "1px solid #EAECF2" }}>
                      {["Agente", "Plan", "Debe", "Pagado", "Estado"].map(h => (
                        <th key={h} style={{ padding: "9px 18px", textAlign: "left", fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.8px", color: "#94A3B8" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagos.map((p, i) => {
                      const agentesField = p.agentes as { nombre: string } | null
                      const nombre  = agentesField?.nombre ?? "—"
                      const plan    = extractPlan(p.concepto)
                      const isLast  = i === pagos.length - 1
                      return (
                        <tr key={i} style={{ borderBottom: isLast ? "none" : "1px solid #F3F4F6" }}>
                          <td style={{ padding: "12px 18px" }}>
                            <div style={{ fontWeight: 600, fontSize: "13px", color: "#0F172A" }}>{nombre}</div>
                            <div style={{ fontSize: "11px", color: "#64748B", marginTop: "1px" }}>{MES_LABEL}</div>
                          </td>
                          <td style={{ padding: "12px 18px" }}><Tag estado={plan} /></td>
                          <td style={{ padding: "12px 18px", fontWeight: 700, fontSize: "13px", color: "#0F172A" }}>
                            {fmtUSD(p.monto_debe)}
                          </td>
                          <td style={{ padding: "12px 18px", fontSize: "13px", color: "#64748B" }}>
                            {fmtUSD(p.monto_pagado)}
                          </td>
                          <td style={{ padding: "12px 18px" }}><Tag estado={p.estado} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Mini stats — carteles + encuestas */}
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {colorDot("#2563EB")}
                  <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    Resumen rápido — {MES_LABEL}
                  </h2>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", padding: "16px" }}>
                {[
                  { n: cartelesData?.total_entregados  ?? 0, label: "Carteles entregados",   bg: "#FFF1F2", color: "#E11D48" },
                  { n: cartelesData?.total_recuperados ?? 0, label: "Carteles recuperados",  bg: "#F0FDF4", color: "#059669" },
                  { n: encuestasData?.total_enviadas   ?? 0, label: "Encuestas enviadas",    bg: "#EFF6FF", color: "#2563EB" },
                  { n: encuestasData?.total_respondidas ?? 0, label: "Encuestas resp.",      bg: "#FFFBEB", color: "#D97706" },
                ].map(({ n, label, bg, color }) => (
                  <div key={label} style={{ background: bg, borderRadius: "12px", padding: "14px", textAlign: "center" }}>
                    <div style={{ fontSize: "22px", fontWeight: 800, color, letterSpacing: "-0.5px" }}>{n}</div>
                    <div style={{ fontSize: "10.5px", fontWeight: 600, color, opacity: 0.75, marginTop: "2px" }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column — Operaciones feed */}
          <div style={{ ...cardStyle, display: "flex", flexDirection: "column" }}>
            <div style={cardHeaderStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {colorDot("#0D9488")}
                <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  Últimas operaciones
                </h2>
              </div>
              <span style={{ fontSize: "12px", color: "#64748B", fontWeight: 500, cursor: "pointer" }}>
                Ver todas
              </span>
            </div>

            <div style={{ flex: 1 }}>
              {opsFeed.length === 0 ? (
                <div style={{ padding: "28px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>
                  No hay operaciones registradas
                </div>
              ) : (
                opsFeed.map((op, i) => {
                  const isLast = i === opsFeed.length - 1
                  const color  = tipoColor(op.tipo)
                  return (
                    <div
                      key={i}
                      style={{ display: "flex", gap: "12px", padding: "12px 18px", borderBottom: isLast ? "none" : "1px solid #F3F4F6" }}
                    >
                      {/* Dot + line */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "3px" }}>
                        <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: color, flexShrink: 0 }} />
                        {!isLast && <div style={{ width: "1.5px", flex: 1, background: "#EAECF2", marginTop: "4px" }} />}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {op.direccion}
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748B", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {op.tipo} · {op.agentes}
                        </div>
                        <div style={{ fontSize: "10.5px", color: "#94A3B8", marginTop: "2px" }}>
                          {fmtFecha(op.fecha)} ·{" "}
                          <strong style={{ color }}>{fmtUSD(op.comision_neta)}</strong>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

        </div>{/* /bottom-grid */}
      </div>{/* /content */}
    </div>
  )
}
