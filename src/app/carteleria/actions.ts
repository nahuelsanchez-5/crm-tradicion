"use server"

import { revalidatePath } from "next/cache"

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

export async function editarCartel(id: string, data: CartelFormData) {
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
