"use client"
import Image from "next/image"
import DashboardClock from "@/app/DashboardClock"

interface Props {
  moduleName: string
}

export default function Topbar({ moduleName }: Props) {
  return (
    <div
      className="flex items-center flex-shrink-0"
      style={{ minHeight: "62px", padding: "0 24px 0 64px", background: "rgba(10,10,26,0.8)", borderBottom: "1px solid var(--crm-divider)", backdropFilter: "blur(8px)" }}
    >
      <div className="hidden md:block flex-1">
        <DashboardClock />
      </div>
      <div className="flex-1 md:flex-none flex justify-center md:justify-start">
        <Image
          src="/logo-crema.png" alt="REMAX Tradición"
          width={200} height={22}
          priority
          className="md:w-[240px] md:h-[27px]"
        />
      </div>
      <div className="flex-1 flex justify-end">
        <div
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] md:text-[12.5px] font-semibold"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--crm-text)" }}
        >
          <span style={{ color: "var(--crm-text-muted)" }}>📍</span>
          <span>{moduleName}</span>
        </div>
      </div>
    </div>
  )
}
