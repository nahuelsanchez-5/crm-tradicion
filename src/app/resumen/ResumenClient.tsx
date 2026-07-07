"use client"

import { useRouter, usePathname } from "next/navigation"
import { Printer } from "lucide-react"

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
  mes:           string
  kpis:          KpiRow[]
  totalACobrar:  number
  selectedMonth: number
  selectedYear:  number
}

export default function ResumenClient({ mes, kpis, totalACobrar, selectedMonth, selectedYear }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 2022 }, (_, i) => 2023 + i)

  const navigate = (m: number, y: number) => {
    router.push(`${pathname}?mes=${m}&anio=${y}`)
  }

  const totalColor =
    totalACobrar >= 300 ? "#059669"
    : totalACobrar >= 150 ? "#D97706"
    : "#E11D48"

  const totalBg =
    totalACobrar >= 300 ? "rgba(74,222,128,0.12)"
    : totalACobrar >= 150 ? "rgba(251,191,36,0.12)"
    : "rgba(248,113,113,0.12)"

  return (
    <div id="resumen-root" style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Header */}
      <div className="crm-page-header flex-shrink-0" style={{ flexWrap: "wrap", gap: "12px" }}>
        {/* Title */}
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.3px", margin: 0 }}>
            Resumen mensual
          </h1>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, marginTop: "1px" }}>
            {mes} · Indicadores de gestión y bonos a cobrar
          </p>
        </div>

        {/* Controls: month selector + print button */}
        <div className="print-hide" style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
          <select
            value={selectedMonth}
            onChange={e => navigate(parseInt(e.target.value), selectedYear)}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "8px", color: "#f1f5f9", padding: "6px 10px",
              fontSize: "13px", fontWeight: 600, cursor: "pointer", outline: "none",
            }}
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>{name}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={e => navigate(selectedMonth, parseInt(e.target.value))}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "8px", color: "#f1f5f9", padding: "6px 10px",
              fontSize: "13px", fontWeight: 600, cursor: "pointer", outline: "none",
            }}
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <button
            onClick={() => window.print()}
            title="Imprimir resumen"
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "8px", color: "#f1f5f9", padding: "6px 12px",
              fontSize: "13px", fontWeight: 600, cursor: "pointer",
            }}
          >
            <Printer size={14} />
            Imprimir
          </button>
        </div>

        {/* Total badge */}
        <div className="kpi-badge-total" style={{
          padding: "8px 20px", borderRadius: "10px",
          background: totalBg, border: `1px solid ${totalColor}40`,
        }}>
          <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, color: totalColor, textTransform: "uppercase", letterSpacing: "0.7px" }}>Total a cobrar</p>
          <p style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: totalColor, lineHeight: 1.2 }}>
            USD {totalACobrar}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
        <div style={{ background: "#13131a", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px 20px", background: "transparent", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E31837" }} />
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9" }}>Indicadores clave del mes</span>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["KPI", "Objetivo", "Cumplido", "A cobrar"].map(h => (
                    <th key={h} style={{
                      padding: "10px 20px", textAlign: "left",
                      fontSize: "10.5px", fontWeight: 700,
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.8px", color: "rgba(255,255,255,0.35)",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kpis.map((kpi, i) => (
                  <tr key={kpi.label} style={{ borderBottom: i < kpis.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                    <td style={{ padding: "16px 20px", fontWeight: 700, fontSize: "14px", color: "#f1f5f9" }}>
                      {kpi.label}
                    </td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", color: "rgba(255,255,255,0.45)" }}>
                      {kpi.objetivo}
                    </td>
                    <td style={{ padding: "16px 20px", fontSize: "13px", fontWeight: 600, color: "#f1f5f9" }}>
                      {kpi.cumplido}
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <span className={kpi.aCobrar > 0 ? "kpi-badge-pos" : "kpi-badge-neg"} style={{
                        display: "inline-flex", alignItems: "center",
                        padding: "5px 14px", borderRadius: "20px",
                        fontSize: "13px", fontWeight: 800,
                        background: kpi.aCobrar > 0 ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
                        color:      kpi.aCobrar > 0 ? "#4ade80" : "#f87171",
                      }}>
                        USD {kpi.aCobrar}
                      </span>
                    </td>
                  </tr>
                ))}
                {/* Total row */}
                <tr style={{ background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <td colSpan={3} style={{
                    padding: "16px 20px", fontWeight: 800,
                    fontSize: "14px", color: "#f1f5f9", textAlign: "right",
                  }}>
                    Total a cobrar
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <span className="kpi-badge-total" style={{
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
          <div className="md:hidden divide-y divide-white/[0.06]">
            {kpis.map(kpi => (
              <div key={kpi.label} style={{ padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <span style={{ fontWeight: 700, fontSize: "14px", color: "#f1f5f9" }}>{kpi.label}</span>
                  <span className={kpi.aCobrar > 0 ? "kpi-badge-pos" : "kpi-badge-neg"} style={{
                    padding: "4px 12px", borderRadius: "20px",
                    fontSize: "12px", fontWeight: 800,
                    background: kpi.aCobrar > 0 ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
                    color:      kpi.aCobrar > 0 ? "#4ade80" : "#f87171",
                  }}>
                    USD {kpi.aCobrar}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", marginBottom: "4px" }}>
                  Objetivo: {kpi.objetivo}
                </div>
                <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#f1f5f9" }}>
                  {kpi.cumplido}
                </div>
              </div>
            ))}
            <div style={{ padding: "16px", background: "rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 800, fontSize: "14px", color: "#f1f5f9" }}>Total a cobrar</span>
              <span className="kpi-badge-total" style={{
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
          background: "#13131a", borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.07)", fontSize: "12px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6,
        }}>
          <strong style={{ color: "#f1f5f9" }}>Criterio de bono:</strong>{" "}
          Cobros, Cartelería y Encuestas: USD 100 si se alcanza el objetivo, USD 0 si no.
          Facturación: proporcional al porcentaje alcanzado (máx. USD 100).
        </div>
      </div>
    </div>
  )
}
