# AUDITORÍA TÉCNICA — CRM Tradición

**Fecha:** 2026-07-03 · **Rama:** mejoras-ui · **Alcance:** todo `src/` (12 módulos, 6 API routes, componentes compartidos, config del proyecto)

## Resumen ejecutivo

- **El hallazgo más grave no es visual: la app no tiene autenticación.** Los 29 server actions y las 6 API routes usan la secret key de Supabase (bypassea RLS) sin verificar sesión. Cualquiera con la URL de producción puede crear/editar/borrar ofertas, pagos, agentes, operaciones, e incluso borrar registros de Airtable.
- **Módulo Agentes tiene 3 queries rotas** que fallan en silencio (columnas inexistentes, fechas inválidas) — la columna "Facturación año" y el reporte WhatsApp nunca funcionaron completos.
- **Facturación es el único módulo que quedó en tema claro** (pre-rediseño) y además está huérfano: no hay link en el Sidebar.
- **Duplicación masiva:** `Field` ×10, estilo `inp` ×10, hook Escape ×9, `fmtUSD` ×7, `fmtFecha` ×8, 910 `style={{}}` inline. Los 9 componentes shadcn/ui de `src/components/ui/` tienen **0 usos** (código muerto), igual que `PageHeader`.
- **Accesibilidad:** 0 `aria-label`, 0 `role="dialog"` en los 29 modales, sin focus-trap, sin `:focus-visible` en botones.
- **Cero `loading.tsx` / `error.tsx`** en las 12 rutas, con `force-dynamic` global: cada navegación bloquea en blanco.

---

## 🔴 CRÍTICOS

### Seguridad

| # | Problema | Archivos |
|---|----------|----------|
| C1 | **Sin autenticación en toda la app**: no existe `middleware.ts`, ni login, ni chequeo de sesión. Server actions y API routes públicos con `SUPABASE_SECRET_KEY` (bypassea RLS). `eliminarOperacion`, `eliminarPago`, `guardarConfig`, `executeAction` del asistente IA y el DELETE de Airtable son invocables por cualquiera. | `src/lib/supabase.ts:21-23`, todos los `actions.ts`, `src/app/api/**` |
| C2 | Se loguean los primeros 10 caracteres de `GEMINI_API_KEY` en cada request (persiste en logs de Vercel); la respuesta 500 filtra `errMsg` + `debug` interno al cliente. | `src/app/api/ai-assistant/route.ts:300-305,385-395` |
| C3 | `SUPABASE_SECRET_KEY` se lee en el mismo archivo que exporta el cliente browser — falta separar `supabase-server.ts` con `import 'server-only'`. | `src/lib/supabase.ts:6` |
| C4 | Fetches REST crudos desde el cliente con publishable key → requiere lectura anónima por RLS de `agentes` y `operaciones` (tablas públicamente legibles). | `src/app/encuestas/EncuestasClient.tsx:145-202` |
| C5 | Cero validación server-side de input: montos negativos aceptados, `estado` de pago calculado por el cliente sin recomputar, `nps` sin rango, `precio_acordado_usd` sin validar, body de `/api/carteleria/devolver` sin tipos. | `pagos/actions.ts`, `encuestas/actions.ts`, `api/operaciones/crear/route.ts`, `api/carteleria/devolver/route.ts` |

### Integridad de datos

