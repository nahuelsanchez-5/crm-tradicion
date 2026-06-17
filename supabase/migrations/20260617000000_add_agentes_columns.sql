-- Agrega columnas a agentes que fueron referenciadas en el código
-- pero no incluidas en la migración inicial.
ALTER TABLE agentes
  ADD COLUMN IF NOT EXISTS paga_fee         BOOLEAN,
  ADD COLUMN IF NOT EXISTS tipo_plan        TEXT,
  ADD COLUMN IF NOT EXISTS fecha_mainstreet DATE;
