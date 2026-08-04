export function esMontoValido(n: unknown): n is number {
  return typeof n === "number" && !isNaN(n) && isFinite(n) && n > 0
}

export function esStringNoVacio(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0
}

export function esFechaValida(s: unknown): s is string {
  if (typeof s !== "string") return false
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + "T00:00:00").getTime())
}

export function esUUIDValido(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

// Monto/contador donde 0 es un valor legítimo (real_usd de un mes vacío, comisión 0, etc.)
export function esNumeroNoNegativo(n: unknown): n is number {
  return typeof n === "number" && !isNaN(n) && isFinite(n) && n >= 0
}

// Enteros identificadores que deben ser > 0 (numero de oferta/cartel, numero_padre)
export function esEnteroPositivo(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0
}

// Entero dentro de un rango inclusivo (mes 1-12, año, nps -100..100)
export function esEnteroEnRango(n: unknown, min: number, max: number): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max
}

export function esArrayNoVacio<T>(a: unknown): a is T[] {
  return Array.isArray(a) && a.length > 0
}

export function esUnoDe<T extends string>(v: unknown, opciones: readonly T[]): v is T {
  return typeof v === "string" && (opciones as readonly string[]).includes(v)
}

export function esEmailValido(s: unknown): s is string {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
}