| # | Problema | Archivos |
|---|----------|----------|
| C6 | **Cierre de oferta no atómico** (2 pasos: `registrarCierre` + fetch a `/api/operaciones/crear`): sin try/catch en el fetch; el reintento duplica historial y puede duplicar la operación. "Registrar cierre" sigue visible con la oferta ya Cerrada → re-cierre crea segunda operación. | `ofertas/[id]/OfertaDetalleClient.tsx:424-447,507-525` |
| C7 | **TOCTOU en dedup de operaciones**: check `maybeSingle` + insert no atómico; doble click o requests concurrentes crean duplicados. Falta UNIQUE en DB. | `api/operaciones/crear/route.ts:37-49` |
| C8 | **Carrera en `numero` de oferta**: se calcula client-side (`Math.max+1`) sin validación de unicidad server-side; el asistente IA tiene la misma carrera. | `ofertas/OfertasClient.tsx:244-247`, `api/ai-assistant/route.ts:153-186` |
| C9 | Inserts secundarios sin chequeo de error (`ofertas_historial`, `ofertas_checklist`): oferta "Venta" puede quedar sin checklist en silencio; historial puede perderse. | `ofertas/actions.ts:82-98,120-125,184-189`, `api/ai-assistant/route.ts:189-194` |
| C10 | `eliminarPago` borra una sola fila del par gasto+"Crédito aplicado" → corrompe el saldo a favor del agente. `crearGastoConCredito` no verifica el crédito server-side ni es transaccional. | `pagos/actions.ts:100-112,142-176` |
| C11 | La fila "Crédito aplicado" se inserta como `estado: Pagado, monto_pagado: 0, monto_debe: crédito` → infla KPI "Otros cobrados" y muestra deuda inexistente en vista mensual. | `pagos/actions.ts:162-168`, `PagosClient.tsx:399-400,440-442` |
| C12 | `actualizarAgente` pisa `fecha_baja` con la fecha de hoy en CADA edición de un agente inactivo (corrupción de dato histórico). | `agentes/actions.ts:75` |
| C13 | Check-then-insert sin constraint en Facturación: dos submits simultáneos duplican la fila del mes. | `facturacion/actions.ts:20-45` |
| C14 | Transacción distribuida Supabase↔Airtable no atómica en devolución de cartel: si el rollback falla, el cartel queda "devuelto" en Supabase y activo en Airtable. | `api/carteleria/devolver/route.ts:26-50` |

### Bugs de lógica

| # | Problema | Archivos |
|---|----------|----------|
| C15 | **Agentes: 3 queries rotas que fallan en silencio**: (a) `operaciones.agente_vendedor` no existe (la columna es `agentes`), (b) `ofertas.agente_vendedor` no existe (es `agente_vendedor_id`), (c) filtro `.lte("fecha", "YYYY-MM-31")` es fecha inválida en meses de 30 días y febrero → "Facturación año" siempre "—", sort por facturación no-op, reporte WhatsApp incompleto 5 meses al año. | `agentes/page.tsx:31-46` |
| C16 | **Configuración ↔ Resumen desincronizados**: Config guarda `obj_anual_usd`/`obj_facturacion_usd`/`obj_carteleria_pct`/`obj_encuestas_pct` pero Resumen lee `obj_facturacion_anual`/`obj_encuestas_nps`/`obj_carteles` → editar la config nunca afecta el Resumen (corre con defaults hardcodeados). | `configuracion/ConfiguracionClient.tsx:23-27`, `resumen/page.tsx:56,67-69` |
| C17 | **Facturación: año 2026 hardcodeado en la query** mientras el cliente usa `getFullYear()` → el 1/1/2027 el módulo queda roto (grilla vacía). Además ignora `obj_anual_usd` de config (usa `710000` hardcodeado). | `facturacion/page.tsx:10`, `FacturacionClient.tsx:16-21` |
| C18 | **Tres tablas de estacionalidad distintas** (Facturación/Config vs Resumen) y **dos fuentes de verdad** para facturación real (comisiones de operaciones vs `real_usd` manual) → KPIs contradictorios entre módulos. | `FacturacionClient.tsx:18-21`, `resumen/page.tsx:7,51-53`, `ConfiguracionClient.tsx:50` |
| C19 | KPI "Cerradas este mes" usa `updated_at` (cualquier edición cuenta como cierre); `agregarMovimiento` y `marcarSeguimiento` no actualizan `ofertas.updated_at` → las ofertas nunca salen de "Sin actividad +5 días". | `ofertas/OfertasClient.tsx:274`, `ofertas/actions.ts:132-151`, `calendario/actions.ts:6-20` |
| C20 | Cartelería trunca en 100 records (límite de página de Airtable sin offset) y una caída de Airtable muestra "0 carteles activos" sin error (dato falso). | `carteleria/page.tsx:26,37,51-53`, `api/carteleria/listar/route.ts:18` |
| C21 | Fechas en UTC (`toISOString`): en Argentina (UTC-3), de 21:00 a 00:00 la fecha default de formularios, el cutoff de mora y el "hoy" del calendario quedan corridos +1 día. | `PagosClient.tsx:315,416`, `calendario/page.tsx:33` |
| C22 | `findAgent` del asistente IA matchea el PRIMER agente por substring — "pago a Romina" con dos Rominas en el roster asigna el pago a la equivocada sin preguntar. | `api/ai-assistant/route.ts:128-140` |
| C23 | Búsqueda de cartel sin AbortController: respuesta vieja puede pisar el resultado de un número distinto y confirmar la devolución del cartel equivocado. | `DashboardActions.tsx:125-147` |
| C24 | `handleDelete` de Operaciones y `handlePagaFee` de Agentes ignoran el resultado del server action: si falla, la UI cierra como si hubiera funcionado. | `OperacionesClient.tsx:277-284`, `AgentesClient.tsx:290-297` |

