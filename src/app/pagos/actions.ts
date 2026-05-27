"use server"

import { createServerClient } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

function calcularEstado(monto_debe: number, monto_pagado: number): string {
  if (monto_pagado <= 0)              return "Pendiente"
  if (monto_pagado >= monto_debe)     return "Pagado"
  return "Parcial"
}

// ─────────────────────────────────────────────────────
//  CREAR PAGO
// ─────────────────────────────────────────────────────
export async function crearPago(data: {
  agente_id: string
  fecha: string
  concepto: string
  monto_debe: number
  monto_pagado: number
}) {
  const supabase = createServerClient()

  const estado = calcularEstado(data.monto_debe, data.monto_pagado)

  const { error } = await supabase.from("pagos").insert({
    agente_id:    data.agente_id,
    fecha:        data.fecha,
    concepto:     data.concepto,
    monto_debe:   data.monto_debe,
    monto_pagado: data.monto_pagado,
    estado,
  })

  if (error) return { error: error.message }

  revalidatePath("/pagos")
  return { success: true }
}

// ─────────────────────────────────────────────────────
//  ACTUALIZAR PAGO PARCIAL
// ─────────────────────────────────────────────────────
export async function actualizarPago(
  id: string,
  data: { monto_pagado: number; estado: string }
) {
  const supabase = createServerClient()

  const { error } = await supabase
    .from("pagos")
    .update({ monto_pagado: data.monto_pagado, estado: data.estado })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/pagos")
  return { success: true }
}
