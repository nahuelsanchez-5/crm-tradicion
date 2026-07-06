import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

/**
 * Exige sesión en todas las rutas (páginas y API) salvo /api/auth/*,
 * /login y assets estáticos (excluidos vía matcher).
 * API sin sesión → 401 JSON. Página sin sesión → redirect a /login.
 */
export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (token) return NextResponse.next()

  const { pathname, search } = request.nextUrl

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const loginUrl = new URL("/login", request.url)
  loginUrl.searchParams.set("callbackUrl", pathname + search)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    // Todo salvo: /api/auth/*, /login, internals de Next y archivos con extensión (assets)
    "/((?!api/auth|login|_next/static|_next/image|favicon\\.ico|.*\\..*).*)",
  ],
}