---

## 🟡 IMPORTANTES

### Tema / consistencia visual

- **Facturación entera en tema claro** (`background: white`, `#F8F9FC`, `#EAECF2`, texto `#0F172A`, badges `#ECFDF5`/`#FFF1F2` en ~19 lugares) — único módulo sin migrar al rediseño. `FacturacionClient.tsx` (todo el archivo).
- **AIAssistant (panel de chat) entero en tema claro** (`white`, burbujas `#f1f5f9`, `border-slate-200`) — rompe el dark theme en TODAS las páginas. `components/AIAssistant.tsx:227-404`.
- Restos light dispersos: `Toggle` verde-menta `#ECFDF5` (`OfertasClient.tsx:195`, `OperacionesClient.tsx:143` — duplicado), botones pending `#CBD5E1` (6+ lugares en ofertas/operaciones/pagos/carteleria/encuestas/agentes), botones Tipo blancos (`PagosClient.tsx:1432`), chips `bg-emerald-50`/`bg-rose-50`/`bg-slate-50` (`PagosClient.tsx:265,1317,1367,1529`), fallbacks `#F1F5F9`/`#64748B` en badges y empty-states (`OfertasClient.tsx:127,576,673`).
- Colores tono-600 (`#059669`, `#E11D48`, `#D97706`, `#7C3AED`, `#2563EB`) usados como texto sobre `#13131a` — contraste insuficiente; el estándar del redesign son las variantes 400 (`#4ade80`, `#f87171`, `#fbbf24`, `#a78bfa`, `#60a5fa`). `PagosClient.tsx` (7 lugares), `ResumenClient.tsx:23-25`, `EncuestasClient.tsx:586-587`.
- Doble sistema de estilado: Dashboard usa clases `crm-*`, Ofertas/Operaciones/Cartelería/Encuestas/Agentes usan ~95% inline styles (910 `style={{}}` en 16 archivos) con valores levemente distintos (ej. inputs `#1e1e2e` vs `rgba(255,255,255,0.06)`) → inputs y botones inconsistentes entre módulos, y sin estados hover/focus (inline no soporta pseudo-clases).
- Tokens shadcn de `:root` son **light theme** y la clase `.dark` nunca se aplica al `<html>` → si se adoptan los componentes ui/ saldrían claros. `globals.css:51-130`, `layout.tsx:31`.

### Estados UX (loading / empty / error)

- **Cero `loading.tsx` y `error.tsx`** en las 12 rutas + `force-dynamic` global → cada navegación bloquea sin feedback. `Skeleton` de ui/ existe y no se usa.
- Errores de Supabase silenciados en todas las pages (se destructura `{ data }` sin chequear `error`): un fallo de DB renderiza módulo vacío/KPIs en 0 como si fuera dato real. `page.tsx` de dashboard (11 queries), pagos, facturación, resumen, agentes, ofertas, operaciones.
- FullCalendar con `dynamic({ ssr: false })` sin fallback `loading` → hueco en blanco. `CalendarioClient.tsx:10`.
- Toast de confirmación solo existe en cartelería del dashboard; pagos/ofertas/operaciones guardan sin confirmación visual.

