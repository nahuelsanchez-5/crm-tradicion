import PageHeader from "@/components/PageHeader"
import { CreditCard } from "lucide-react"

export default function PagosPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PageHeader title="Pagos" description="Control de planes CRM y deudas del equipo" />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#94A3B8" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
            <CreditCard size={40} strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#64748B", marginBottom: "4px" }}>
            Módulo Pagos
          </div>
          <div style={{ fontSize: "13px" }}>En construcción 🚧</div>
        </div>
      </div>
    </div>
  )
}
