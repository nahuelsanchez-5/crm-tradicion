import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getSession } from "@/lib/auth-guard"

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(req.url)
    const month = parseInt(searchParams.get("month") ?? "0")
    const year  = parseInt(searchParams.get("year")  ?? "0")

    if (!month || !year) {
      return NextResponse.json({ error: "month y year son requeridos" }, { status: 400 })
    }

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`
    const endYear   = month === 12 ? year + 1 : year
    const endMonth  = month === 12 ? 1 : month + 1
    const endDate   = `${endYear}-${String(endMonth).padStart(2, "0")}-01`

    const supabase = createServerClient()
    const { data, error } = await supabase
      .from("carteles_devueltos")
      .select("*")
      .gte("fecha_devolucion", startDate)
      .lt("fecha_devolucion", endDate)
      .order("fecha_devolucion", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    )
  }
}
