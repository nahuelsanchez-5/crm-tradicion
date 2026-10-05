import { mensajeErrorDB } from "@/lib/errores"
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getSession } from "@/lib/auth-guard"
import { limitesMesArgentina } from "@/lib/fecha"
import { esEnteroEnRango } from "@/lib/validate"

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(req.url)
    const month = parseInt(searchParams.get("month") ?? "0")
    const year  = parseInt(searchParams.get("year")  ?? "0")

    if (!esEnteroEnRango(month, 1, 12) || !esEnteroEnRango(year, 2000, 2100)) {
      return NextResponse.json({ error: "month (1-12) y year (2000-2100) son requeridos" }, { status: 400 })
    }

    const { desde: startDate, hasta: endDate } = limitesMesArgentina(year, month)

    const supabase = createServerClient()
    const { data, error } = await supabase
      .from("carteles_devueltos")
      .select("*")
      .gte("fecha_devolucion", startDate)
      .lt("fecha_devolucion", endDate)
      .order("fecha_devolucion", { ascending: false })

    if (error) {
      return NextResponse.json({ error: mensajeErrorDB(error) }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    console.error("[api] error:", err)
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 },
    )
  }
}
