import type { Metadata } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import "./globals.css"
import Sidebar from "@/components/Sidebar"

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: "REMAX Tradición CRM",
  description: "Panel de gestión para REMAX Tradición",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${jakarta.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden" style={{ background: "#F8F9FC" }}>
        <div style={{ display: "flex", height: "100%" }}>
          <Sidebar />
          <main style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
