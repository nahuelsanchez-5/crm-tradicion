import type { ReactNode } from "react"

interface KpiCardProps {
  title: string
  value: string | number
  badge?: string
  /** Icon background color class e.g. "bg-blue-50" */
  iconBg: string
  /** Icon text color class e.g. "text-blue-600" */
  iconColor: string
  icon: ReactNode
  trend?: string
  trendUp?: boolean
}

export default function KpiCard({
  title,
  value,
  badge,
  iconBg,
  iconColor,
  icon,
  trend,
  trendUp,
}: KpiCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow duration-200 min-h-[130px]">
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg} ${iconColor}`}>
          {icon}
        </div>
        {badge && (
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
            {badge}
          </span>
        )}
      </div>

      {/* Bottom */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
          {title}
        </p>
        <p className="text-3xl font-bold text-slate-900 leading-none tracking-tight">
          {value}
        </p>
        {trend && (
          <p className={`text-[11px] font-medium mt-1.5 ${trendUp ? "text-emerald-600" : "text-slate-400"}`}>
            {trend}
          </p>
        )}
      </div>
    </div>
  )
}
