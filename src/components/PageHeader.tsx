import type { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  description?: string
  /** Slot for action buttons (right side) */
  children?: ReactNode
}

export default function PageHeader({
  title,
  description,
  children,
}: PageHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: "62px",
        padding: "0 24px",
        background: "white",
        borderBottom: "1px solid #EAECF2",
        flexShrink: 0,
      }}
    >
      <div>
        <h1
          style={{
            fontSize: "18px",
            fontWeight: 800,
            color: "#0F172A",
            letterSpacing: "-0.3px",
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            style={{
              fontSize: "12px",
              color: "#64748B",
              margin: 0,
              marginTop: "1px",
            }}
          >
            {description}
          </p>
        )}
      </div>

      {children && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {children}
        </div>
      )}
    </div>
  )
}
