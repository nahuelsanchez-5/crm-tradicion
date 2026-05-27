import PageHeader from "@/components/PageHeader"
import { ClipboardList } from "lucide-react"

export default function EncuestasPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PageHeader title="Encuestas" description="Seguimiento de encuestas de satisfacción enviadas" />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#94A3B8" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
            <ClipboardList size={40} strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#64748B", marginBottom: "4px" }}>
            Módulo Encuestas
          </div>
          <div style={{ fontSize: "13px" }}>En construcción 🚧</div>
        </div>
      </div>
    </div>
  )
}
