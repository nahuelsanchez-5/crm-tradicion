// Motor de flujos guiados del asistente: define qué dato se pregunta, en qué orden y cómo se
// valida cada respuesta. NO usa IA: Gemini solo detecta la intención y los datos que ya venían
// en la frase; el resto se pregunta de a uno (menos llamadas, sin datos inventados).
// Módulo puro (sin imports de servidor): lo usan la ruta /api/ai-assistant y el componente.

import { ESTADOS_OFERTA } from "./constantes"
import { esEnteroPositivo, esFechaValida, esMontoValido } from "./validate"

// ── Tipos ────────────────────────────────────────────────────────────────────
export type TipoCampo = "agente" | "opcion" | "monto" | "entero" | "texto" | "fecha" | "booleano"
export interface Opcion { value: string; label: string }

export interface Campo {
  key: string
  pregunta: string
  tipo: TipoCampo
  opciones?: readonly string[]       // para tipo "opcion" fijo
  opcionesDe?: "ofertas"             // opciones dinámicas del contexto
  opcional?: boolean
  sugerirAgentes?: boolean           // texto libre con botones de agentes (agente externo o interno)
  porDefecto?: "hoy" | "proximoNumero"
  cuando?: (params: Record<string, unknown>) => boolean
}

export interface Contexto {
  agentes: { id: string; nombre: string }[]
  ofertas: { numero: number; direccion: string; estado: string }[]
  hoy: string
  proximoNumero: number
}

export type Paso =
  | {
      tipo: "pregunta"
      campo: string
      pregunta: string
      input: TipoCampo
      opciones?: Opcion[]
      opcional?: boolean
      sugerencia?: Opcion
    }
  | { tipo: "resumen"; texto: string }

const CONCEPTOS_PAGO = ["FEE mensual", "Licencias CRM", "Mainstreet", "Otros"] as const
const TIPOLOGIAS = ["Depto", "Casa", "PH", "Terreno", "Oficina", "Cochera", "Campo", "Otro"] as const
const TIPOS_OFERTA = ["Venta", "Alquiler"] as const

export interface Flujo { titulo: string; campos: Campo[] }

export const FLUJOS: Record<string, Flujo> = {
  registrar_pago: {
    titulo: "Registrar un pago",
    campos: [
      { key: "agente_id",    pregunta: "¿De qué agente es el pago?", tipo: "agente" },
      { key: "concepto",     pregunta: "¿Por qué concepto?",         tipo: "opcion", opciones: CONCEPTOS_PAGO },
      { key: "monto_pagado", pregunta: "¿Cuántos USD pagó?",         tipo: "monto" },
      { key: "fecha",        pregunta: "¿De qué fecha es el pago?",  tipo: "fecha", porDefecto: "hoy" },
    ],
  },
  registrar_saldo_favor: {
    titulo: "Dejar saldo a favor",
    campos: [
      { key: "agente_id", pregunta: "¿A qué agente le dejás saldo a favor?", tipo: "agente" },
      { key: "monto",     pregunta: "¿Cuántos USD deja a favor?",            tipo: "monto" },
      { key: "fecha",     pregunta: "¿De qué fecha?",                        tipo: "fecha", porDefecto: "hoy" },
    ],
  },
  crear_oferta: {
    titulo: "Crear una oferta",
    campos: [
      { key: "numero",                   pregunta: "¿Qué número de oferta?",                     tipo: "entero", porDefecto: "proximoNumero" },
      { key: "direccion",                pregunta: "¿Cuál es la dirección?",                     tipo: "texto" },
      { key: "tipologia",                pregunta: "¿Qué tipo de propiedad es?",                 tipo: "opcion", opciones: TIPOLOGIAS },
      { key: "tipo_operacion",           pregunta: "¿Venta o alquiler?",                         tipo: "opcion", opciones: TIPOS_OFERTA },
      { key: "agente_vendedor_externo",  pregunta: "¿Quién es el agente vendedor?",              tipo: "texto", opcional: true, sugerirAgentes: true },
      { key: "agente_comprador_externo", pregunta: "¿Y el agente comprador?",                    tipo: "texto", opcional: true, sugerirAgentes: true },
      { key: "precio_publicacion_usd",   pregunta: "¿Precio de publicación en USD?",             tipo: "monto", opcional: true },
      { key: "monto_ofertado_usd",       pregunta: "¿Monto ofertado en USD?",                    tipo: "monto", opcional: true },
      { key: "tiene_reserva",            pregunta: "¿Tiene reserva (seña)?",                     tipo: "booleano" },
      { key: "monto_reserva_usd",        pregunta: "¿De cuántos USD es la reserva?",             tipo: "monto", cuando: (p) => p.tiene_reserva === true },
    ],
  },
  cambiar_estado_oferta: {
    titulo: "Cambiar el estado de una oferta",
    campos: [
      { key: "numero",       pregunta: "¿Qué oferta?",                    tipo: "opcion", opcionesDe: "ofertas" },
      { key: "nuevo_estado", pregunta: "¿A qué estado la pasás?",         tipo: "opcion", opciones: ESTADOS_OFERTA },
      { key: "descripcion",  pregunta: "¿Querés dejar una nota?",         tipo: "texto", opcional: true },
    ],
  },
}