### Accesibilidad

- 0 `role="dialog"` / `aria-modal` / focus-trap / retorno de foco en los **29 modales** de la app; botones X sin `aria-label`.
- `Field` renderiza `<label>` sin `htmlFor` en los 10 archivos que lo duplican; toggles sin `aria-pressed`; toast sin `role="status"`.
- Elementos interactivos no accesibles: KPI cards clickeables como `<div onClick>` (`CarteleriaClient.tsx:365-390`), filas expandibles `<tr onClick>` sin teclado ni `aria-expanded` (`PagosClient.tsx:931,1090`, `EncuestasClient.tsx:401`).
- Sidebar: `<nav>` sin `aria-label`, link activo sin `aria-current="page"`; clases `.crm-btn-*` sin `:focus-visible`. Los únicos estilos focus-visible del proyecto están en los componentes shadcn muertos.
- Contraste: `rgba(255,255,255,0.35)` sobre `#13131a` ≈ 3.4:1 en textos de 10-12px (falla WCAG AA).

### Performance

- `force-dynamic` + query Supabase bloqueante en el **root layout** (badge de agentes del sidebar) en cada navegación de cada página; duplica queries del dashboard (3 queries para el mismo dato). `layout.tsx:1,24-28`.
- Queries sin `limit` ni paginación en ofertas y operaciones (traen TODO el histórico en cada render). `ofertas/page.tsx:11-16`, `operaciones/page.tsx:9-12`.
- Waterfall en Encuestas: page server-side + 2 fetches client-side al montar. `EncuestasClient.tsx:145-202`.
- `DolarWidget` fetchea la API externa desde cada cliente cada 30 min sin cache server-side. `DolarWidget.tsx:21`.
- `agenteMap` sin `useMemo` en el detalle de oferta; varios `setTimeout` sin cleanup en unmount (ofertas, pagos, carteleria, configuracion).

### Inconsistencias funcionales

- Dominio `tipo_operacion` inconsistente: "Alquiler Temporario" (detalle) vs "Alquiler Temporal" (dashboard) vs solo Venta/Alquiler (alta y filtros) — las temporales escapan a los filtros; editar Alquiler→Venta no crea checklist. `OfertaDetalleClient.tsx:98`, `OfertasClient.tsx:488-492,791`, `api/operaciones/crear/route.ts:94`.
- Dos flujos "Registrar Pago" con semántica distinta: el global crea fila auto-balanceada (`debe=pagado`, nunca reduce deuda), el de fila sí salda. `PagosClient.tsx:584-601`.
- Denominador Mainstreet distinto entre Resumen (todos los activos) y Pagos (solo con `fecha_mainstreet` del mes) → mismo KPI, % distintos. `resumen/page.tsx:87` vs `PagosClient.tsx:388-392`.
- `pctGeneral = (fee+crm+main)/3` con mainTotal=0 arrastra la cobranza general a máx 67%. `PagosClient.tsx:402`.
- Thresholds NPS inconsistentes: verde con ≥8 pero label "Promotor" solo ≥9; NPS 0 muestra "Sin NPS" (`parseInt(x) || null`). `EncuestasClient.tsx:40-52,685-687`.
- Cartelería: tres boundaries distintos para "urgente" (>30/≥10 vs ≤10 vs <10); roster `AGENTES_AIRTABLE` hardcodeado (23 nombres) que deriva de Supabase. `CarteleriaClient.tsx:40-49,67-77,176,607`.
- Dashboard: "Pagos pendientes — {mes}" no filtra por mes (muestra históricos); trends de KpiCard falsos ("Sin cambios" hardcodeado, flecha siempre ↑). `page.tsx:220,315`.
- `mensaje_whatsapp` de Configuración nunca se usa (está hardcodeado en Pagos); inputs numéricos de config como `type="text"` sin validación (guardar "abc" en fee → default silencioso). `ConfiguracionClient.tsx:29-34,210-215`.
- Config guardada que se ignora: `objetivo_usd` persistido en facturación se recalcula siempre; claves muertas `obj_facturacion_usd`, `obj_carteleria_pct`.
- Encuestas/operaciones: `EncuestaIndicator` + `stats.pctEncuestas` calculados y nunca renderizados; modal "encuesta" del dashboard es código muerto. `OperacionesClient.tsx:89-102`, `DashboardActions.tsx:298,455-473`.
- Filtro de mes limitado a 6 meses hardcodeados y stale (constantes de módulo que no cruzan el cambio de mes/día con la pestaña abierta). `OperacionesClient.tsx:202-215`, `PagosClient.tsx:14-27`, `OfertasClient.tsx:99-104`.
- `/facturacion` huérfano: sin link en el Sidebar.
- Responsive: header del detalle de oferta desborda en mobile; Facturación y Calendario sin variante mobile; KPI grids `repeat(N,1fr)` fijos en cartelería/encuestas/facturación.

