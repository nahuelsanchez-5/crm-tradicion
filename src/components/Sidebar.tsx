"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  CreditCard,
  MapPin,
  ClipboardList,
  Building2,
  Settings,
  Handshake,
  Receipt,
  BarChart3,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ChevronRight,
  LucideIcon,
} from "lucide-react"
import DolarWidget from "./DolarWidget"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  badge?: number | string
  badgeVariant?: "red" | "blue"
}

const BASE_NAV: NavItem[] = [
  { href: "/",            label: "Dashboard",   icon: LayoutDashboard },
  { href: "/calendario",  label: "Calendario",  icon: CalendarDays },
  { href: "/ofertas",     label: "Ofertas",     icon: Handshake },
  { href: "/pagos",       label: "Cuentas",     icon: CreditCard },
  { href: "/carteleria",  label: "Cartelería",  icon: MapPin },
  { href: "/encuestas",   label: "Encuestas",   icon: ClipboardList },
  { href: "/agentes",     label: "Agentes",     icon: Users },
  { href: "/operaciones", label: "Operaciones", icon: Building2 },
  { href: "/facturacion", label: "Facturación", icon: Receipt },
  { href: "/resumen",    label: "Resumen",     icon: BarChart3 },
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
  const [collapsed, setCollapsed] = useState(false)
  const [hovering, setHovering] = useState(false)
  const { data: session } = useSession()

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved === "true") setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    setCollapsed(prev => {
      localStorage.setItem("sidebar-collapsed", String(!prev))
      return !prev
    })
  }

  const userName = session?.user?.name ?? "Staff"
  const userInitial = userName.charAt(0).toUpperCase()

  // La pantalla de login no lleva navegación
  if (pathname === "/login") return null

  const navItems = BASE_NAV.map(i =>
    i.href === "/agentes"
      ? { ...i, badge: agenteCount, badgeVariant: "blue" as const }
      : i
  )

  const sidebarContent = (onNavClick?: () => void, applyCollapsed = false) => {
    const isCollapsed = applyCollapsed && collapsed && !hovering
    return (
    <>
      {/* Logo */}
      <div className="px-5 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--crm-divider)" }}>
        {!isCollapsed && (
          <Image
            src="/logo-sidebar-crema.png"
            alt="REMAX Tradición"
            width={130}
            height={55}
            priority
          />
        )}
        {applyCollapsed && (
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
            style={{
              background: "rgba(255,255,255,0.06)", border: "none", borderRadius: "8px",
              width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "rgba(255,255,255,0.5)", flexShrink: 0,
            }}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {!isCollapsed && (
          <p className="text-[9.5px] font-bold tracking-[1.5px] uppercase text-white/25 px-2 pb-2 pt-1">
            Menú
          </p>
        )}
        {navItems.map(item => (
          <NavItemLink
            key={item.href}
            item={item}
            isActive={pathname === item.href}
            onNavClick={onNavClick}
            collapsed={isCollapsed}
          />
        ))}

        <div className="my-3" style={{ borderTop: "1px solid var(--crm-divider)" }} />
        {!isCollapsed && (
          <p className="text-[9.5px] font-bold tracking-[1.5px] uppercase text-white/25 px-2 pb-2">
            Sistema
          </p>
        )}
        {SYSTEM_NAV.map(item => (
          <NavItemLink
            key={item.href}
            item={item}
            isActive={pathname === item.href}
            onNavClick={onNavClick}
            collapsed={isCollapsed}
          />
        ))}
      </nav>

      {/* Dolar widget */}
      {!isCollapsed && <DolarWidget />}

      {/* User footer */}
      {isCollapsed ? (
        <div className="px-2 pb-4 pt-2 flex flex-col items-center gap-2" style={{ borderTop: "1px solid var(--crm-divider)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-crm-sm font-bold text-white flex-shrink-0" style={{ background: "rgba(227,24,55,0.2)", border: "1px solid rgba(227,24,55,0.3)" }} title={userName}>
            {userInitial}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Cerrar sesión"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.07] transition-colors duration-150 border-none bg-transparent cursor-pointer"
          >
            <LogOut size={14} />
          </button>
        </div>
      ) : (
        <div className="px-3 pb-4 pt-2" style={{ borderTop: "1px solid var(--crm-divider)" }}>
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-crm-sm font-bold text-white flex-shrink-0" style={{ background: "rgba(227,24,55,0.2)", border: "1px solid rgba(227,24,55,0.3)" }}>
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-crm-sm font-600 text-white/80 leading-none truncate">{userName}</p>
              <p className="text-[10px] text-white/30 mt-0.5 uppercase tracking-wide">Staff</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Cerrar sesión"
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.07] transition-colors duration-150 border-none bg-transparent cursor-pointer"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      )}
    </>
    )
  }

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
        className="md:hidden fixed top-0 left-0 bottom-0 w-[224px] flex flex-col z-45"
        style={{
          background: "var(--crm-sidebar)",
          backdropFilter: "blur(16px)",
          borderRight: "1px solid var(--crm-divider)",
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
      {/* Spacer: reserva el espacio real en el layout, SIEMPRE 64px cuando está colapsado */}
      <div className={`hidden md:block ${collapsed ? "w-[64px] min-w-[64px]" : "w-[224px] min-w-[224px]"} flex-shrink-0`} />

      {/* Aside real: fixed cuando está colapsado, para no afectar el layout al desplegarse por hover */}
      <aside
        onMouseEnter={() => collapsed && setHovering(true)}
        onMouseLeave={() => {
          if (!collapsed) return
          setTimeout(() => setHovering(false), 2000)
        }}
        className="hidden md:flex flex-col h-full"
        style={{
          background: "var(--crm-sidebar)",
          backdropFilter: "blur(16px)",
          borderRight: "1px solid var(--crm-divider)",
          position: collapsed ? "fixed" : "static",
          top: 0,
          left: 0,
          bottom: 0,
          width: (collapsed && !hovering) ? "64px" : "224px",
          transform: (collapsed && !hovering) ? "translateX(0)" : "translateX(0)",
          transition: "width 320ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 320ms ease",
          boxShadow: (collapsed && hovering) ? "8px 0 24px rgba(0,0,0,0.35)" : "none",
          zIndex: collapsed ? 40 : "auto",
          willChange: "width",
        }}
      >
        {sidebarContent(undefined, true)}
      </aside>
    </>
  )
}

function NavItemLink({
  item,
  isActive,
  onNavClick,
  collapsed,
}: {
  item: NavItem
  isActive: boolean
  onNavClick?: () => void
  collapsed?: boolean
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavClick}
      title={collapsed ? item.label : undefined}
      className={[
        "flex items-center gap-2.5 px-2.5 py-3 md:py-2.5 rounded-lg text-crm-md mb-0.5 transition-all duration-150 no-underline min-h-[44px]",
        isActive
          ? "bg-[rgba(227,24,55,0.18)] text-[#ff8a9a] font-semibold border-l-[3px] border-[#E31837] pl-[8px] shadow-[inset_0_0_12px_rgba(227,24,55,0.08)]"
          : "text-white/45 font-medium hover:bg-white/[0.06] hover:text-white/75 hover:translate-x-0.5",
        collapsed ? "justify-center px-0" : "",
      ].join(" ")}
    >
      <item.icon size={15} className="flex-shrink-0" style={isActive ? { filter: "drop-shadow(0 0 4px rgba(227,24,55,0.5))" } : undefined} />
      <span
        className="flex-1"
        style={{
          opacity: collapsed ? 0 : 1,
          transition: "opacity 200ms ease",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {item.label}
      </span>
      {!collapsed && item.badge !== undefined && (
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
