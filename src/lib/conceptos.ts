// Clasificación de conceptos de pago en grupos. Única definición: la usan Pagos y Resumen.

export type ConceptGroup = "FEE" | "CRM" | "Mainstreet" | "BolsasVino" | "SaldoFavor" | "Otros"

export const CONCEPTO_SALDO_FAVOR = "Saldo a favor"

export function getConceptGroup(concepto: string): ConceptGroup {
  const c = (concepto ?? "").toLowerCase()
  if (c.includes("fee")) return "FEE"
  // "pro" como palabra ("PRO", "PRO+"): un `includes("pro")` suelto clasificaba "Promoción" o "Proyecto" como CRM
  if (/\bpro\b/.test(c) || c.includes("crm") || c.includes("plan") || c.includes("licencia")) return "CRM"
  if (c.includes("mainstreet")) return "Mainstreet"
  if (c.includes("bolsa") && c.includes("vino")) return "BolsasVino"
  if (concepto === CONCEPTO_SALDO_FAVOR) return "SaldoFavor"
  return "Otros"
}
