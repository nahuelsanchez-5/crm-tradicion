import type { ReactNode } from "react"

interface KpiCardProps {
  title: string
  value: string | number
  badge?: string
  /** CSS gradient string, e.g. "linear-gradient(135deg, #E31837, #9B0F26)" */
  gradient: string
  /** Shadow color, e.g. "rgba(227,24,55,0.35)" */
  shadowColor: string
  icon: ReactNode
}

export default function KpiCard({
  title,
  value,
  badge,
  gradient,
  shadowColor,
  icon,
}: KpiCardProps) {
  return (
    <div
      style={{
        background: gradient,
        boxShadow: `0 8px 24px ${shadowColor}`,
        borderRadius: "16px",
        padding: "20px",
        color: "white",
        position: "relative",
        overflow: "hidden",
        minHeight: "130px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/* Decorative circle — top right */}
      <div
        style={{
          position: "absolute",
          top: "-20px",
          right: "-20px",
          width: "100px",
          height: "100px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          pointerEvents: "none",
        }}
      />
      {/* Decorative circle — bottom right */}
      <div
        style={{
          position: "absolute",
          bottom: "-30px",
          right: "-10px",
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.05)",
          pointerEvents: "none",
        }}
      />

      {/* Top row: icon + badge */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: "rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </div>
        {badge && (
          <div
            style={{
              background: "rgba(255,255,255,0.2)",
              backdropFilter: "blur(4px)",
              padding: "3px 9px",
              borderRadius: "20px",
              fontSize: "11px",
              fontWeight: 600,
            }}
          >
            {badge}
          </div>
        )}
      </div>

      {/* Bottom: label + value */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 500,
            opacity: 0.75,
            marginBottom: "4px",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: "32px",
            fontWeight: 800,
            letterSpacing: "-1px",
            lineHeight: 1,
          }}
        >
          {value}
        </div>
      </div>
    </div>
  )
}