export const INTENTS_GUIADOS = Object.keys(FLUJOS)
export const esIntentGuiado = (i: unknown): i is string => typeof i === "string" && i in FLUJOS

// ── Agentes ──────────────────────────────────────────────────────────────────
export type Resolucion = { agente?: { id: string; nombre: string }; ambiguo?: string[] }

// Coincidencia exacta > contiene > primer nombre. En cada nivel debe haber UN solo candidato;
// si hay varios (homónimos) se devuelve la lista para preguntar, nunca se adivina.
export function findAgent(agentes: Contexto["agentes"], name: unknown): Resolucion {
  if (typeof name !== "string" || !name.trim()) return {}
  const lower = name.toLowerCase().trim()
  const niveles = [
    (n: string) => n === lower,
    (n: string) => n.includes(lower),
    (n: string) => lower.includes(n.split(" ")[0]),
  ]
  for (const match of niveles) {
    const candidatos = agentes.filter((a) => match(a.nombre.toLowerCase()))
    if (candidatos.length === 1) return { agente: candidatos[0] }
    if (candidatos.length > 1) return { ambiguo: candidatos.map((c) => c.nombre) }
  }
  return {}
}

// ── Parseo de respuestas ─────────────────────────────────────────────────────
export type Parseo = { ok: true; valor: unknown } | { ok: false; error: string }

function parseMonto(raw: string): number {
  let s = raw.toLowerCase().replace(/usd|u\$s|us\$|\$|dólares|dolares/g, "").replace(/\s/g, "")
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".") // 1.500 / 1.500,50
  else s = s.replace(",", ".")
  return /^\d+(\.\d+)?$/.test(s) ? parseFloat(s) : NaN
}

