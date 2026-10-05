// Constantes de dominio compartidas (antes copiadas módulo por módulo).

export const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const

export const ESTADOS_OFERTA = [
  "Espera rta. vendedor",
  "Espera rta. comprador",
  "Aceptadas / Pre cierre",
  "Cerradas",
  "Caídas",
] as const

// El dominio de tipo de operación de las OFERTAS está mezclado entre pantallas
// ("Temporal" en Dashboard, "Temporario" en el detalle): el server acepta ambas.
export const TIPOS_OPERACION_OFERTA_VALIDOS = ["Venta", "Alquiler", "Alquiler Temporal", "Alquiler Temporario"] as const

// Idem tipologías: Ofertas usa "Depto", el Dashboard "Departamento", etc. Se acepta la unión.
export const TIPOLOGIAS_VALIDAS = [
  "Depto", "Departamento", "Casa", "PH", "Terreno", "Oficina", "Cochera", "Campo",
  "Local Comercial", "Galpón", "Edificio", "Otro",
] as const

// Tipos de la tabla `operaciones`
export const TIPOS_OPERACION_VALIDOS = ["Venta", "Alquiler", "Alquiler Temporal", "Referido", "Otro"] as const
