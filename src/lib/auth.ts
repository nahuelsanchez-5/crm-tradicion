import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { createServerClient } from "@/lib/supabase"

/**
 * Autenticación con Google. Autorización: solo emails presentes y activos
 * en la tabla usuarios_staff de Supabase pueden iniciar sesión.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase().trim()
      if (!email) return false

      const supabase = createServerClient()
      const { data, error } = await supabase
        .from("usuarios_staff")
        .select("email")
        .eq("activo", true)

      if (error || !data) return false
      return data.some(row => row.email?.toLowerCase().trim() === email)
    },
  },
}
