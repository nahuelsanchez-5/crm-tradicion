import type { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  description?: string
  children?: ReactNode
}

export default function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between min-h-[62px] px-6 bg-white border-b border-slate-200 flex-shrink-0">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight m-0">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-slate-500 m-0 mt-0.5">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2.5">{children}</div>
      )}
    </div>
  )
}
