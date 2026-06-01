"use client"

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
  FileText,
  Settings,
  Handshake,
  LucideIcon,
} from "lucide-react"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  badge?: string
  badgeVariant?: "red" | "blue"
  group: "inicio" | "modulos"
}

const NAV_ITEMS: NavItem[] = [
  { href: "/",            label: "Dashboard",    icon: LayoutDashboard, group: "inicio" },
  { href: "/agentes",     label: "Agentes",      icon: Users,           badge: "12", badgeVariant: "blue", group: "inicio" },
  { href: "/pagos",       label: "Pagos",        icon: CreditCard,      badge: "3",  badgeVariant: "red",  group: "inicio" },
  { href: "/carteleria",  label: "Cartelería",   icon: MapPin,          group: "modulos" },
  { href: "/encuestas",   label: "Encuestas",    icon: ClipboardList,   group: "modulos" },
  { href: "/operaciones", label: "Operaciones",  icon: Building2,       group: "modulos" },
  { href: "/ofertas",     label: "Ofertas",      icon: Handshake,       group: "modulos" },
  { href: "/facturacion",    label: "Facturación",  icon: FileText,  group: "modulos" },
  { href: "/configuracion", label: "Configuración", icon: Settings,  group: "modulos" },
]

export default function Sidebar() {
  const pathname = usePathname()
  const inicio  = NAV_ITEMS.filter(i => i.group === "inicio")
  const modulos = NAV_ITEMS.filter(i => i.group === "modulos")

  return (
    <aside
      style={{
        width: "224px",
        minWidth: "224px",
        background: "#0F172A",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        flexShrink: 0,
      }}
    >
      {/* ── Logo ─────────────────────────────────── */}
      <div
        style={{
          padding: "20px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Image
          src="/logo-sidebar-crema.png"
          alt="REMAX Tradición"
          width={160}
          height={60}
          style={{ objectFit: "contain", maxWidth: "160px" }}
          priority
        />
      </div>

      {/* ── Navigation ───────────────────────────── */}
      <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
        <NavGroup label="Inicio" items={inicio} pathname={pathname} />
        <NavGroup label="Módulos" items={modulos} pathname={pathname} />
      </nav>

      {/* ── User footer ──────────────────────────── */}
      <div
        style={{
          padding: "14px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "9px",
            padding: "8px",
            borderRadius: "10px",
            cursor: "pointer",
          }}
          className="hover:bg-white/[0.05]"
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "9px",
              background: "linear-gradient(135deg, #7C3AED, #5b21b6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 700,
              color: "white",
              flexShrink: 0,
            }}
          >
            A
          </div>
          <div>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "rgba(255,255,255,0.8)",
              }}
            >
              Administrador
            </div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>
              Broker Asociado
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string
  items: NavItem[]
  pathname: string
}) {
  return (
    <div style={{ marginBottom: "6px" }}>
      <div
        style={{
          fontSize: "9.5px",
          fontWeight: 700,
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.25)",
          padding: "10px 8px 5px",
        }}
      >
        {label}
      </div>
      {items.map(item => (
        <NavItemLink key={item.href} item={item} isActive={pathname === item.href} />
      ))}
    </div>
  )
}

function NavItemLink({
  item,
  isActive,
}: {
  item: NavItem
  isActive: boolean
}) {
  return (
    <Link
      href={item.href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "9px",
        padding: "8px 10px",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: isActive ? 600 : 500,
        color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.45)",
        background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
        textDecoration: "none",
        marginBottom: "1px",
        transition: "all 0.15s",
      }}
      className={!isActive ? "hover:bg-white/[0.06] hover:!text-white/75" : ""}
    >
      <item.icon size={15} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.badge && (
        <span
          style={{
            width: "18px",
            height: "18px",
            borderRadius: "6px",
            fontSize: "9px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              item.badgeVariant === "red"
                ? "rgba(227,24,55,0.25)"
                : "rgba(37,99,235,0.25)",
            color:
              item.badgeVariant === "red" ? "#FF6B7A" : "#93BBFD",
          }}
        >
          {item.badge}
        </span>
      )}
    </Link>
  )
}
