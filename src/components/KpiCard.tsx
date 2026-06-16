"use client"

import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"

interface KpiCardProps {
  title: string
  value: string | number
  badge?: string
  /** Icon background color class e.g. "bg-rose-500/15" */
  iconBg: string
  /** Icon text color class e.g. "text-rose-400" */
  iconColor: string
  icon: ReactNode
  trend?: string
  trendUp?: boolean
  /** Animate numeric value counting up from 0 on mount */
  animate?: boolean
  /** Adds red top border accent (for primary KPI) */
  primary?: boolean
}

function useCountUp(target: number, duration: number) {
  const [count, setCount] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (duration <= 0) { setCount(target); return }
    const start = performance.now()
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setCount(Math.round(ease * target))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return count
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
  animate,
  primary,
}: KpiCardProps) {
  const shouldAnimate = animate === true && typeof value === "number"
  const count = useCountUp(
    shouldAnimate ? (value as number) : 0,
    shouldAnimate ? 1200 : 0,
  )
  const displayValue = shouldAnimate ? count : value

  return (
    <div className={`crm-kpi-card${primary ? " crm-kpi-card--primary" : ""}`}>
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg} ${iconColor}`}>
          {icon}
        </div>
        {badge && <span className="crm-kpi-badge">{badge}</span>}
      </div>

      {/* Bottom */}
      <div>
        <p className="crm-kpi-title">{title}</p>
        <p className="crm-kpi-value">{displayValue}</p>
        {trend && (
          <p className={`text-[11px] font-medium mt-1.5 ${trendUp ? "text-emerald-400" : "text-white/35"}`}>
            {trend}
          </p>
        )}
      </div>
    </div>
  )
}
