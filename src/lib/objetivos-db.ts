// Objetivos mensuales de facturación con meses cerrados "congelados".
//
// Regla: el objetivo de un mes TERMINADO (a las 00:00 del día 1 del mes siguiente, hora Argentina) queda fijo:
// se guarda en facturacion.objetivo_usd y deja de depender del objetivo anual. El mes en curso y los futuros
// siguen el objetivo anual vigente (anual × estacionalidad).
//
// Cómo se garantiza sin un proceso programado: cada vez que se leen los objetivos de un año, los meses ya
// terminados que no tengan valor guardado se guardan en ese momento, y al cambiar el objetivo anual
// (Configuración) se leen ANTES de aplicar el cambio, con lo cual quedan guardados con el valor viejo.

import type { createServerClient } from "./supabase"
import { mesAnioArgentina } from "./fecha"
import { CLAVE_OBJETIVO_ANUAL, calcObjetivoMes, claveObjetivoAnual, mesTerminado, objetivoAnualDe } from "./objetivos"

type Supa = ReturnType<typeof createServerClient>

export interface FilaFacturacion {
  id: string
  mes: number
  anio: number
  objetivo_usd: number | null
  real_usd: number
}

export interface ObjetivosAnio {
  anio: number
  objetivoAnual: number
  /** Objetivo de cada mes (índice 0 = enero), con los meses terminados fijos */
  objetivos: number[]
  /** Filas guardadas de ese año (ya con los meses terminados guardados) */
  filas: FilaFacturacion[]
}

export async function cargarObjetivosAnio(supabase: Supa, anio: number): Promise<ObjetivosAnio> {
  const hoy = mesAnioArgentina()

  const [{ data: cfg }, { data: filasRaw }] = await Promise.all([
    supabase.from("config").select("clave, valor").in("clave", [CLAVE_OBJETIVO_ANUAL, claveObjetivoAnual(anio), claveObjetivoAnual(hoy.anio)]),
    supabase.from("facturacion").select("id, mes, anio, objetivo_usd, real_usd").eq("anio", anio),
  ])

  const mapa = Object.fromEntries((cfg ?? []).map((c) => [c.clave as string, c.valor as string]))
  const objetivoAnual = objetivoAnualDe(mapa, anio, hoy.anio)

  // El año en curso todavía usa la clave histórica `obj_anual_usd`: se le crea su clave propia para que
  // el año siga teniendo su objetivo cuando pase a ser un año anterior (si no, quedaría "sin objetivo").
  if (anio === hoy.anio && !mapa[claveObjetivoAnual(anio)] && mapa[CLAVE_OBJETIVO_ANUAL]) {
    const { error } = await supabase.from("config").upsert(
      { clave: claveObjetivoAnual(anio), valor: mapa[CLAVE_OBJETIVO_ANUAL], etiqueta: `Objetivo anual ${anio} (USD)`, grupo: "facturacion" },
      { onConflict: "clave" },
    )
    if (error) console.error("[objetivos] no se pudo crear la clave del año", anio, error.message)
  }
  const filas = ((filasRaw ?? []) as unknown) as FilaFacturacion[]

  const objetivos: number[] = []
  const porGuardar: { mes: number; objetivo: number; fila?: FilaFacturacion }[] = []

  for (let mes = 1; mes <= 12; mes++) {
    const fila = filas.find((f) => f.mes === mes)
    const calculado = calcObjetivoMes(objetivoAnual, mes)
    if (mesTerminado(anio, mes, hoy)) {
      const guardado = Number(fila?.objetivo_usd)
      if (Number.isFinite(guardado) && guardado > 0) {
        objetivos.push(guardado)
      } else {
        objetivos.push(calculado)
        // Sin objetivo anual para ese año (calculado = 0): no se guarda nada
        if (calculado > 0) porGuardar.push({ mes, objetivo: calculado, fila })
      }
    } else {
      objetivos.push(calculado)
    }
  }

  // Guardar (sin romper la pantalla si falla: se vuelve a intentar en la próxima lectura)
  for (const p of porGuardar) {
    try {
      if (p.fila) {
        const { error } = await supabase.from("facturacion").update({ objetivo_usd: p.objetivo }).eq("id", p.fila.id)
        if (error) throw error
        p.fila.objetivo_usd = p.objetivo
      } else {
        const { data: nueva, error } = await supabase
          .from("facturacion").insert({ mes: p.mes, anio, objetivo_usd: p.objetivo, real_usd: 0 }).select("id, mes, anio, objetivo_usd, real_usd").single()
        if (error) throw error
        if (nueva) filas.push(nueva as unknown as FilaFacturacion)
      }
    } catch (e) {
      console.error("[objetivos] no se pudo guardar el objetivo del mes", anio, p.mes, (e as { message?: string })?.message)
    }
  }

  return { anio, objetivoAnual, objetivos, filas }
}
