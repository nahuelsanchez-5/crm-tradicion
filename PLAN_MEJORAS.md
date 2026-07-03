# PLAN DE MEJORAS UI/UX — CRM Tradición

**Rama:** `mejoras-ui` · **Referencia:** AUDITORIA.md · **Reglas:** ver CLAUDE.md

Cómo usar este plan: cada checkbox es una mejora atómica. Al completar un módulo, marcar sus checkboxes **en el mismo commit** que el código. Un commit por módulo. `npm run build` sin errores antes de cada commit. No tocar DB ni API routes que funcionan (las excepciones están en Fase 0 y requieren aprobación explícita).

---

## Fase 0 — Transversal (prerequisito de todos los módulos)

### 0a. Componentes y utilidades compartidas (sin riesgo, solo UI)
- [ ] Crear `src/lib/format.ts` (`fmtUSD`, `fmtFecha`, `fmtDateTime`, `MONTH_NAMES`) y reemplazar las ~22 copias módulo por módulo
- [ ] Crear `src/components/Modal.tsx` compartido: Backdrop + ModalHeader + Escape + `role="dialog"`/`aria-modal` + focus-trap + retorno de foco (reemplaza 3 shells y 9 hooks Escape; arregla a11y de los 29 modales de una vez)
- [ ] Crear `src/components/form.tsx`: `Field` (con `htmlFor`), `Input`/`Select` sobre `.crm-input`, `Toggle` dark (con `aria-pressed`) — elimina 10 `Field`, 10 `inp` y los 3 Toggle verde-claro
- [ ] Crear `src/lib/types.ts` con tipos compartidos (`Agente`, etc.) que hoy cada módulo redefine
- [ ] Definir en `globals.css` tokens para la paleta semántica dark (éxito `#4ade80`, error `#f87171`, warning `#fbbf24`, violeta `#a78bfa`, azul `#60a5fa`) y estilo `:focus-visible` para `.crm-btn-*`
- [ ] Adoptar `PageHeader` en los 8 módulos que hand-rollean el header (o borrarlo y estandarizar la clase)
- [ ] Decidir destino de `src/components/ui/` (shadcn): adoptar (aplicar clase `dark` al html + corregir tokens `:root`) o eliminar los 9 componentes muertos — regla 6 de CLAUDE.md sugiere adoptar
- [ ] `loading.tsx` con skeletons (usando `ui/skeleton`) y `error.tsx` en las 12 rutas
- [ ] Toast global reusable con `role="status"` (hoy solo cartelería tiene; el resto guarda sin confirmación visual)
- [ ] Sidebar: `aria-label` en `<nav>`, `aria-current="page"` en link activo, agregar link a `/facturacion` (huérfano)
- [ ] Helper de fecha local Argentina (`hoyLocal()`) para reemplazar los `toISOString()` UTC que corren la fecha +1 después de las 21:00

### 0b. Correcciones críticas que tocan server/DB — ⚠️ requieren OK explícito (regla 2)
- [ ] **Autenticación** (Supabase Auth + `middleware.ts` + chequeo de sesión en actions/routes) — prerequisito de seguridad, la app hoy es pública
- [ ] Separar `src/lib/supabase-server.ts` con `import 'server-only'`
- [ ] Validación server-side de inputs en actions (montos ≥ 0, fechas, enums, NPS 0-10)
- [ ] Cierre de oferta atómico (operación dentro de `registrarCierre`) + UNIQUE en DB para dedup de operaciones
- [ ] Fix queries rotas de Agentes (C15) y `fecha_baja` pisada (C12)
- [ ] Sincronizar claves de config Resumen↔Configuración (C16) y quitar año 2026 hardcodeado de Facturación (C17)
- [ ] Borrado vinculado del par gasto+"Crédito aplicado" (C10) y semántica de la fila de crédito (C11)
- [ ] Sanear ai-assistant: quitar log de API key, quitar `debug` del 500, desambiguar `findAgent`
- [ ] `updated_at` de oferta al registrar movimiento/seguimiento (C19)

---

## 1. Dashboard
- [ ] `loading.tsx` con skeleton de KPIs + secciones (hoy navegación en blanco con force-dynamic)
- [ ] Corregir "Pagos pendientes — {mes}": filtrar la query por mes o renombrar a "Pagos pendientes"
- [ ] Quitar trends falsos de KpiCard ("Sin cambios" hardcodeado, flecha siempre ↑): comparar real vs mes anterior o eliminarlos
- [ ] Unificar las 3 queries duplicadas de agentes (layout + page ×2) en una sola; mover el badge del sidebar fuera del root layout (o cachearlo) para destrabar `force-dynamic` global
- [ ] AbortController en la búsqueda de cartel (elimina respuestas fuera de orden que pueden confirmar la devolución equivocada)
- [ ] Eliminar el modal "encuesta" muerto y su estado asociado
- [ ] Accesibilidad de modales del dashboard (migrar a `Modal` compartido de Fase 0)
- [ ] `DashboardClock` sin flash de placeholder (200px fijo pre-hydration)

