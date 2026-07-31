"use client"
import { useEffect } from "react"
import type { ReactNode, CSSProperties } from "react"
import { X } from "lucide-react"

export function Backdrop({
  onClose, children, className = "crm-modal", style,
}: {
  onClose: () => void
  children: ReactNode
  /** Clase del contenedor interno (por defecto "crm-modal"). El contenido queda como
   *  hijo directo del backdrop flex, sin wrapper extra, para no romper w-full/max-width. */
  className?: string
  style?: CSSProperties
}) {
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [onClose])

  return (
    <div onClick={onClose} className="crm-modal-backdrop">
      <div onClick={e => e.stopPropagation()} className={className} style={style}>
        {children}
      </div>
    </div>
  )
}

export function ModalHeader({
  title, subtitle, onClose, icon, iconBg,
}: {
  title: string; subtitle?: string; onClose: () => void; icon?: ReactNode; iconBg?: string
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {icon && (
          <div className={`${iconBg ?? "bg-slate-50"} rounded-xl p-2.5 flex-shrink-0`}>
            {icon}
          </div>
        )}
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: 800, color: "var(--crm-text)", margin: 0 }}>{title}</h2>
          {subtitle && <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, marginTop: "2px" }}>{subtitle}</p>}
        </div>
      </div>
      <button onClick={onClose} style={{
        background: "rgba(255,255,255,0.04)", border: "none", borderRadius: "8px",
        width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", color: "rgba(255,255,255,0.45)", flexShrink: 0,
      }}>
        <X size={16} />
      </button>
    </div>
  )
}
