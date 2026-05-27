import PageHeader from "@/components/PageHeader"
import { Building2 } from "lucide-react"

export default function OperacionesPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PageHeader title="Operaciones" description="Registro de ventas y alquileres del equipo" />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#94A3B8" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
            <Building2 size={40} strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#64748B", marginBottom: "4px" }}>
            Módulo Operaciones
          </div>
          <div style={{ fontSize: "13px" }}>En construcción 🚧</div>
        </div>
      </div>
    </div>
  )
}