## 2. Ofertas
- [ ] Ocultar/deshabilitar "Registrar cierre" y "Cambiar estado" cuando la oferta ya está Cerrada/Caída + badge visual de estado terminal
- [ ] Matar colores light: `Toggle` `#ECFDF5`, fallbacks `#F1F5F9`/`#64748B` de badges y empty-states, botones pending `#CBD5E1` → paleta dark 400
- [ ] Reset completo del form en "Nueva Oferta" (hoy quedan dirección/montos/notas residuales del intento anterior)
- [ ] KPI "Cerradas este mes" por `fecha_cierre` real (agregarla al select) en vez de `updated_at`
- [ ] Unificar dominio `tipo_operacion` (Temporal vs Temporario) y agregar opciones faltantes al filtro Tipo
- [ ] Migrar los 4 modales del detalle a `.crm-modal`/`Modal` compartido (gana bottom-sheet mobile + scroll interno)
- [ ] Header del detalle responsive (wrap de botones, `DataRow` sin `minWidth` fijo)
- [ ] Buscador por dirección/número en la vista lista
- [ ] Historial: orden descendente o auto-scroll al último movimiento
- [ ] `agenteMap` con `useMemo` y cleanup de `setTimeout` en unmount
- [ ] Migrar estilos inline a clases `crm-*`/Tailwind

## 3. Cuentas (Pagos)
- [ ] Matar restos light: botones Tipo blancos, chips `bg-emerald-50`/`bg-rose-50`, `bg-slate-50` del ModalHeader, `#CBD5E1` (×4); unificar verdes/rojos a `#4ade80`/`#f87171` (hoy conviven tonos 600 y 400)
- [ ] Unificar los dos flujos "Registrar pago": desde la fila del agente, saldar cargos pendientes (no crear fila auto-balanceada debe=pagado que nunca reduce deuda)
- [ ] Extraer los 6 modales inline a componentes propios (PagosClient: 1849 líneas) sobre el `Modal` compartido
- [ ] Escape también en el modal de eliminar (hoy solo cubre `modal !== "none"`); filas expandibles accesibles por teclado (`aria-expanded`)
- [ ] Usar el template `mensaje_whatsapp` de Configuración en openWhatsApp (hoy hardcodeado — setting muerto)
- [ ] Selector de mes dinámico (no constantes de módulo stale) con navegación ‹ › al historial completo
- [ ] Redondeo/epsilon en saldos flotantes (elimina "- USD 0" con badge EN MORA)
- [ ] `pctGeneral` sin arrastre cuando un grupo no tiene denominador (promediar solo grupos con datos)
- [ ] `loading.tsx` + `error.tsx`

## 4. Cartelería
- [ ] Banner de error visible cuando Airtable falla (hoy muestra "0 carteles" como dato real)
- [ ] Paginación por `offset` en fetchCarteles (hoy trunca en 100 records)
- [ ] Unificar boundary de urgencia (panel / highlight / color usan 3 criterios distintos) en constante compartida
- [ ] Eliminar roster hardcodeado `AGENTES_AIRTABLE` (aviso si Supabase no devuelve agentes)
- [ ] KPI cards clickeables como `<button>` accesible con affordance visual (hoy `<div onClick>`)
- [ ] Skeleton + estado de error en la sección Devueltos
- [ ] Ordenamiento por columnas (Nº, vencimiento, agente)
- [ ] Grid de KPIs responsive; migrar inline styles a clases

## 5. Encuestas
- [ ] Mover los 2 fetches client-side (agentes, operaciones) a `page.tsx` server-side — elimina waterfall, loading intermedio y la dependencia de RLS público
- [ ] Thresholds NPS estándar y consistentes entre color y label (9-10 promotor verde, 7-8 pasivo amber, 0-6 detractor rojo)
- [ ] Fix NPS 0 mostrando "Sin NPS" (`parseInt || null` → check explícito)
- [ ] Colores de texto `#7C3AED`/`#2563EB` → variantes 400 legibles en dark
- [ ] Selector NPS como botonera 0-10 (chips con color por rango) en vez de input number
- [ ] Botón eliminar en filas del historial (cablear `eliminarEncuesta` existente) con confirmación
- [ ] Tendencia NPS por mes (sparkline o barras en el header)
- [ ] Grid de KPIs responsive; filas expandibles accesibles

## 6. Agentes
- [ ] (depende de Fase 0b) Reflejar "Facturación año" real y reporte WhatsApp completo una vez arregladas las queries
- [ ] Feedback de error en el toggle Paga FEE (hoy revierte en silencio si falla)
- [ ] Buscador por nombre sobre la tabla
- [ ] Avatar con color estable por hash del nombre (hoy cambia al reordenar)
- [ ] Fila clickeable → panel de detalle del agente (pagos del mes, ofertas activas, facturación)
- [ ] Confirmación explícita al desactivar un agente
- [ ] Eliminar fetch muerto de `planes_crm` o usarlo para badge de licencia
- [ ] `loading.tsx` + skeleton de tabla

