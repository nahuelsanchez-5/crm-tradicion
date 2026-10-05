// Cálculo efectivo de "paga fee" de un agente.
// Override manual gana siempre: si paga_fee es true/false explícito en la DB, se respeta.
// Solo cuando paga_fee es null se calcula automático: 180 días de antigüedad + regla de quincena
// (si el día 180 cae en la 2da quincena —día 16 en adelante—, el fee arranca recién el mes siguiente).

// `refDate`: mes contra el que se evalúa (por defecto hoy). Para un Resumen de un mes pasado hay que
// pasar ese mes; si no, "quién paga fee" cambia retroactivamente con el paso del tiempo.
export function getEfectivoPagaFee(fechaAlta: string, pagaFeeManual: boolean | null, refDate: Date = new Date()): boolean {
  if (pagaFeeManual !== null) return pagaFeeManual

  const alta = new Date(fechaAlta + "T00:00:00")
  const cumple180 = new Date(alta)
  cumple180.setDate(cumple180.getDate() + 180)

  // Si el día 180 cae en la 2da quincena (día 16 en adelante), el fee arranca recién el mes siguiente
  const dia = cumple180.getDate()
  const mesEfectivo = dia >= 16
    ? new Date(cumple180.getFullYear(), cumple180.getMonth() + 1, 1)
    : new Date(cumple180.getFullYear(), cumple180.getMonth(), 1)

  const inicioMesRef = new Date(refDate.getFullYear(), refDate.getMonth(), 1)

  return mesEfectivo <= inicioMesRef
}
