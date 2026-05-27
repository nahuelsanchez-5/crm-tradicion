-- ================================================================
-- Agrega columnas de encuestas a la tabla operaciones
-- y expande el CHECK de tipo para incluir 'Referido'
-- ================================================================

ALTER TABLE operaciones
  ADD COLUMN IF NOT EXISTS encuesta_comprador BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS encuesta_vendedor  BOOLEAN NOT NULL DEFAULT false;

-- Expandir constraint de tipo para incluir Referido
ALTER TABLE operaciones DROP CONSTRAINT IF EXISTS operaciones_tipo_check;
ALTER TABLE operaciones
  ADD CONSTRAINT operaciones_tipo_check
    CHECK (tipo IN ('Venta', 'Alquiler', 'Alquiler Temporal', 'Referido', 'Otro'));
