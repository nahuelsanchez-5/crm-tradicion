-- A5 · Cierre de oferta "todo o nada"
-- Correr en Supabase → SQL Editor (una sola vez). Es seguro volver a correrlo.
-- Requiere haber corrido antes el script A2 (tabla operacion_comisiones).
--
-- Qué hace:
--  1) Vincula cada operación con la oferta que la originó (operaciones.oferta_id, única por oferta).
--  2) Crea la función cerrar_oferta(): cierra la oferta, anota el historial, crea la operación y guarda
--     el reparto de comisiones EN UNA SOLA TRANSACCIÓN. Si algo falla, no queda nada a medias.
-- Hasta que se corra, el CRM sigue cerrando ofertas como antes (en pasos separados).

-- 1) Vínculo operación → oferta (las operaciones viejas quedan con oferta_id vacío)
alter table public.operaciones
  add column if not exists oferta_id uuid references public.ofertas(id) on delete set null;

-- Una oferta solo puede tener una operación (los valores vacíos no cuentan)
create unique index if not exists operaciones_oferta_id_uniq
  on public.operaciones (oferta_id) where oferta_id is not null;

-- 2) Cierre atómico
create or replace function public.cerrar_oferta(
  p_oferta_id   uuid,
  p_fecha       date,
  p_precio      numeric,
  p_descripcion text,
  p_operacion   jsonb,   -- { fecha, direccion, agentes, tipo, comision_bruta }
  p_reparto     jsonb    -- [ { agente_id, agente_externo, rol, porcentaje, de_agente_id, monto_usd, informativo } ]
) returns uuid
language plpgsql
as $$
declare
  v_estado text;
  v_op_id  uuid;
begin
  -- Bloquea la fila para que dos cierres simultáneos no se pisen
  select estado into v_estado from public.ofertas where id = p_oferta_id for update;
  if not found then raise exception 'OFERTA_NO_ENCONTRADA'; end if;
  if v_estado = 'Cerradas' then raise exception 'OFERTA_YA_CERRADA'; end if;

  update public.ofertas
     set estado = 'Cerradas', fecha_cierre = p_fecha, valor_escritura_usd = p_precio
   where id = p_oferta_id;

  insert into public.ofertas_historial (oferta_id, tipo, descripcion, monto_usd)
  values (p_oferta_id, 'Cambio de estado', p_descripcion, p_precio);

  insert into public.operaciones (fecha, direccion, agentes, tipo, comision_bruta, comision_neta, oferta_id)
  values (
    (p_operacion->>'fecha')::date,
    p_operacion->>'direccion',
    p_operacion->>'agentes',
    p_operacion->>'tipo',
    (p_operacion->>'comision_bruta')::numeric,
    (p_operacion->>'comision_bruta')::numeric,
    p_oferta_id
  )
  returning id into v_op_id;

  if p_reparto is not null and jsonb_array_length(p_reparto) > 0 then
    insert into public.operacion_comisiones
      (operacion_id, agente_id, agente_externo, rol, porcentaje, de_agente_id, monto_usd, informativo)
    select v_op_id,
           nullif(r->>'agente_id', '')::uuid,
           nullif(r->>'agente_externo', ''),
           r->>'rol',
           nullif(r->>'porcentaje', '')::numeric,
           nullif(r->>'de_agente_id', '')::uuid,
           (r->>'monto_usd')::numeric,
           coalesce((r->>'informativo')::boolean, false)
      from jsonb_array_elements(p_reparto) r;
  end if;

  return v_op_id;
end;
$$;

-- Control: tiene que devolver una fila con la función creada
select proname from pg_proc where proname = 'cerrar_oferta';
