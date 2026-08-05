# CRM Tradición — Contexto para Claude Code

CRM interno de RE/MAX Tradición (Resistencia, Chaco). Usuario: Nahuel Sánchez (admin).
Stack: Next.js 16 App Router + TypeScript estricto + Tailwind CSS v4 + shadcn/ui.
DB: Supabase. Integraciones: Airtable (cartelería), Gemini 3.5 Flash (asistente IA),
dolarapi.com (widget dólar). Hosting: Vercel, deploy automático desde master.
Tema: dark glassmorphism (#0a0a1a fondo, #13131a cards). NO reemplazar, solo refinar.

## Proyecto activo: Mejora visual y UX integral
- Plan maestro: PLAN_MEJORAS.md (checkboxes = estado real del avance)
- Auditoría: AUDITORIA.md
- Todo se commitea directo a master.

## Reglas no negociables
1. No romper funcionalidad existente
2. No cambiar estructura de DB ni API routes que funcionan
3. npm run build sin errores antes de cada commit
4. Un commit por módulo, mensaje descriptivo
5. Al terminar un módulo: marcar su checkbox en PLAN_MEJORAS.md en el mismo commit
6. shadcn/ui como base de componentes

## Criterio de calidad visual
Jerarquía tipográfica consistente, spacing escala 4/8px, estados
hover/focus/loading/empty en todo, transiciones 150-250ms, skeletons en cargas.

---

@AGENTS.md

## gstack

For all web browsing, use the /browse skill from gstack. Never use mcp__claude-in-chrome__* tools.

Available gstack skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy, /canary, /benchmark, /browse, /connect-chrome, /qa, /qa-only, /design-review, /setup-browser-cookies, /setup-deploy, /setup-gbrain, /retro, /investigate, /document-release, /document-generate, /codex, /cso, /autoplan, /plan-devex-review, /devex-review, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade, /learn
