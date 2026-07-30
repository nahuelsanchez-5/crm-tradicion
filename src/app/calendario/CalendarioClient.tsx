"use client"

import { useTransition, useState } from "react"
import dynamic from "next/dynamic"
import { CalendarDays, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import type { EventInput } from "@fullcalendar/core"
import { marcarSeguimiento } from "./actions"
import type { EventoItem, OfertaInactiva } from "./page"
import Topbar from "@/components/Topbar"

const CalendarioFC = dynamic(() => import("./CalendarioFC"), { ssr: false })

const MONTH_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]

function fmtFecha(dateStr: string): string {
  const [a, m, d] = dateStr.split("-")
  return `${parseInt(d)} ${MONTH_SHORT[parseInt(m) - 1]} ${a}`
}

function getProximos30(eventos: EventoItem[], hoy: string): EventoItem[] {
  const today = new Date(hoy + "T00:00:00")
  const limit = new Date(today)
  limit.setDate(limit.getDate() + 30)
  return eventos
    .filter(e => e.tipo !== "inactiva")
    .filter(e => {
      const d = new Date(e.date + "T00:00:00")
      return d >= today && d <= limit
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

interface Props {
  eventos:          EventoItem[]
  hoy:              string
  ofertasInactivas: OfertaInactiva[]
}

export default function CalendarioClient({ eventos, hoy, ofertasInactivas }: Props) {
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId]    = useState<string | null>(null)
  const [seguidos,  setSeguidos]     = useState<Set<string>>(new Set())

  const proximoEventos = getProximos30(eventos, hoy)
  const fcEvents: EventInput[] = eventos.map(e => ({
    id:              e.id,
    title:           e.title,
    date:            e.date,
    backgroundColor: e.backgroundColor,
    borderColor:     e.borderColor,
    textColor:       e.textColor,
  }))

  function handleSeguimiento(ofertaId: string) {
    setPendingId(ofertaId)
    startTransition(async () => {
      const result = await marcarSeguimiento(ofertaId)
      if (!result.error) setSeguidos(prev => new Set([...prev, ofertaId]))
      setPendingId(null)
    })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0a0a1a" }}>

      <Topbar moduleName="Calendario" />

      {/* ── Header ─────────────────────────────────── */}
      <div className="crm-page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <CalendarDays size={17} color="#E31837" />
          <h1 style={{ fontSize: "17px", fontWeight: 800, color: "var(--crm-text)", margin: 0, letterSpacing: "-0.3px" }}>
            Calendario
          </h1>
        </div>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <LegendDot color="#22c55e" label="Cierres" />
          <LegendDot color="#3b82f6" label="Mainstreet" />
          <LegendDot color="#f97316" label="Sin actividad" />
        </div>
      </div>

      {/* ── Content ────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", display: "flex", gap: "20px", minHeight: 0 }}>

        {/* Izquierda: Calendario (70%) */}
        <div style={{ flex: "0 0 70%", minWidth: 0 }}>
          <CalendarioFC events={fcEvents} />
        </div>

        {/* Derecha: Panel (30%) */}
        <div style={{ flex: "0 0 calc(30% - 20px)", display: "flex", flexDirection: "column", gap: "14px", overflow: "auto" }}>

          {/* Ofertas sin actividad */}
          {ofertasInactivas.length > 0 && (
            <PanelCard
              title={`Sin actividad (${ofertasInactivas.length})`}
              titleColor="#f97316"
              icon={<AlertTriangle size={13} color="#f97316" />}
              borderAccent="rgba(249,115,22,0.3)"
            >
              {ofertasInactivas.map(o => (
                <div key={o.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 14px", gap: "8px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.3)", display: "block" }}>
                      #{o.numero}
                    </span>
                    <span style={{
                      fontSize: "12px", color: "var(--crm-text)", fontWeight: 500,
                      display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {o.direccion}
                    </span>
                  </div>
                  {seguidos.has(o.id) ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                      <CheckCircle2 size={13} color="#4ade80" />
                      <span style={{ fontSize: "11px", color: "#4ade80", fontWeight: 600 }}>Listo</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSeguimiento(o.id)}
                      disabled={isPending}
                      style={{
                        padding: "5px 10px", borderRadius: "6px",
                        background: "rgba(249,115,22,0.12)",
                        border: "1px solid rgba(249,115,22,0.3)",
                        color: "#fb923c", fontSize: "11px", fontWeight: 600,
                        cursor: isPending ? "not-allowed" : "pointer",
                        fontFamily: "inherit", flexShrink: 0, whiteSpace: "nowrap",
                        display: "flex", alignItems: "center", gap: "4px",
                      }}
                    >
                      {isPending && pendingId === o.id
                        ? <Loader2 size={11} className="animate-spin" />
                        : "Marcar seguimiento"}
                    </button>
                  )}
                </div>
              ))}
            </PanelCard>
          )}

          {/* Próximos 30 días */}
          <PanelCard title="Próximos 30 días" icon={null}>
            {proximoEventos.length === 0 ? (
              <p style={{ padding: "16px 14px", fontSize: "13px", color: "rgba(255,255,255,0.3)", margin: 0, textAlign: "center" }}>
                Sin eventos próximos
              </p>
            ) : (
              proximoEventos.map(e => (
                <div key={e.id} style={{
                  display: "flex", alignItems: "flex-start", gap: "10px",
                  padding: "9px 14px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <div style={{
                    width: "9px", height: "9px", borderRadius: "50%",
                    background: e.backgroundColor, flexShrink: 0, marginTop: "4px",
                  }} />
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.3)", display: "block" }}>
                      {fmtFecha(e.date)}
                    </span>
                    <span style={{
                      fontSize: "12px", color: "var(--crm-text)", fontWeight: 500,
                      display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {e.title}
                    </span>
                  </div>
                </div>
              ))
            )}
          </PanelCard>

        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>{label}</span>
    </div>
  )
}

function PanelCard({
  title, titleColor, icon, borderAccent, children,
}: {
  title: string
  titleColor?: string
  icon: React.ReactNode
  borderAccent?: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      background: "var(--crm-surface-2)",
      border: `1px solid ${borderAccent ?? "rgba(255,255,255,0.07)"}`,
      borderRadius: "14px",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "7px",
        padding: "12px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        {icon}
        <span style={{ fontSize: "13px", fontWeight: 700, color: titleColor ?? "var(--crm-text)" }}>
          {title}
        </span>
      </div>
      <div>{children}</div>
    </div>
  )
}
