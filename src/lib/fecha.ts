export function hoyArgentina(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
}
// Retorna "YYYY-MM-DD" en zona horaria Argentina.
// Reemplaza new Date().toISOString().split("T")[0], que después de las 21hs
// (UTC ya en el día siguiente) devuelve el día equivocado.
