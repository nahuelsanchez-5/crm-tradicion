export type ChecklistCategoria = "pre_sena" | "documentacion" | "post_cierre"

export interface ChecklistItem {
  orden: number
  item: string
  categoria: ChecklistCategoria
}

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  { orden: 1,  item: "Tipo USD y color de billete confirmado",               categoria: "pre_sena" },
  { orden: 2,  item: "Instrumento legal definido (Boleto/Escritura directa)", categoria: "pre_sena" },
  { orden: 3,  item: "Monto a escriturar acordado",                          categoria: "pre_sena" },
  { orden: 4,  item: "Libre de ocupantes confirmado",                        categoria: "pre_sena" },
  { orden: 5,  item: "Fecha de entrega definida",                            categoria: "pre_sena" },
  { orden: 6,  item: "Forma de pago definida (Contado/Cuotas/Crédito)",      categoria: "pre_sena" },
  { orden: 7,  item: "Revisión con legales",                                 categoria: "pre_sena" },
  { orden: 8,  item: "Revisión con escribanos",                              categoria: "pre_sena" },
  { orden: 9,  item: "Estado cuenta Secheep",                                categoria: "pre_sena" },
  { orden: 10, item: "Estado cuenta Sameep",                                 categoria: "pre_sena" },
  { orden: 11, item: "Impuestos municipales al día",                         categoria: "pre_sena" },
  { orden: 12, item: "Certificado Catastral",                                categoria: "pre_sena" },
  { orden: 13, item: "Cierre en RED REMAX",                                  categoria: "documentacion" },
  { orden: 14, item: "Facturación emitida",                                  categoria: "documentacion" },
  { orden: 15, item: "Carga en Drive",                                       categoria: "documentacion" },
  { orden: 16, item: "Cierre en Q&R",                                        categoria: "documentacion" },
  { orden: 17, item: "Encuesta experiencia REMAX comprador",                 categoria: "documentacion" },
  { orden: 18, item: "Encuesta experiencia REMAX vendedor",                  categoria: "documentacion" },
  { orden: 19, item: "Comisión cobrada completa",                            categoria: "documentacion" },
  { orden: 20, item: "Recibo firmado comprador",                             categoria: "documentacion" },
  { orden: 21, item: "Recibo firmado vendedor",                              categoria: "documentacion" },
  { orden: 22, item: "Documentación en carpeta física",                      categoria: "documentacion" },
  { orden: 23, item: "Notificación a administración",                        categoria: "post_cierre" },
  { orden: 24, item: "Actualización en planilla KPI",                        categoria: "post_cierre" },
  { orden: 25, item: "Feedback al agente",                                   categoria: "post_cierre" },
  { orden: 26, item: "Carta de agradecimiento enviada",                      categoria: "post_cierre" },
  { orden: 27, item: "Publicación dada de baja en portales",                 categoria: "post_cierre" },
  { orden: 28, item: "MLS actualizado",                                      categoria: "post_cierre" },
  { orden: 29, item: "Fotos archivadas en Drive",                            categoria: "post_cierre" },
  { orden: 30, item: "Contrato escaneado",                                   categoria: "post_cierre" },
  { orden: 31, item: "Boleto/Escritura escaneada",                           categoria: "post_cierre" },
  { orden: 32, item: "Liquidación de comisión enviada",                      categoria: "post_cierre" },
  { orden: 33, item: "Archivo en base histórica",                            categoria: "post_cierre" },
  { orden: 34, item: "Control de calidad completado",                        categoria: "post_cierre" },
  { orden: 35, item: "Nota interna registrada",                              categoria: "post_cierre" },
  { orden: 36, item: "Cierre confirmado en sistema",                         categoria: "post_cierre" },
]
