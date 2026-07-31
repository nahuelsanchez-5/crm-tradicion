// Helpers de formato compartidos.
// fmtUSD siempre muestra 2 decimales (ej: "USD 100,00"). Null-safe: null/undefined → "—".

export function fmtUSD(n: number | null | undefined): string {
  if (n == null) return "—"
  const rounded = Math.round(n * 100) / 100
  return `USD ${rounded.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
