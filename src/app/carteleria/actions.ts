"use server"

import { revalidatePath } from "next/cache"
import { requireSession } from "@/lib/auth-guard"
import { hoyArgentina } from "@/lib/fecha"
import { esStringNoVacio, esFechaValida, esEnteroPositivo } from "@/lib/validate"

// Validación compartida por crear/editar cartel.
function validarCartel(data: CartelFormData): string | null {
  if (!esEnteroPositivo(data.numero))    return "Número de cartel inválido"
  if (!esStringNoVacio(data.direccion))  return "La dirección no puede estar vacía"
  if (!esStringNoVacio(data.mlsId))      return "El MLS ID no puede estar vacío"
  if (!esFechaValida(data.vencimiento))  return "Fecha de vencimiento inválida"
  if (!esStringNoVacio(data.tipo))       return "El tipo no puede estar vacío"
  if (!esStringNoVacio(data.agente))     return "El agente no puede estar vacío"
  return null
}

// ── Field IDs ─────────────────────────────────────────
// fldClqD1zmj0AYlBn = Días restantes → fórmula, solo lectura, NO se envía en writes
const F = {
  numero:      "fldsAoewlr0711e3s",
  direccion:   "fldjm8EB1HVvQeCSQ",
  mlsId:       "fldvdpI7rmmvu3cym",
  vencimiento: "fldnLaQjKRCD8vezt",
  tipo:        "fldEhBVzBXTCu5mQC",
  agente:      "fldyJFGEej2UzAUmp",
} as const

function apiUrl() {
  return `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_CARTELERIA_TABLE_ID}`
}

function authHeaders() {
  return {
    "Authorization": `Bearer ${process.env.AIRTABLE_TOKEN}`,
    "Content-Type": "application/json",
  }
}

function buildFields(data: CartelFormData) {
  return {
    [F.numero]:      data.numero,
    [F.direccion]:   data.direccion,
    [F.mlsId]:       data.mlsId,
    [F.vencimiento]: data.vencimiento,
    [F.tipo]:        data.tipo,
    [F.agente]:      data.agente,
  }
}

export interface CartelFormData {
  numero:      number
  direccion:   string
  mlsId:       string
  vencimiento: string   // YYYY-MM-DD
  tipo:        string   // nombre del singleSelect
  agente:      string   // nombre del singleSelect
}

export async function crearCartel(data: CartelFormData) {
  await requireSession()

  const err = validarCartel(data)
  if (err) return { error: err }

  const res = await fetch(apiUrl(), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ records: [{ fields: buildFields(data) }] }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg  = (body as { error?: { message?: string } }).error?.message
    return { error: msg ?? `Error Airtable ${res.status}` }
  }

  revalidatePath("/carteleria")
  return { success: true }
}

export async function devolverCartel(id: string) {
  await requireSession()

  if (!esStringNoVacio(id)) return { error: "ID de cartel inválido" }

  const today = hoyArgentina()
  const res = await fetch(apiUrl(), {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ records: [{ id, fields: { [F.vencimiento]: today } }] }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg  = (body as { error?: { message?: string } }).error?.message
    return { error: msg ?? `Error Airtable ${res.status}` }
  }

  revalidatePath("/carteleria")
  return { success: true }
}

export async function editarCartel(id: string, data: CartelFormData) {
  await requireSession()

  if (!esStringNoVacio(id)) return { error: "ID de cartel inválido" }
  const err = validarCartel(data)
  if (err) return { error: err }

  const res = await fetch(apiUrl(), {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ records: [{ id, fields: buildFields(data) }] }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg  = (body as { error?: { message?: string } }).error?.message
    return { error: msg ?? `Error Airtable ${res.status}` }
  }

  revalidatePath("/carteleria")
  return { success: true }
}
