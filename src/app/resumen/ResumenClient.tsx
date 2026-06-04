"use client"

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]

export interface KpiRow {
  label:    string
  objetivo: string
  cumplido: string
  aCobrar:  number
}

interface Props {
  mes:          string
  kpis:         KpiRow[]
  totalACobrar: number
}

export default function ResumenClient({ mes, kpis, totalACobrar }: Props) {
  const totalColor =
    totalACobrar >= 300 ? "#059669"
    : totalACobrar >= 150 ? "#D97706"
    : "#E11D48"

  const totalBg =
    totalACobrar >= 300 ? "#ECFDF5"
    : totalACobrar >= 150 ? "#FFFBEB"
    : "#FFF1F2"

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Header */}
      <div className="crm-page-header flex-shrink-0">
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", letterSpacing: "-0.3px", margin: 0 }}>
            Resumen mensual
          </h1>
          <p style={{ fontSize: "12px", color: "#64748B", margin: 0, marginTop: "1px" }}>
            {mes} · Indicadores de gestión y bonos a cobrar
          </p>
        </div>
        <div style={{
          padding: "8px 20px", borderRadius: "10px",
          background: totalBg, border: `1.5px solid ${totalColor}33`,
        }}>
          <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, color: totalColor, textTransform: "uppercase", letterSpacing: "0.7px" }}>Total a cobrar</p>
          <p style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: totalColor, lineHeight: 1.2 }}>
            USD {totalACobrar}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
        <div style={{ background: "white", borderRadius: "14px", border: "1.5px solid #EAECF2", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px 20px", borderBottom: "1px solid #EAECF2" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E31837" }} />
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>Indicadores clave del mes</span>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8F9FC", borderBottom: "1px solid #EAECF2" }}>
                  {["KPI", "Objetivo", "Cumplido", "A cobrar"].map(h => (
                    <th key={h} style={{
                      padding: "10px 20px", textAlign: "left",
                      fontSize: "10.5px", fontWeight: 700,
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.8px", color: "#94A3B8",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kpis.map((kpi, i) => (
                  <tr key={kpi.label} style={{ borderBottom: i < kpis.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                    <td style={{ padding: "16px 20px", fontWeight: 700, fontSize: "14px", color: "#0F172A" }}>
                      {kpi.label}
                    </td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "#64748B" }}>
                      {kpi.objetivo}
                    </td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>
                      {kpi.cumplido}
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center",
                        padding: "5px 14px", borderRadius: "20px",
                        fontSize: "13px", fontWeight: 800,
                        background: kpi.aCobrar > 0 ? "#ECFDF5" : "#FFF1F2",
                        color:      kpi.aCobrar > 0 ? "#059669" : "#E11D48",
                      }}>
                        USD {kpi.aCobrar}
                      </span>
                    </td>
                  </tr>
                ))}
                {/* Total row */}
                <tr style={{ background: "#F8F9FC", borderTop: "2px solid #EAECF2" }}>
                  <td colSpan={3} style={{
                    padding: "16px 20px", fontWeight: 800,
                    fontSize: "14px", color: "#0F172A", textAlign: "right",
                  }}>
                    Total a cobrar
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center",
                      padding: "6px 18px", borderRadius: "20px",
                      fontSize: "15px", fontWeight: 800,
                      background: totalBg, color: totalColor,
                    }}>
                      USD {totalACobrar}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {kpis.map(kpi => (
              <div key={kpi.label} style={{ padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <span style={{ fontWeight: 700, fontSize: "14px", color: "#0F172A" }}>{kpi.label}</span>
                  <span style={{
                    padding: "4px 12px", borderRadius: "20px",
                    fontSize: "12px", fontWeight: 800,
                    background: kpi.aCobrar > 0 ? "#ECFDF5" : "#FFF1F2",
                    color:      kpi.aCobrar > 0 ? "#059669" : "#E11D48",
                  }}>
                    USD {kpi.aCobrar}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "4px" }}>
                  Objetivo: {kpi.objetivo}
                </div>
                <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#0F172A" }}>
                  {kpi.cumplido}
                </div>
              </div>
            ))}
            <div style={{ padding: "16px", background: "#F8F9FC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 800, fontSize: "14px", color: "#0F172A" }}>Total a cobrar</span>
              <span style={{
                padding: "6px 16px", borderRadius: "20px",
                fontSize: "15px", fontWeight: 800,
                background: totalBg, color: totalColor,
              }}>
                USD {totalACobrar}
              </span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div style={{
          marginTop: "16px", padding: "14px 18px",
          background: "white", borderRadius: "12px",
          border: "1.5px solid #EAECF2", fontSize: "12px", color: "#64748B", lineHeight: 1.6,
        }}>
          <strong style={{ color: "#0F172A" }}>Criterio de bono:</strong>{" "}
          Cobros, Cartelería y Encuestas: USD 100 si se alcanza el objetivo, USD 0 si no.
          Facturación: proporcional al porcentaje alcanzado (máx. USD 100).
        </div>
      </div>
    </div>
  )
}
