import type { NextAuthConfig } from "next-auth"

// Edge-safe config — sin imports de Node.js (Supabase, crypto, etc.)
// Usado por middleware.ts para validar sesiones sin pasar por el runtime de Node.
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/acceso-denegado",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const { pathname } = nextUrl
      const isPublic =
        pathname.startsWith("/login") ||
        pathname.startsWith("/acceso-denegado") ||
        pathname.startsWith("/api/auth")
      if (isPublic) return true
      return !!auth?.user
    },
  },
  providers: [],
} satisfies NextAuthConfig
