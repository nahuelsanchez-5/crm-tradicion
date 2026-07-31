// Cálculo efectivo de "paga fee" de un agente.
// Override manual gana siempre: si paga_fee es true/false explícito en la DB, se respeta.
// Solo cuando paga_fee es null se calcula automático: 180 días de antigüedad + regla de quincena
// (si el día 180 cae en la 2da quincena —día 16 en adelante—, el fee arranca recién el mes siguiente).

export function getEfectivoPagaFee(fechaAlta: string, pagaFeeManual: boolean | null): boolean {
  if (pagaFeeManual !== null) return pagaFeeManual

  const alta = new Date(fechaAlta + "T00:00:00")
  const cumple180 = new Date(alta)
  cumple180.setDate(cumple180.getDate() + 180)

  // Si el día 180 cae en la 2da quincena (día 16 en adelante), el fee arranca recién el mes siguiente
  const dia = cumple180.getDate()
  const mesEfectivo = dia >= 16
    ? new Date(cumple180.getFullYear(), cumple180.getMonth() + 1, 1)
    : new Date(cumple180.getFullYear(), cumple180.getMonth(), 1)

  const hoy = new Date()
  const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1)

  return mesEfectivo <= inicioMesActual
}
