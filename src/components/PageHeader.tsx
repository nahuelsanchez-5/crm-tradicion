import type { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  description?: string
  children?: ReactNode
}

export default function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="crm-page-header">
      <div>
        <h1 className="text-[18px] font-extrabold tracking-tight leading-tight m-0" style={{ color: "var(--crm-text)", letterSpacing: "-0.3px" }}>
          {title}
        </h1>
        {description && (
          <p className="text-crm-sm m-0 mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{description}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2.5">{children}</div>
      )}
    </div>
  )
}
