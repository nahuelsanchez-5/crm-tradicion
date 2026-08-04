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
