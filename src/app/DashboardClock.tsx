"use client"

import { useState, useEffect } from "react"

const DIAS   = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"]
const MESES  = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

function pad(n: number) { return String(n).padStart(2, "0") }

function formatFecha(d: Date): string {
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

function formatHora(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export default function DashboardClock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!now) return <div style={{ width: "200px" }} />

  return (
    <div>
      <div style={{
        fontSize: "12.5px", fontWeight: 600,
        color: "rgba(255,255,255,0.40)", letterSpacing: "0.1px",
        marginBottom: "2px",
      }}>
        {formatFecha(now)}
      </div>
      <div style={{
        fontSize: "24px", fontWeight: 800,
        color: "var(--crm-text)", letterSpacing: "1px",
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
      }}>
        {formatHora(now)}
      </div>
    </div>
  )
}
