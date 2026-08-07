export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { Sora } from "next/font/google"
import "./globals.css"
import Sidebar from "@/components/Sidebar"
import AIAssistant from "@/components/AIAssistant"
import SessionProvider from "@/components/providers/SessionProvider"
import { createServerClient } from "@/lib/supabase"

const sora = Sora({
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
  const { count } = await supabase
    .from("agentes")
    .select("*", { count: "exact", head: true })
    .eq("activo", true)

  return (
    <html lang="es" className={`${sora.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden">
        <SessionProvider>
          <div style={{ display: "flex", height: "100%" }}>
            <div className="no-print" style={{ display: "contents" }}>
              <Sidebar agenteCount={count ?? 0} />
            </div>
            <main style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
              <div className="animate-page-in" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                {children}
              </div>
            </main>
          </div>
          <div className="no-print">
            <AIAssistant />
          </div>
        </SessionProvider>
      </body>
    </html>
  )
}
