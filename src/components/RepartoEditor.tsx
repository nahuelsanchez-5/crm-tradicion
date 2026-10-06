"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { fmtUSD } from "@/lib/format"
import {
  armarFilasValidadas,
  facturacionPorAgente,
  type Punta,
  type RefExterno,
  type RefInterno,
  type RepartoData,
} from "@/lib/reparto"

interface AgenteOpt { id: string; nombre: string }

interface Props {
  comisionBruta: number
  agentes: AgenteOpt[]
  value: RepartoData
  onChange: (v: RepartoData) => void
  /** En el cierre las puntas vienen fijas (3% por agente interno); en una operación ya cargada se editan. */
  puntasEditables: boolean
}

const ROL_LABEL = { vendedor: "Vendedor", comprador: "Comprador" } as const

// Campo numérico que acepta "25,5" y deja escribir "25." sin pisar lo tipeado
function NumInput({ value, onChange, label, width = 110 }: { value: number; onChange: (n: number) => void; label: string; width?: number }) {
  const [txt, setTxt] = useState(String(value))
  useEffect(() => { if (parseFloat(txt.replace(",", ".")) !== value) setTxt(String(value)) }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input
      type="text" inputMode="decimal" aria-label={label} value={txt} className="crm-input"
      style={{ width, minHeight: 36, padding: "6px 10px" }}
      onChange={(e) => {
        setTxt(e.target.value)
        const n = parseFloat(e.target.value.replace(",", "."))
        onChange(Number.isFinite(n) ? n : 0)
      }}
    />
  )
}

const chip: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8,
  border: "1px dashed rgba(255,255,255,0.22)", background: "transparent",
  fontSize: 12, fontWeight: 600, color: "var(--crm-text-2)", cursor: "pointer", fontFamily: "inherit",
}
const iconBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 7, border: "1px solid rgba(248,113,113,0.2)",
  background: "rgba(248,113,113,0.08)", color: "#f87171", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
}
const seccion: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--crm-text-muted)", margin: "14px 0 6px" }

