// Traduce errores de Supabase/Postgres a mensajes seguros para mostrar al usuario.
// El detalle real (tablas, columnas, constraints) queda en el log del servidor, no en pantalla.

type ErrorDB = { message?: string; code?: string } | null | undefined

export function mensajeErrorDB(error: ErrorDB, contexto = "guardar"): string {
  console.error(`[db] error al ${contexto}:`, error?.code ?? "", error?.message ?? "")
  switch (error?.code) {
    case "23505": return "Ya existe un registro con esos datos."
    case "23503": return "Hay una referencia inválida (el registro relacionado no existe)."
    case "23502": return "Falta completar un dato obligatorio."
    case "23514": return "Alguno de los valores está fuera del rango permitido."
    case "22P02": return "Hay un dato con formato inválido."
    default:      return `No se pudo ${contexto}. Intentá de nuevo.`
  }
}
