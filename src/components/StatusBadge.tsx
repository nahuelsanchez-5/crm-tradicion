const STATE_CLASSES: Record<string, string> = {
  // Estados de pago
  Pagado:            "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  Parcial:           "bg-amber-500/15 text-amber-400 border-amber-500/25",
  Pendiente:         "bg-rose-500/15 text-rose-400 border-rose-500/25",
  "Sin movimientos": "bg-white/[0.08] text-white/50 border-white/15",
  // Planes
  "PRO+":            "bg-violet-500/15 text-violet-400 border-violet-500/25",
  PRO:               "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  STARTER:           "bg-sky-500/15 text-sky-400 border-sky-500/25",
  "Sin licencia":    "bg-white/[0.08] text-white/50 border-white/15",
  B_QR:              "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  B_OFI:             "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  // Estados de oferta
  "Espera rta. vendedor":   "bg-blue-500/15 text-blue-400 border-blue-500/25",
  "Espera rta. comprador":  "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  "Aceptadas / Pre cierre": "bg-orange-500/15 text-orange-400 border-orange-500/25",
  Cerradas:                 "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  Caídas:                   "bg-white/[0.08] text-white/50 border-white/15",
}

export default function StatusBadge({ estado, large }: { estado: string; large?: boolean }) {
  const cls = STATE_CLASSES[estado] ?? "bg-white/[0.08] text-white/50 border-white/15"
  return (
    <span className={`inline-flex items-center rounded-full border font-bold whitespace-nowrap ${large ? "px-3.5 py-1 text-crm-md" : "px-2.5 py-0.5 text-crm-xs"} ${cls}`}>
      {estado}
    </span>
  )
}