function parseFecha(raw: string, hoy: string): string | null {
  const s = raw.toLowerCase().trim()
  if (s === "hoy") return hoy
  if (s === "ayer") {
    const d = new Date(hoy + "T12:00:00"); d.setDate(d.getDate() - 1)
    return d.toLocaleDateString("en-CA")
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (iso) return esFechaValida(s) ? s : null
  const dm = /^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/.exec(s)
  if (!dm) return null
  const anio = dm[3] ? (dm[3].length === 2 ? 2000 + parseInt(dm[3], 10) : parseInt(dm[3], 10)) : parseInt(hoy.slice(0, 4), 10)
  const f = `${anio}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`
  return esFechaValida(f) ? f : null
}

export function opcionesDe(campo: Campo, ctx: Contexto): Opcion[] | undefined {
  if (campo.tipo === "agente") return ctx.agentes.map((a) => ({ value: a.id, label: a.nombre }))
  if (campo.opcionesDe === "ofertas") {
    return ctx.ofertas.slice(0, 12).map((o) => ({ value: String(o.numero), label: `${o.numero} · ${o.direccion}` }))
  }
  if (campo.opciones) return campo.opciones.map((o) => ({ value: o, label: o }))
  if (campo.tipo === "booleano") return [{ value: "si", label: "Sí" }, { value: "no", label: "No" }]
  if (campo.sugerirAgentes) return ctx.agentes.map((a) => ({ value: a.nombre, label: a.nombre }))
  return undefined
}

export function parsearRespuesta(campo: Campo, raw: unknown, ctx: Contexto): Parseo {
  const txt = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : ""
  if (!txt && campo.tipo !== "booleano") return { ok: false, error: "No recibí una respuesta." }

  switch (campo.tipo) {
    case "agente": {
      const porId = ctx.agentes.find((a) => a.id === txt)
      if (porId) return { ok: true, valor: porId.id }
      const r = findAgent(ctx.agentes, txt)
      if (r.ambiguo) return { ok: false, error: `"${txt}" coincide con varios: ${r.ambiguo.join(", ")}. Tocá uno de la lista.` }
      if (!r.agente) return { ok: false, error: `No encontré al agente "${txt.slice(0, 40)}". Tocá uno de la lista.` }
      return { ok: true, valor: r.agente.id }
    }
    case "opcion": {
      const opts = opcionesDe(campo, ctx) ?? []
      const t = txt.toLowerCase()
      const exacto = opts.find((o) => o.value.toLowerCase() === t || o.label.toLowerCase() === t)
      if (exacto) return { ok: true, valor: campo.opcionesDe === "ofertas" ? parseInt(exacto.value, 10) : exacto.value }
      if (campo.opcionesDe === "ofertas") {
        // Se puede tipear el número de cualquier oferta activa, aunque no esté entre los botones
        const n = parseInt(txt, 10)
        if (ctx.ofertas.some((o) => o.numero === n)) return { ok: true, valor: n }
        return { ok: false, error: `No encontré la oferta "${txt.slice(0, 20)}" entre las activas.` }
      }
      const parcial = opts.filter((o) => o.label.toLowerCase().includes(t))
      if (parcial.length === 1) return { ok: true, valor: parcial[0].value }
      return { ok: false, error: `Elegí una de las opciones: ${opts.map((o) => o.label).join(", ")}.` }
    }
    case "monto": {
      const n = parseMonto(txt)
      if (!esMontoValido(n)) return { ok: false, error: "Escribí un monto mayor a 0 (ej: 1500 o 1.500,50)." }
      return { ok: true, valor: n }
    }
    case "entero": {
      const n = parseInt(txt.replace(/\D/g, ""), 10)
      if (!esEnteroPositivo(n)) return { ok: false, error: "Escribí un número entero mayor a 0." }
      return { ok: true, valor: n }
    }
    case "fecha": {
      const f = parseFecha(txt, ctx.hoy)
      if (!f) return { ok: false, error: "No entendí la fecha. Probá con \"hoy\", \"ayer\" o 15/10." }
      return { ok: true, valor: f }
    }
    case "booleano": {
      const t = txt.toLowerCase()
      if (["si", "sí", "s", "true", "1", "tiene"].includes(t)) return { ok: true, valor: true }
      if (["no", "n", "false", "0"].includes(t)) return { ok: true, valor: false }
      return { ok: false, error: "Respondé sí o no." }
    }
    case "texto":
    default:
      return { ok: true, valor: txt.slice(0, 300) }
  }
}

// ── Pasos ────────────────────────────────────────────────────────────────────
function campoActual(intent: string, params: Record<string, unknown>): Campo | null {
  const flujo = FLUJOS[intent]
  if (!flujo) return null
  for (const c of flujo.campos) {
    if (c.cuando && !c.cuando(params)) continue
    if (!(c.key in params)) return c
  }
  return null
}

function etiquetaAgente(ctx: Contexto, id: unknown): string {
  return ctx.agentes.find((a) => a.id === id)?.nombre ?? "—"
}
const usd = (n: unknown) => `USD ${Number(n).toLocaleString("es-AR")}`
const fechaCorta = (f: unknown) => (typeof f === "string" ? f.split("-").reverse().join("/") : "—")

export function resumir(intent: string, p: Record<string, unknown>, ctx: Contexto): string {
  switch (intent) {
    case "registrar_pago":
      return `Voy a registrar un pago de ${usd(p.monto_pagado)} de ${etiquetaAgente(ctx, p.agente_id)} por ${p.concepto}, con fecha ${fechaCorta(p.fecha)}. ¿Confirmás?`
    case "registrar_saldo_favor":
      return `Voy a dejar ${usd(p.monto)} a favor de ${etiquetaAgente(ctx, p.agente_id)}, con fecha ${fechaCorta(p.fecha)}. ¿Confirmás?`
    case "crear_oferta": {
      const extra = [
        p.agente_vendedor_externo ? `Vendedor: ${p.agente_vendedor_externo}` : null,
        p.agente_comprador_externo ? `Comprador: ${p.agente_comprador_externo}` : null,
        p.precio_publicacion_usd ? `Publicación: ${usd(p.precio_publicacion_usd)}` : null,
        p.monto_ofertado_usd ? `Ofertado: ${usd(p.monto_ofertado_usd)}` : null,
        p.tiene_reserva ? `Reserva: ${usd(p.monto_reserva_usd)}` : null,
      ].filter(Boolean)
      return `Voy a crear la oferta ${p.numero} en ${p.direccion} (${p.tipologia}, ${p.tipo_operacion}).${extra.length ? "\n" + extra.join(" · ") : ""}\n¿Confirmás?`
    }
    case "cambiar_estado_oferta": {
      const o = ctx.ofertas.find((x) => x.numero === p.numero)
      return `Voy a pasar la oferta ${p.numero}${o ? ` (${o.direccion})` : ""}${o ? ` de «${o.estado}»` : ""} a «${p.nuevo_estado}»${p.descripcion ? ` — ${p.descripcion}` : ""}. ¿Confirmás?`
    }
    default:
      return "¿Confirmás?"
  }
}

export function proximoPaso(intent: string, params: Record<string, unknown>, ctx: Contexto): Paso {
  const campo = campoActual(intent, params)
  if (!campo) return { tipo: "resumen", texto: resumir(intent, params, ctx) }

  let sugerencia: Opcion | undefined
  let pregunta = campo.pregunta
  if (campo.porDefecto === "hoy") sugerencia = { value: "hoy", label: "Hoy" }
  if (campo.porDefecto === "proximoNumero") {
    sugerencia = { value: String(ctx.proximoNumero), label: `N° ${ctx.proximoNumero}` }
    pregunta += ` (sugerido: ${ctx.proximoNumero})`
  }
  if (campo.opcional) pregunta += " (opcional)"
  return {
    tipo: "pregunta",
    campo: campo.key,
    pregunta,
    input: campo.tipo,
    opciones: opcionesDe(campo, ctx),
    opcional: campo.opcional,
    sugerencia,
  }
}

// Toma los parámetros que Gemini extrajo de la frase inicial, descarta los que no pasan la
// validación (se vuelven a preguntar) y devuelve solo los válidos.
export function sanearParamsIniciales(intent: string, crudos: Record<string, unknown>, ctx: Contexto): Record<string, unknown> {
  const flujo = FLUJOS[intent]
  if (!flujo) return {}
  const entrada: Record<string, unknown> = { ...crudos }
  // alias que el modelo suele usar
  if (entrada.agente_id === undefined && entrada.agente_nombre !== undefined) entrada.agente_id = entrada.agente_nombre
  if (intent === "registrar_saldo_favor" && entrada.monto === undefined) entrada.monto = entrada.monto_pagado
  if (intent === "cambiar_estado_oferta" && entrada.numero === undefined) entrada.numero = entrada.oferta

  const out: Record<string, unknown> = {}
  for (const campo of flujo.campos) {
    const v = entrada[campo.key]
    if (v === undefined || v === null || v === "") continue
    if (campo.cuando && !campo.cuando({ ...out })) continue
    const r = parsearRespuesta(campo, typeof v === "boolean" ? (v ? "si" : "no") : v, ctx)
    if (r.ok) out[campo.key] = r.valor
  }
  return out
}

/** Aplica una respuesta del usuario al borrador. Devuelve el borrador nuevo o un error para repreguntar. */
export function aplicarRespuesta(
  intent: string,
  params: Record<string, unknown>,
  campoKey: string,
  raw: unknown,
  omitir: boolean,
  ctx: Contexto,
): { ok: true; params: Record<string, unknown> } | { ok: false; error: string } {
  const campo = FLUJOS[intent]?.campos.find((c) => c.key === campoKey)
  if (!campo) return { ok: false, error: "No entendí a qué dato corresponde esa respuesta." }
  if (omitir) {
    if (!campo.opcional) return { ok: false, error: "Ese dato es obligatorio." }
    return { ok: true, params: { ...params, [campo.key]: null } }
  }
  const r = parsearRespuesta(campo, raw, ctx)
  if (!r.ok) return r
  return { ok: true, params: { ...params, [campo.key]: r.valor } }
}

/** Deja solo las claves que pertenecen al flujo (el borrador viaja por el cliente: no se confía en él). */
export function limpiarBorrador(intent: string, params: unknown): Record<string, unknown> {
  const flujo = FLUJOS[intent]
  if (!flujo || !params || typeof params !== "object" || Array.isArray(params)) return {}
  const permitidas = new Set(flujo.campos.map((c) => c.key))
  return Object.fromEntries(Object.entries(params as Record<string, unknown>).filter(([k]) => permitidas.has(k)))
}
