// Retorna "YYYY-MM-DD" en zona horaria Argentina.
// Reemplaza new Date().toISOString().split("T")[0], que después de las 21hs
// (UTC ya en el día siguiente) devuelve el día equivocado.
export function hoyArgentina(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
}

/** Mes (1-12) y año actuales en hora Argentina. En el server (UTC) `new Date().getMonth()` se adelanta después de las 21hs del último día del mes. */
export function mesAnioArgentina(): { mes: number; anio: number } {
  const [anio, mes] = hoyArgentina().split("-")
  return { mes: parseInt(mes, 10), anio: parseInt(anio, 10) }
}

/**
 * Límites [desde, hasta) de un mes (1-12) para filtrar columnas timestamptz en hora Argentina.
 * Filtrar con "YYYY-MM-01" a secas se interpreta como UTC y corre 3hs el borde del mes.
 */
export function limitesMesArgentina(anio: number, mes: number): { desde: string; hasta: string } {
  const pad = (n: number) => String(n).padStart(2, "0")
  const sigAnio = mes === 12 ? anio + 1 : anio
  const sigMes  = mes === 12 ? 1 : mes + 1
  return {
    desde: `${anio}-${pad(mes)}-01T00:00:00-03:00`,
    hasta: `${sigAnio}-${pad(sigMes)}-01T00:00:00-03:00`,
  }
}

/** Timestamp ISO con offset -03:00 (Argentina no usa horario de verano), para guardar fechas con hora sin correrlas de día. */
export function ahoraArgentinaISO(): string {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date())
  const p = Object.fromEntries(f.map((x) => [x.type, x.value]))
  const hh = p.hour === "24" ? "00" : p.hour
  return `${p.year}-${p.month}-${p.day}T${hh}:${p.minute}:${p.second}-03:00`
}
