import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { authConfig } from "./auth.config"
import { createServerClient } from "@/lib/supabase"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.email) return false
      try {
        const supabase = createServerClient()
        const { data } = await supabase
          .from("usuarios_staff")
          .select("activo")
          .eq("email", user.email)
          .eq("activo", true)
          .single()
        return !!data
      } catch {
        return false
      }
    },
  },
})
