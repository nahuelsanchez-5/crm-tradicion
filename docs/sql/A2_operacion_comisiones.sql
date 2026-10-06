-- A2 · Reparto de comisiones por operación
-- Correr en Supabase → SQL Editor (una sola vez). Es seguro volver a correrlo.
-- Hasta que se corra, el CRM sigue funcionando igual: el cierre de ofertas no se rompe,
-- solo avisa que no pudo guardar el reparto.

create table if not exists public.operacion_comisiones (
  id              uuid primary key default gen_random_uuid(),
  operacion_id    uuid not null references public.operaciones(id) on delete cascade,
  agente_id       uuid references public.agentes(id),          -- agente interno al que se atribuye
  agente_externo  text,                                         -- referido de otra oficina (informativo)
  rol             text not null
                  check (rol in ('vendedor', 'comprador', 'referido_interno', 'referido_externo')),
  porcentaje      numeric(5,2) check (porcentaje is null or (porcentaje > 0 and porcentaje <= 100)),
  de_agente_id    uuid references public.agentes(id),          -- de quién sale lo cedido (solo referido_interno)
  monto_usd       numeric(14,2) not null check (monto_usd >= 0),
  informativo     boolean not null default false,              -- true = no suma a la facturación
  created_at      timestamptz not null default now(),
  -- una fila es de un agente interno o de un externo, nunca de ambos ni de ninguno
  constraint operacion_comisiones_quien check (
    (agente_id is not null and agente_externo is null)
    or (agente_id is null and agente_externo is not null)
  )
);

create index if not exists operacion_comisiones_operacion_idx on public.operacion_comisiones (operacion_id);
create index if not exists operacion_comisiones_agente_idx    on public.operacion_comisiones (agente_id);

-- El CRM accede con la clave de servidor; se bloquea el acceso directo desde el navegador.
alter table public.operacion_comisiones enable row level security;
