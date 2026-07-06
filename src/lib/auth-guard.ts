import { getServerSession } from "next-auth"
import type { Session } from "next-auth"
import { authOptions } from "@/lib/auth"

/** Devuelve la sesión actual o null. Para chequeos manuales en API routes. */
export async function getSession(): Promise<Session | null> {
  return getServerSession(authOptions)
}

/**
 * Guard para server actions: corta la ejecución si no hay sesión válida.
 * Defensa en profundidad además del proxy — nunca ejecutar mutaciones sin sesión.
 */
export async function requireSession(): Promise<Session> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    throw new Error("No autorizado: se requiere sesión válida")
  }
  return session
}
