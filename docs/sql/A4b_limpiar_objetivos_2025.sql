-- A4b · Limpiar los objetivos que se guardaron de más en 2025
-- Correr en Supabase → SQL Editor, un bloque por vez, en este orden.
--
-- Contexto: 2025 no tiene objetivo anual propio. Una versión anterior del CRM guardó, al mirar 2025,
-- filas con el objetivo de 2026 (710.000 × estacionalidad). Esto las deja sin objetivo.

-- 1) REVISAR primero qué hay guardado en 2025 (no modifica nada)
select id, mes, anio, objetivo_usd, real_usd
from public.facturacion
where anio = 2025
order by mes;

-- 2) Borrar las filas de 2025 que NO tienen facturación real cargada (las creó el sistema solo para guardar el objetivo)
delete from public.facturacion
where anio = 2025
  and coalesce(real_usd, 0) = 0;

-- 3) A las que sí tienen facturación real cargada, dejarles el objetivo en 0 ("sin objetivo")
update public.facturacion
set objetivo_usd = 0
where anio = 2025;

-- 4) Control: tiene que quedar solo lo que cargaste a mano, con objetivo_usd = 0
select mes, objetivo_usd, real_usd
from public.facturacion
where anio = 2025
order by mes;
