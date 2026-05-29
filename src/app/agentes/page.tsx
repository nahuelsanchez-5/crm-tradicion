import { createServerClient } from "@/lib/supabase"
import AgentesClient from "./AgentesClient"

const MES  = 5
const ANIO = 2026

export default async function AgentesPage() {
  const supabase = createServerClient()

  // Fetch agentes y planes del mes actual en paralelo
  const [{ data: agentes }, { data: planes }] = await Promise.all([
    supabase
      .from("agentes")
      .select("id, nombre, email, telefono, fecha_alta, fecha_baja, activo, paga_fee")
      .order("nombre"),

    supabase
      .from("planes_crm")
      .select("agente_id, tipo_plan, pagado")
      .eq("mes", MES)
      .eq("anio", ANIO),
  ])

  // Merge: agregar plan del mes a cada agente
  const agentesConPlan = (agentes ?? []).map(a => ({
    ...a,
    plan: (planes ?? []).find(p => p.agente_id === a.id) ?? null,
  }))

  return (
    <AgentesClient
      agentes={agentesConPlan}
      mes={MES}
      anio={ANIO}
    />
  )
}
