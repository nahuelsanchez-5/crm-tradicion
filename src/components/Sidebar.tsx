"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  CreditCard,
  MapPin,
  ClipboardList,
  Building2,
  Settings,
  Handshake,
  Menu,
  X,
  LucideIcon,
} from "lucide-react"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  badge?: number | string
  badgeVariant?: "red" | "blue"
}

const BASE_NAV: NavItem[] = [
  { href: "/",            label: "Dashboard",   icon: LayoutDashboard },
  { href: "/ofertas",     label: "Ofertas",     icon: Handshake },
  { href: "/pagos",       label: "Cuentas",     icon: CreditCard },
  { href: "/carteleria",  label: "Cartelería",  icon: MapPin },
  { href: "/encuestas",   label: "Encuestas",   icon: ClipboardList },
  { href: "/agentes",     label: "Agentes",     icon: Users },
  { href: "/operaciones", label: "Operaciones", icon: Building2 },
]

const SYSTEM_NAV: NavItem[] = [
  { href: "/configuracion", label: "Configuración", icon: Settings },
]

interface Props {
  agenteCount: number
}

export default function Sidebar({ agenteCount }: Props) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = BASE_NAV.map(i =>
    i.href === "/agentes"
      ? { ...i, badge: agenteCount, badgeVariant: "blue" as const }
      : i
  )

  const sidebarContent = (onNavClick?: () => void) => (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800 flex justify-center">
        <Image
          src="/logo-sidebar-crema.png"
          alt="REMAX Tradición"
          width={150}
          height={56}
          style={{ objectFit: "contain", maxWidth: "150px", height: "auto" }}
          priority
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="text-[9.5px] font-bold tracking-[1.5px] uppercase text-white/25 px-2 pb-2 pt-1">
          Menú
        </p>
        {navItems.map(item => (
          <NavItemLink
            key={item.href}
            item={item}
            isActive={pathname === item.href}
            onNavClick={onNavClick}
          />
        ))}

        <div className="my-3 border-t border-slate-800" />
        <p className="text-[9.5px] font-bold tracking-[1.5px] uppercase text-white/25 px-2 pb-2">
          Sistema
        </p>
        {SYSTEM_NAV.map(item => (
          <NavItemLink
            key={item.href}
            item={item}
            isActive={pathname === item.href}
            onNavClick={onNavClick}
          />
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 pb-4 pt-2 border-t border-slate-800">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl cursor-pointer hover:bg-white/[0.05] transition-colors duration-150">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0">
            N
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-600 text-white/80 leading-none">Nahuel Sánchez</p>
            <p className="text-[10px] text-white/30 mt-0.5 uppercase tracking-wide">Staff</p>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3.5 left-3.5 z-50 w-10 h-10 rounded-xl bg-slate-900 border-none cursor-pointer flex items-center justify-center text-white shadow-lg"
        aria-label="Abrir menú"
      >
        <Menu size={18} />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className="md:hidden fixed top-0 left-0 bottom-0 w-[224px] bg-[#0F172A] flex flex-col z-45"
        style={{
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
        }}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3.5 right-3.5 bg-white/10 border-none rounded-lg w-8 h-8 flex items-center justify-center cursor-pointer text-white"
          aria-label="Cerrar menú"
        >
          <X size={16} />
        </button>
        {sidebarContent(() => setMobileOpen(false))}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[224px] min-w-[224px] bg-[#0F172A] flex-col h-full flex-shrink-0">
        {sidebarContent()}
      </aside>
    </>
  )
}

function NavItemLink({
  item,
  isActive,
  onNavClick,
}: {
  item: NavItem
  isActive: boolean
  onNavClick?: () => void
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavClick}
      className={[
        "flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13px] mb-0.5 transition-all duration-150 no-underline",
        isActive
          ? "bg-slate-800 text-white font-semibold border-l-2 border-blue-500 pl-[9px]"
          : "text-white/45 font-medium hover:bg-slate-800/50 hover:text-white/75",
      ].join(" ")}
    >
      <item.icon size={15} className="flex-shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge !== undefined && (
        <span
          className={[
            "min-w-[18px] h-[18px] rounded-md text-[9px] font-bold flex items-center justify-center px-1",
            item.badgeVariant === "red"
              ? "bg-red-500/25 text-red-300"
              : "bg-blue-500/25 text-blue-300",
          ].join(" ")}
        >
          {item.badge}
        </span>
      )}
    </Link>
  )
}