## 7. Operaciones
- [ ] Mostrar indicadores de encuestas en la tabla (`EncuestaIndicator` ya existe, está muerto) + KPI % encuestas ya calculado
- [ ] Manejar error de `eliminarOperacion` en el modal (hoy cierra como si hubiera borrado)
- [ ] Matar `Toggle` light y botones pending `#CBD5E1`
- [ ] Selector de mes completo derivado de los datos (hoy 6 meses hardcodeados)
- [ ] Vista mobile: cards apiladas en vez de tabla con scroll horizontal
- [ ] Mostrar comisión neta en la tabla (se edita pero nunca se ve) o quitarla del form
- [ ] Modal de borrado con contexto (dirección/fecha de la operación)
- [ ] Migrar inline styles a clases

## 8. Facturación
- [ ] **Migrar TODO el módulo al dark theme** (#13131a cards, bordes rgba, modal dark, badges rgba) — único módulo que quedó claro
- [ ] Agregar link en el Sidebar (módulo huérfano)
- [ ] Selector de año (el fix del 2026 hardcodeado en la query es Fase 0b)
- [ ] Variante mobile (cards `md:hidden`) y grid de KPIs responsive
- [ ] Unificar estacionalidad con Resumen/Config en constante compartida
- [ ] Gráfico de barras real vs objetivo por mes
- [ ] KPI de proyección anual (run-rate)
- [ ] `loading.tsx` + `error.tsx`

## 9. Resumen KPI
- [ ] (depende de Fase 0b) Leer las mismas claves de config que Configuración guarda
- [ ] Unificar fuente de facturación real con el módulo Facturación (hoy: comisiones vs carga manual, KPIs contradictorios)
- [ ] Alinear denominador Mainstreet con el criterio de Pagos
- [ ] "N/A" en vez de % ficticio cuando el denominador es 0 (quitar `Math.max(...,1)`)
- [ ] Barras de progreso por KPI + link a cada módulo desde la fila
- [ ] Selector de mes para resúmenes históricos
- [ ] Colores tono-600 → variantes 400; manejo visible de errores de query

## 10. Configuración
- [ ] Inputs numéricos (`type="number"` + min/step) para fees, bonos y objetivos, con validación
- [ ] Agregar las claves que consume Resumen (NPS objetivo, carteles, facturación anual); eliminar claves muertas
- [ ] Dirty state (cambios sin guardar) + confirmación al salir
- [ ] Preview en vivo del mensaje WhatsApp con variables de ejemplo sustituidas
- [ ] Estacionalidad editable (12 campos %, validación suma 100%) en vez de tabla hardcodeada
- [ ] Descripción de qué módulo afecta cada clave; fix bordes del grid (`idx % 2` vs auto-fill)

## 11. Calendario
- [ ] Click en evento → navegar a la oferta/agente correspondiente (hoy cursor pointer sin acción)
- [ ] Deshabilitar solo el botón de la fila en curso (hoy `isPending` bloquea todos)
- [ ] Fallback `loading` en el dynamic import de FullCalendar (skeleton del grid)
- [ ] Layout responsive: panel derecho abajo del calendario en <lg (hoy 70/30 fijo)
- [ ] Fechas en TZ Argentina (hoy `toISOString` UTC corre el día después de las 21:00)
- [ ] Eventos "sin actividad" en su fecha real de último update (hoy apilados todos en hoy)
- [ ] Leyenda con filtros clickeables (toggle cierres / mainstreet / inactivas)
- [ ] (depende de Fase 0b) "Marcar seguimiento" que realmente saque la oferta de inactivas

## 12. Asistente IA
- [ ] **Migrar el panel de chat al dark theme** con tokens `--crm-*` (hoy blanco sobre app oscura, visible en todas las páginas)
- [ ] Estados visuales: typing indicator, error de red con retry, scroll anclado al último mensaje
- [ ] Confirmación explícita antes de ejecutar acciones de escritura (crear pago/oferta) con resumen de qué se va a crear
- [ ] Deshabilitar input mientras hay request en vuelo; cap de historial enviado a Gemini
- [ ] Tipar los 4 `any` de SpeechRecognition
- [ ] Quitar "Nahuel" hardcodeado (leer de config/env)
- [ ] Accesibilidad: `role="log"`/`aria-live` en la lista de mensajes, `aria-label` en botones de micrófono/enviar

---

## Orden de ejecución sugerido

1. **Fase 0a** (componentes compartidos) — todo lo demás la aprovecha
2. **Fase 0b** — solo con OK explícito del usuario (toca server/DB)
3. Módulos 1→12 en el orden de arriba, un commit por módulo, checkbox marcado en el mismo commit
