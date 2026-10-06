-- A3b · Dejar a TODOS los agentes en "Paga FEE = Automático"
-- Correr en Supabase → SQL Editor. Es seguro volver a correrlo.
--
-- "Automático" (paga_fee = null) significa: paga FEE el agente que cumple 180 días de antigüedad
-- (con la regla de quincena). Un valor true/false es una marca manual que gana sobre la antigüedad.
-- Después de correr esto, los que no deban seguir la regla se cambian desde Agentes → Editar → Paga FEE
-- (o con un UPDATE puntual, ver ejemplos al final).

-- 1) La columna tiene que aceptar "sin marca" y no asignar un valor por defecto a los agentes nuevos
alter table public.agentes alter column paga_fee drop not null;
alter table public.agentes alter column paga_fee drop default;

-- 2) Todos en automático
update public.agentes set paga_fee = null;

-- 3) Control: tiene que dar una sola fila con paga_fee vacío y la cantidad total de agentes
select paga_fee, count(*) as agentes from public.agentes group by paga_fee;

-- ── Ejemplos para después (NO correr ahora) ─────────────────────────────────────────────
-- Marcar a mano que un agente SIEMPRE paga FEE:
--   update public.agentes set paga_fee = true  where nombre = 'Nombre del agente';
-- Marcar a mano que un agente NUNCA paga FEE:
--   update public.agentes set paga_fee = false where nombre = 'Nombre del agente';
-- Volver uno a automático:
--   update public.agentes set paga_fee = null  where nombre = 'Nombre del agente';