---

## 🟢 MEJORAS (deuda técnica y UX)

### Código muerto
- `src/components/ui/` completo: 9 componentes shadcn, 536 líneas, **0 imports**.
- `PageHeader.tsx`: 0 usos (8 módulos hand-rollean el header).
- `devolverCartel` en `carteleria/actions.ts:64` (el flujo real usa la API route); `eliminarEncuesta`/`guardarEncuesta` sin UI; fetch de `planes_crm` en agentes sin uso; `EncuestaIndicator` y modal "encuesta" muertos.

### Duplicación (métricas cross-module)
| Qué | Cuántas veces |
|-----|---------------|
| `function Field` | 10 |
| `const inp` (estilo input) | 10 |
| Hook Escape-para-cerrar | 9 |
| `fmtFecha`/`fmtDate` | 8 |
| `fmtUSD` (implementaciones distintas) | 7 |
| `MONTH_NAMES` | 5 |
| `Toggle` switch | 3 |
| Shells de modal propios | 3 |
| `style={{}}` inline | 910 (récord: PagosClient 158) |
| `getConceptGroup` (clasificación frágil por substring) | 2 |
| `ESTADO_STYLE` íntegro | 2 |

### Archivos monolíticos
`PagosClient.tsx` 1849 líneas (6 modales inline) · `OfertaDetalleClient.tsx` 1286 (4 modales) · `CarteleriaClient.tsx` ~1100 · `OfertasClient.tsx` 976 · `AgentesClient.tsx` 816 · `OperacionesClient.tsx` 782 · `EncuestasClient.tsx` 751 · `DashboardActions.tsx` 616.

### Otros
- Montos monetarios como floats JS en toda la cadena (sumas con residuos → "- USD 0" con badge EN MORA); comparaciones `> 0` sin epsilon.
- Magic numbers: mora 15 días, cutoff 5 días (×3), comisión 3% (×2), bonos USD 100, `710000` (×4), 180 días paga_fee, debounce 600ms, toasts 1000/4000ms.
- Casts `as unknown as` sobre respuestas Supabase sin validación (sin zod en el proyecto); tipos `Agente`/`PagoRow` redefinidos por módulo (falta `src/lib/types.ts`).
- `console.*` olvidados (7 en ai-assistant, 2 en encuestas); "Nahuel" hardcodeado en 3 lugares; `gemini-1.5-flash` stale en metadata de debug.
- `next.config.ts` vacío (sin headers de seguridad); `tsconfig` target ES2017; `shadcn` CLI como dependencia de runtime.
- `revalidatePath` + `router.refresh()` = doble invalidación en todos los módulos.
- Avatar de agente coloreado por índice del sort (identidad visual inestable).

---

## Nota sobre alcance

Los CRÍTICOS C1-C14 requieren tocar server actions, API routes y/o agregar constraints en DB — cosas que la regla 2 de CLAUDE.md protege. **Se documentan acá y se listan como "Fase 0" en PLAN_MEJORAS.md para decisión explícita del usuario antes de encarar cualquiera.** El resto del plan es UI/UX puro y no toca DB ni APIs que funcionan.
