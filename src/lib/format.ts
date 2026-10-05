// Helpers de formato compartidos.
// fmtUSD siempre muestra 2 decimales (ej: "USD 100,00"). Null-safe: null/undefined → "—".
import { MONTH_NAMES } from "./constantes"

export { MONTH_NAMES }

export function fmtUSD(n: number | null | undefined): string {
  if (n == null) return "—"
  const rounded = Math.round(n * 100) / 100
  return `USD ${rounded.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * "YYYY-MM-DD" (o timestamp ISO) → "2 Oct 2026". Seguro: devuelve "—" si viene vacío o mal formado
 * (antes cada módulo tenía su copia y una fecha inválida rompía la pantalla entera).
 */
export function fmtFecha(fecha: string | null | undefined): string {
  if (!fecha) return "—"
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha)
  if (!m) return "—"
  const mes = parseInt(m[2], 10)
  if (mes < 1 || mes > 12) return "—"
  return `${parseInt(m[3], 10)} ${MONTH_NAMES[mes - 1].slice(0, 3)} ${m[1]}`
}
