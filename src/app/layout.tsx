import type { Metadata } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import "./globals.css"
import Sidebar from "@/components/Sidebar"
import AIAssistant from "@/components/AIAssistant"
import { createServerClient } from "@/lib/supabase"
import { auth } from "@/auth"

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: "REMAX Tradición CRM",
  description: "Panel de gestión para REMAX Tradición",
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = createServerClient()
  const [{ count }, session] = await Promise.all([
    supabase
      .from("agentes")
      .select("*", { count: "exact", head: true })
      .eq("activo", true),
    auth(),
  ])

  return (
    <html lang="es" className={`${jakarta.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden" style={{ background: "linear-gradient(135deg, #0a0a1a 0%, #0d0d2b 50%, #0a1a0f 100%)" }}>
        <div style={{ display: "flex", height: "100%" }}>
          <Sidebar agenteCount={count ?? 0} user={session?.user ?? null} />
          <main style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
            {children}
          </main>
        </div>
        <AIAssistant />
      </body>
    </html>
  )
}
