"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"

interface OfertaItem     { id: string; numero: number; direccion: string; dias: number; href: string }
interface CartelItem     { id: string; numero: number; direccion: string; diasRestantes: number; href: string }
interface MainstreetItem { nombre: string; fecha: string; diasFaltan: number; href: string }

interface AlertasData {
  total: number
  categorias: {
    ofertas:    { count: number; items: OfertaItem[] }
    carteleria: { count: number; items: CartelItem[] }
    mainstreet: { count: number; items: MainstreetItem[] }
  }
}

const EMPTY: AlertasData = {
  total: 0,
  categorias: {
    ofertas:    { count: 0, items: [] },
    carteleria: { count: 0, items: [] },
    mainstreet: { count: 0, items: [] },
  },
}

function fmtFechaCorta(isoStr: string) {
  const [, m, d] = isoStr.split("-")
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
  return `${parseInt(d)} ${meses[parseInt(m) - 1]}`
}

// Beep corto con Web Audio API — sin archivo de audio.
function playBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = 800
    gain.gain.value = 0.15
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
    osc.onended = () => ctx.close()
  } catch {
    // Audio no disponible (autoplay bloqueado, etc.) — silenciar sin romper.
  }
}

export default function AlertasBell() {
  const [data, setData] = useState<AlertasData>(EMPTY)
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const lastTotalRef = useRef<number | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch inicial + polling cada 15 min ──
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch("/api/alertas")
        if (!res.ok) return
        const json = (await res.json()) as AlertasData
        if (cancelled) return

        // Comparar contra el último total visto para disparar toast + sonido.
        if (lastTotalRef.current !== null && json.total > lastTotalRef.current) {
          const nuevas = json.total - lastTotalRef.current
          setToast(`Tenés ${nuevas} alerta${nuevas !== 1 ? "s" : ""} nueva${nuevas !== 1 ? "s" : ""}`)
          playBeep()
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
          toastTimerRef.current = setTimeout(() => setToast(null), 4000)
        }
        lastTotalRef.current = json.total
        setData(json)
      } catch {
        // Silenciar errores de red — reintentará en el próximo intervalo.
      }
    }

    load()
    const interval = setInterval(load, 15 * 60 * 1000)

    return () => {
      cancelled = true
      clearInterval(interval)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  // ── Cerrar el dropdown con click afuera (mismo patrón que el Sidebar) ──
  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  const { total, categorias } = data

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      {/* Botón campana */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Alertas"
        className="relative flex items-center justify-center rounded-lg transition-colors duration-150"
        style={{
          width: "34px", height: "34px",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: total > 0 ? "#fbbf24" : "var(--crm-text-muted)",
          cursor: "pointer",
        }}
      >
        <Bell size={16} />
        {total > 0 && (
          <span
            className="absolute flex items-center justify-center font-bold"
            style={{
              top: "-5px", right: "-5px",
              minWidth: "17px", height: "17px",
              padding: "0 4px",
              borderRadius: "9px",
              fontSize: "9.5px",
              background: "#E31837",
              color: "#fff",
              border: "1.5px solid var(--crm-sidebar, #13131a)",
            }}
          >
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {/* Toast breve */}
      {toast && (
        <div
          style={{
            position: "absolute", top: "42px", right: 0,
            background: "rgba(227,24,55,0.95)", color: "#fff",
            padding: "8px 14px", borderRadius: "8px",
            fontSize: "12.5px", fontWeight: 600, whiteSpace: "nowrap",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)", zIndex: 60,
          }}
        >
          🔔 {toast}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute", top: "42px", right: 0,
            width: "320px", maxHeight: "70vh", overflowY: "auto",
            background: "var(--crm-surface, #13131a)",
            border: "1px solid var(--crm-divider, rgba(255,255,255,0.1))",
            borderRadius: "12px",
            boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
            padding: "12px",
            zIndex: 60,
          }}
        >
          {total === 0 ? (
            <p style={{ textAlign: "center", padding: "20px 0", fontSize: "13px", color: "rgba(255,255,255,0.4)", margin: 0 }}>
              Sin alertas
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

              {/* Ofertas */}
              {categorias.ofertas.count > 0 && (
                <div>
                  <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>
                    Ofertas sin actividad ({categorias.ofertas.count})
                  </p>
                  {categorias.ofertas.items.map(item => (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      style={{ display: "block", padding: "8px 10px", borderRadius: "6px", fontSize: "12.5px", color: "var(--crm-text)", textDecoration: "none" }}
                      className="hover:bg-white/[0.06]"
                    >
                      <span style={{ fontWeight: 700 }}>#{item.numero}</span> — {item.direccion} · <span style={{ color: "#fbbf24" }}>hace {item.dias} días</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Cartelería */}
              {categorias.carteleria.count > 0 && (
                <div>
                  <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>
                    Cartelería vencida/próxima ({categorias.carteleria.count})
                  </p>
                  {categorias.carteleria.items.map(item => (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      style={{ display: "block", padding: "8px 10px", borderRadius: "6px", fontSize: "12.5px", color: "var(--crm-text)", textDecoration: "none" }}
                      className="hover:bg-white/[0.06]"
                    >
                      <span style={{ fontWeight: 700 }}>#{item.numero}</span> — {item.direccion} · {" "}
                      <span style={{ color: item.diasRestantes < 0 ? "#ef4444" : "#f59e0b" }}>
                        {item.diasRestantes < 0
                          ? `vencido hace ${Math.abs(item.diasRestantes)}d`
                          : item.diasRestantes === 0 ? "vence hoy" : `vence en ${item.diasRestantes}d`}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Mainstreet */}
              {categorias.mainstreet.count > 0 && (
                <div>
                  <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>
                    Mainstreet próximo ({categorias.mainstreet.count})
                  </p>
                  {categorias.mainstreet.items.map((item, i) => (
                    <Link
                      key={`${item.nombre}-${i}`}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      style={{ display: "block", padding: "8px 10px", borderRadius: "6px", fontSize: "12.5px", color: "var(--crm-text)", textDecoration: "none" }}
                      className="hover:bg-white/[0.06]"
                    >
                      <span style={{ fontWeight: 700 }}>{item.nombre}</span> · {fmtFechaCorta(item.fecha)} · {" "}
                      <span style={{ color: "#60a5fa" }}>
                        {item.diasFaltan === 0 ? "hoy" : `en ${item.diasFaltan}d`}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  )
}
