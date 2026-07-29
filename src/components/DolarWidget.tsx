"use client"

import { useState, useEffect } from "react"

interface DolarEntry {
  casa: string
  venta: number
}

function fmtPeso(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-AR")
}

export default function DolarWidget() {
  const [blue, setBlue]       = useState<number | null>(null)
  const [oficial, setOficial] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchDolar() {
    try {
      const res = await fetch("https://dolarapi.com/v1/dolares", { cache: "no-store" })
      if (!res.ok) throw new Error("fetch failed")
      const data: DolarEntry[] = await res.json()
      setBlue(data.find(d => d.casa === "blue")?.venta ?? null)
      setOficial(data.find(d => d.casa === "oficial")?.venta ?? null)
    } catch {
      // keep nulls — UI shows "—"
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDolar()
    const id = setInterval(fetchDolar, 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="mx-3 mb-2 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--crm-divider)" }}>
      <p className="text-[9.5px] font-bold tracking-[1.5px] uppercase text-white/25 mb-2">
        Dólar hoy
      </p>
      {loading ? (
        <p className="text-crm-xs text-white/30">...</p>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-crm-xs text-white/40">Blue venta</span>
            <span className="text-crm-sm font-bold text-emerald-400">
              {blue !== null ? fmtPeso(blue) : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-crm-xs text-white/40">Oficial venta</span>
            <span className="text-crm-sm font-semibold text-white/50">
              {oficial !== null ? fmtPeso(oficial) : "—"}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