export default function RepartoEditor({ comisionBruta, agentes, value, onChange, puntasEditables }: Props) {
  const { puntas, refInt, refExt } = value
  const nombre = (id: string) => agentes.find((a) => a.id === id)?.nombre ?? "—"
  const set = (parcial: Partial<RepartoData>) => onChange({ ...value, ...parcial })

  const setPunta = (i: number, p: Partial<Punta>) => set({ puntas: puntas.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  const setRefInt = (i: number, r: Partial<RefInterno>) => set({ refInt: refInt.map((x, j) => (j === i ? { ...x, ...r } : x)) })
  const setRefExt = (i: number, r: Partial<RefExterno>) => set({ refExt: refExt.map((x, j) => (j === i ? { ...x, ...r } : x)) })

  // Cálculo en vivo con la misma regla que valida el servidor
  const { filas, error } = armarFilasValidadas(comisionBruta, value)
  const porAgente = filas ? Object.entries(facturacionPorAgente(filas)) : []
  const mismoAgenteEnDosPuntas = puntas.length === 2 && puntas[0].agenteId && puntas[0].agenteId === puntas[1].agenteId

  return (
    <div style={{ border: "1px solid var(--crm-card-border)", borderRadius: 12, padding: 14, background: "rgba(255,255,255,0.03)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 13, color: "var(--crm-text)" }}>Reparto de la comisión</strong>
        <span style={{ fontSize: 12, color: "var(--crm-text-muted)" }}>Bruto de la oficina: <b style={{ color: "var(--crm-text)" }}>{fmtUSD(comisionBruta)}</b></span>
      </div>

      {/* Puntas */}
      <div style={seccion}>Puntas</div>
      {puntas.map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ width: 82, fontSize: 12, fontWeight: 600, color: "var(--crm-text-2)" }}>{ROL_LABEL[p.rol]}</span>
          {puntasEditables ? (
            <select aria-label={`Agente ${ROL_LABEL[p.rol]}`} className="crm-input" style={{ flex: 1, minWidth: 140, minHeight: 36, padding: "6px 10px" }}
              value={p.agenteId} onChange={(e) => setPunta(i, { agenteId: e.target.value })}>
              <option value="">Elegir agente…</option>
              {agentes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          ) : (
            <span style={{ flex: 1, minWidth: 140, fontSize: 13, color: "var(--crm-text)" }}>{nombre(p.agenteId)}</span>
          )}
          {puntasEditables ? (
            <NumInput label={`Monto de la punta ${ROL_LABEL[p.rol]}`} value={p.base} onChange={(n) => setPunta(i, { base: n })} />
          ) : (
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--crm-text)", minWidth: 110, textAlign: "right" }}>{fmtUSD(p.base)}</span>
          )}
          {puntasEditables && puntas.length > 1 && (
            <button type="button" aria-label="Quitar punta" style={iconBtn}
              onClick={() => set({ puntas: puntas.filter((_, j) => j !== i), refInt: refInt.filter((r) => r.dePunta !== i).map((r) => ({ ...r, dePunta: r.dePunta > i ? r.dePunta - 1 : r.dePunta })) })}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}
      {puntasEditables && puntas.length < 2 && (
        <button type="button" style={chip}
          onClick={() => set({ puntas: [...puntas, { rol: puntas[0]?.rol === "vendedor" ? "comprador" : "vendedor", agenteId: "", base: 0 }] })}>
          <Plus size={12} /> Agregar otra punta
        </button>
      )}
      {mismoAgenteEnDosPuntas && (
        <p style={{ fontSize: 11.5, color: "var(--crm-text-muted)", margin: "6px 0 0" }}>El mismo agente tiene las dos puntas.</p>
      )}

      {/* Referidos internos */}
      <div style={seccion}>Referido entre agentes</div>
      {refInt.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
          <select aria-label="Agente que refirió" className="crm-input" style={{ flex: 1, minWidth: 130, minHeight: 36, padding: "6px 10px" }}
            value={r.agenteId} onChange={(e) => setRefInt(i, { agenteId: e.target.value })}>
            <option value="">Quién refirió…</option>
            {agentes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
          <span style={{ fontSize: 12, color: "var(--crm-text-muted)" }}>cobra</span>
          <NumInput label="Porcentaje del referido" width={64} value={r.porcentaje} onChange={(n) => setRefInt(i, { porcentaje: n })} />
          <span style={{ fontSize: 12, color: "var(--crm-text-muted)" }}>% de la punta de</span>
          <select aria-label="Punta de la que se descuenta" className="crm-input" style={{ flex: 1, minWidth: 130, minHeight: 36, padding: "6px 10px" }}
            value={r.dePunta} onChange={(e) => setRefInt(i, { dePunta: Number(e.target.value) })}>
            {puntas.map((p, j) => <option key={j} value={j}>{nombre(p.agenteId)} ({ROL_LABEL[p.rol].toLowerCase()})</option>)}
          </select>
          <button type="button" aria-label="Quitar referido" style={iconBtn} onClick={() => set({ refInt: refInt.filter((_, j) => j !== i) })}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button type="button" style={chip} disabled={puntas.length === 0}
        onClick={() => set({ refInt: [...refInt, { agenteId: "", porcentaje: 25, dePunta: Math.max(0, puntas.length - 1) }] })}>
        <Plus size={12} /> Agregar referido (un agente le refirió al otro)
      </button>

      {/* Referido externo */}
      <div style={seccion}>Referido de otra oficina <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>(solo informativo, no cambia la facturación)</span></div>
      {refExt.map((e, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
          <input aria-label="Oficina o persona del referido externo" className="crm-input" placeholder="Ej: RE/MAX Buenos Aires"
            style={{ flex: 1, minWidth: 150, minHeight: 36, padding: "6px 10px" }} value={e.nombre}
            onChange={(ev) => setRefExt(i, { nombre: ev.target.value })} maxLength={120} />
          <span style={{ fontSize: 12, color: "var(--crm-text-muted)" }}>USD</span>
          <NumInput label="Monto del referido externo" value={e.monto} onChange={(n) => setRefExt(i, { monto: n })} />
          <button type="button" aria-label="Quitar referido externo" style={iconBtn} onClick={() => set({ refExt: refExt.filter((_, j) => j !== i) })}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button type="button" style={chip} onClick={() => set({ refExt: [...refExt, { nombre: "", monto: 0 }] })}>
        <Plus size={12} /> Anotar referido de otra oficina
      </button>

      {/* Resultado */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--crm-divider)" }}>
        {error ? (
          <p role="alert" style={{ fontSize: 12.5, color: "var(--crm-accent-light)", margin: 0 }}>⚠️ {error}</p>
        ) : (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--crm-text-muted)", marginBottom: 6 }}>Cada agente factura</div>
            {porAgente.map(([id, monto]) => (
              <div key={id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                <span style={{ color: "var(--crm-text)" }}>{nombre(id)}</span>
                <b style={{ color: "var(--crm-text)" }}>{fmtUSD(monto)}</b>
              </div>
            ))}
            <p style={{ fontSize: 11.5, color: "#4ade80", margin: "8px 0 0" }}>✓ Suma exactamente el bruto de la oficina</p>
          </>
        )}
      </div>
    </div>
  )
}
