-- ================================================================
-- REMAX Tradición CRM — Migración inicial
-- Fecha: 2026-05-27
-- ================================================================

-- ── Extensiones ─────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Función genérica para auto-actualizar updated_at ────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ================================================================
-- 1. AGENTES
-- ================================================================
CREATE TABLE agentes (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT          NOT NULL,
  email       TEXT          UNIQUE,
  telefono    TEXT,
  fecha_alta  DATE          NOT NULL DEFAULT CURRENT_DATE,
  fecha_baja  DATE,
  activo      BOOLEAN       NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_agentes_updated_at
  BEFORE UPDATE ON agentes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ================================================================
-- 2. PLANES_CRM
-- ================================================================
CREATE TABLE planes_crm (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id   UUID          NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  mes         SMALLINT      NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio        SMALLINT      NOT NULL,
  tipo_plan   TEXT          NOT NULL CHECK (tipo_plan IN ('PRO', 'PRO+', 'B_QR', 'B_OFI')),
  pagado      BOOLEAN       NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (agente_id, mes, anio)
);

CREATE TRIGGER trg_planes_crm_updated_at
  BEFORE UPDATE ON planes_crm
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ================================================================
-- 3. PAGOS
-- ================================================================
CREATE TABLE pagos (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id     UUID          NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  fecha         DATE          NOT NULL DEFAULT CURRENT_DATE,
  concepto      TEXT          NOT NULL,
  monto_debe    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monto_debe >= 0),
  monto_pagado  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monto_pagado >= 0),
  estado        TEXT          NOT NULL CHECK (estado IN ('Pagado', 'Parcial', 'Pendiente')),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_pagos_updated_at
  BEFORE UPDATE ON pagos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ================================================================
-- 4. CARTELES
-- ================================================================
CREATE TABLE carteles (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  mes                 SMALLINT      NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio                SMALLINT      NOT NULL,
  total_entregados    INTEGER       NOT NULL DEFAULT 0 CHECK (total_entregados >= 0),
  total_recuperados   INTEGER       NOT NULL DEFAULT 0 CHECK (total_recuperados >= 0),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (mes, anio)
);

CREATE TRIGGER trg_carteles_updated_at
  BEFORE UPDATE ON carteles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ================================================================
-- 5. ENCUESTAS
-- ================================================================
CREATE TABLE encuestas (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  mes                 SMALLINT      NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio                SMALLINT      NOT NULL,
  total_enviadas      INTEGER       NOT NULL DEFAULT 0 CHECK (total_enviadas >= 0),
  total_respondidas   INTEGER       NOT NULL DEFAULT 0 CHECK (total_respondidas >= 0),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (mes, anio)
);

CREATE TRIGGER trg_encuestas_updated_at
  BEFORE UPDATE ON encuestas
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ================================================================
-- 6. OPERACIONES
-- ================================================================
CREATE TABLE operaciones (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha           DATE          NOT NULL DEFAULT CURRENT_DATE,
  direccion       TEXT          NOT NULL,
  agentes         TEXT          NOT NULL,   -- Texto libre: "Romina Prieto / Cecilia Frigerio"
  tipo            TEXT          NOT NULL CHECK (tipo IN ('Venta', 'Alquiler', 'Alquiler Temporal', 'Otro')),
  comision_bruta  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (comision_bruta >= 0),
  comision_neta   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (comision_neta >= 0),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_operaciones_updated_at
  BEFORE UPDATE ON operaciones
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ================================================================
-- 7. FACTURACION
-- ================================================================
CREATE TABLE facturacion (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  mes           SMALLINT      NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio          SMALLINT      NOT NULL,
  objetivo_usd  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (objetivo_usd >= 0),
  real_usd      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (real_usd >= 0),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (mes, anio)
);

CREATE TRIGGER trg_facturacion_updated_at
  BEFORE UPDATE ON facturacion
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ================================================================
-- 8. CONFIG
-- ================================================================
CREATE TABLE config (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clave       TEXT          NOT NULL UNIQUE,
  valor       TEXT          NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_config_updated_at
  BEFORE UPDATE ON config
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ================================================================
-- ÍNDICES DE PERFORMANCE
-- ================================================================
CREATE INDEX idx_planes_crm_agente     ON planes_crm (agente_id);
CREATE INDEX idx_planes_crm_mes_anio   ON planes_crm (mes, anio);
CREATE INDEX idx_pagos_agente          ON pagos (agente_id);
CREATE INDEX idx_pagos_estado          ON pagos (estado);
CREATE INDEX idx_operaciones_fecha     ON operaciones (fecha);
CREATE INDEX idx_facturacion_mes_anio  ON facturacion (mes, anio);


-- ================================================================
-- DATOS DE EJEMPLO
-- ================================================================

-- ── Agentes ─────────────────────────────────────────────────────
INSERT INTO agentes (id, nombre, email, telefono, fecha_alta, activo) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Sapo Pagano',           'sapo.pagano@remax.com.ar',           '+54 9 362 400-1001', '2022-01-15', true),
  ('00000000-0000-0000-0000-000000000002', 'Romina Prieto',         'romina.prieto@remax.com.ar',         '+54 9 362 400-1002', '2021-03-20', true),
  ('00000000-0000-0000-0000-000000000003', 'Cecilia Frigerio',      'cecilia.frigerio@remax.com.ar',      '+54 9 362 400-1003', '2020-07-10', true),
  ('00000000-0000-0000-0000-000000000004', 'Jelena Capitanich',     'jelena.capitanich@remax.com.ar',     '+54 9 362 400-1004', '2021-11-05', true),
  ('00000000-0000-0000-0000-000000000005', 'Aleli Portillo',        'aleli.portillo@remax.com.ar',        '+54 9 362 400-1005', '2022-04-18', true),
  ('00000000-0000-0000-0000-000000000006', 'Silvana Ameri',         'silvana.ameri@remax.com.ar',         '+54 9 362 400-1006', '2020-09-01', true),
  ('00000000-0000-0000-0000-000000000007', 'Marcela Matijasevich',  'marcela.matijasevich@remax.com.ar',  '+54 9 362 400-1007', '2019-06-12', true),
  ('00000000-0000-0000-0000-000000000008', 'Analia Olivero',        'analia.olivero@remax.com.ar',        '+54 9 362 400-1008', '2023-01-09', true),
  ('00000000-0000-0000-0000-000000000009', 'Anabella Yñiguez',      'anabella.yniguez@remax.com.ar',      '+54 9 362 400-1009', '2022-08-22', true),
  ('00000000-0000-0000-0000-000000000010', 'Mabel Chamorro',        'mabel.chamorro@remax.com.ar',        '+54 9 362 400-1010', '2021-05-14', true),
  ('00000000-0000-0000-0000-000000000011', 'Vanina Bravo',          'vanina.bravo@remax.com.ar',          '+54 9 362 400-1011', '2023-03-07', true),
  ('00000000-0000-0000-0000-000000000012', 'Florencia Ciacovschi',  'florencia.ciacovschi@remax.com.ar',  '+54 9 362 400-1012', '2022-11-30', true);


-- ── Planes CRM — Mayo 2026 (mes actual) ─────────────────────────
INSERT INTO planes_crm (agente_id, mes, anio, tipo_plan, pagado) VALUES
  ('00000000-0000-0000-0000-000000000001', 5, 2026, 'PRO+',  true),
  ('00000000-0000-0000-0000-000000000002', 5, 2026, 'PRO',   true),
  ('00000000-0000-0000-0000-000000000003', 5, 2026, 'PRO+',  false),
  ('00000000-0000-0000-0000-000000000004', 5, 2026, 'B_QR',  true),
  ('00000000-0000-0000-0000-000000000005', 5, 2026, 'PRO',   true),
  ('00000000-0000-0000-0000-000000000006', 5, 2026, 'B_OFI', false),
  ('00000000-0000-0000-0000-000000000007', 5, 2026, 'PRO+',  true),
  ('00000000-0000-0000-0000-000000000008', 5, 2026, 'PRO',   false),
  ('00000000-0000-0000-0000-000000000009', 5, 2026, 'B_QR',  true),
  ('00000000-0000-0000-0000-000000000010', 5, 2026, 'PRO',   true),
  ('00000000-0000-0000-0000-000000000011', 5, 2026, 'PRO+',  false),
  ('00000000-0000-0000-0000-000000000012', 5, 2026, 'B_OFI', true);

-- ── Planes CRM — Abril 2026 ──────────────────────────────────────
INSERT INTO planes_crm (agente_id, mes, anio, tipo_plan, pagado) VALUES
  ('00000000-0000-0000-0000-000000000001', 4, 2026, 'PRO+',  true),
  ('00000000-0000-0000-0000-000000000002', 4, 2026, 'PRO',   true),
  ('00000000-0000-0000-0000-000000000003', 4, 2026, 'PRO+',  true),
  ('00000000-0000-0000-0000-000000000004', 4, 2026, 'B_QR',  true),
  ('00000000-0000-0000-0000-000000000005', 4, 2026, 'PRO',   true),
  ('00000000-0000-0000-0000-000000000006', 4, 2026, 'B_OFI', true),
  ('00000000-0000-0000-0000-000000000007', 4, 2026, 'PRO+',  true),
  ('00000000-0000-0000-0000-000000000008', 4, 2026, 'PRO',   true),
  ('00000000-0000-0000-0000-000000000009', 4, 2026, 'B_QR',  true),
  ('00000000-0000-0000-0000-000000000010', 4, 2026, 'PRO',   true),
  ('00000000-0000-0000-0000-000000000011', 4, 2026, 'PRO+',  true),
  ('00000000-0000-0000-0000-000000000012', 4, 2026, 'B_OFI', false);

-- ── Planes CRM — Marzo 2026 ──────────────────────────────────────
INSERT INTO planes_crm (agente_id, mes, anio, tipo_plan, pagado) VALUES
  ('00000000-0000-0000-0000-000000000001', 3, 2026, 'PRO+',  true),
  ('00000000-0000-0000-0000-000000000002', 3, 2026, 'PRO',   true),
  ('00000000-0000-0000-0000-000000000003', 3, 2026, 'PRO',   true),
  ('00000000-0000-0000-0000-000000000004', 3, 2026, 'B_QR',  true),
  ('00000000-0000-0000-0000-000000000005', 3, 2026, 'PRO',   true),
  ('00000000-0000-0000-0000-000000000006', 3, 2026, 'B_OFI', true),
  ('00000000-0000-0000-0000-000000000007', 3, 2026, 'PRO+',  true),
  ('00000000-0000-0000-0000-000000000008', 3, 2026, 'PRO',   true),
  ('00000000-0000-0000-0000-000000000009', 3, 2026, 'B_QR',  false),
  ('00000000-0000-0000-0000-000000000010', 3, 2026, 'PRO',   true),
  ('00000000-0000-0000-0000-000000000011', 3, 2026, 'PRO+',  true),
  ('00000000-0000-0000-0000-000000000012', 3, 2026, 'B_OFI', true);


-- ── Pagos ────────────────────────────────────────────────────────
INSERT INTO pagos (agente_id, fecha, concepto, monto_debe, monto_pagado, estado) VALUES
  -- Pendientes mayo 2026
  ('00000000-0000-0000-0000-000000000003', '2026-05-10', 'Plan PRO+ Mayo 2026',           15000.00,     0.00, 'Pendiente'),
  ('00000000-0000-0000-0000-000000000006', '2026-05-10', 'Plan B_OFI Mayo 2026',           8000.00,     0.00, 'Pendiente'),
  ('00000000-0000-0000-0000-000000000011', '2026-05-10', 'Plan PRO+ Mayo 2026',           15000.00,     0.00, 'Pendiente'),
  -- Parciales mayo 2026
  ('00000000-0000-0000-0000-000000000008', '2026-05-10', 'Plan PRO Mayo 2026',            12000.00,  6000.00, 'Parcial'),
  -- Pagados mayo 2026
  ('00000000-0000-0000-0000-000000000001', '2026-05-01', 'Plan PRO+ Mayo 2026',           15000.00, 15000.00, 'Pagado'),
  ('00000000-0000-0000-0000-000000000002', '2026-05-02', 'Plan PRO Mayo 2026',            12000.00, 12000.00, 'Pagado'),
  ('00000000-0000-0000-0000-000000000004', '2026-05-03', 'Plan B_QR Mayo 2026',            6000.00,  6000.00, 'Pagado'),
  ('00000000-0000-0000-0000-000000000005', '2026-05-04', 'Plan PRO Mayo 2026',            12000.00, 12000.00, 'Pagado'),
  ('00000000-0000-0000-0000-000000000007', '2026-05-05', 'Plan PRO+ Mayo 2026',           15000.00, 15000.00, 'Pagado'),
  ('00000000-0000-0000-0000-000000000009', '2026-05-06', 'Plan B_QR Mayo 2026',            6000.00,  6000.00, 'Pagado'),
  ('00000000-0000-0000-0000-000000000010', '2026-05-07', 'Plan PRO Mayo 2026',            12000.00, 12000.00, 'Pagado'),
  ('00000000-0000-0000-0000-000000000012', '2026-05-08', 'Plan B_OFI Mayo 2026',           8000.00,  8000.00, 'Pagado'),
  -- Deuda anterior (abril)
  ('00000000-0000-0000-0000-000000000012', '2026-04-05', 'Plan B_OFI Abril 2026',          8000.00,     0.00, 'Pendiente');


-- ── Carteles ─────────────────────────────────────────────────────
INSERT INTO carteles (mes, anio, total_entregados, total_recuperados) VALUES
  (1, 2026, 45, 38),
  (2, 2026, 48, 31),
  (3, 2026, 52, 40),
  (4, 2026, 55, 43),
  (5, 2026, 50, 22);  -- mes en curso, recuperados parciales


-- ── Encuestas ────────────────────────────────────────────────────
INSERT INTO encuestas (mes, anio, total_enviadas, total_respondidas) VALUES
  (1, 2026, 16,  9),
  (2, 2026, 18, 11),
  (3, 2026, 20, 15),
  (4, 2026, 22, 17),
  (5, 2026, 19,  8);  -- mes en curso


-- ── Operaciones ──────────────────────────────────────────────────
INSERT INTO operaciones (fecha, direccion, agentes, tipo, comision_bruta, comision_neta) VALUES
  ('2026-05-15', 'Av. San Martín 1250, Resistencia',     'Romina Prieto / Cecilia Frigerio',   'Venta',    4500.00, 3825.00),
  ('2026-05-20', 'Salta 870, Resistencia',               'Sapo Pagano',                        'Alquiler',  800.00,  680.00),
  ('2026-04-10', 'French 2340, Resistencia',             'Marcela Matijasevich',               'Venta',    6200.00, 5270.00),
  ('2026-04-22', 'Mitre 450, Resistencia',               'Jelena Capitanich / Vanina Bravo',   'Venta',    3900.00, 3315.00),
  ('2026-04-05', 'Av. Alvear 660, Resistencia',          'Aleli Portillo',                     'Alquiler',  650.00,  552.50),
  ('2026-03-18', 'Pellegrini 1100, Resistencia',         'Silvana Ameri',                      'Alquiler',  950.00,  807.50),
  ('2026-03-25', 'Av. Castelli 560, Resistencia',        'Analia Olivero',                     'Venta',    5100.00, 4335.00),
  ('2026-03-07', 'España 1450, Resistencia',             'Anabella Yñiguez / Mabel Chamorro',  'Venta',    8200.00, 6970.00),
  ('2026-02-14', 'Brown 790, Resistencia',               'Florencia Ciacovschi',               'Venta',    4200.00, 3570.00),
  ('2026-02-28', 'López y Planes 333, Resistencia',      'Aleli Portillo / Mabel Chamorro',    'Venta',    7800.00, 6630.00),
  ('2026-01-20', 'Marcelo T. de Alvear 280, Resistencia','Sapo Pagano / Romina Prieto',        'Venta',    9500.00, 8075.00),
  ('2026-01-31', 'Güemes 1870, Resistencia',             'Vanina Bravo',                       'Alquiler',  720.00,  612.00);


-- ── Facturación ──────────────────────────────────────────────────
INSERT INTO facturacion (mes, anio, objetivo_usd, real_usd) VALUES
  (1, 2026, 25000.00, 22400.00),
  (2, 2026, 25000.00, 27800.00),
  (3, 2026, 28000.00, 26100.00),
  (4, 2026, 28000.00, 31200.00),
  (5, 2026, 30000.00, 14500.00);  -- mes en curso


-- ── Config ───────────────────────────────────────────────────────
INSERT INTO config (clave, valor) VALUES
  ('objetivo_mensual_usd',            '28000'),
  ('precio_plan_pro_ars',             '12000'),
  ('precio_plan_pro_plus_ars',        '15000'),
  ('precio_plan_b_qr_ars',            '6000'),
  ('precio_plan_b_ofi_ars',           '8000'),
  ('bono_b_qr_usd',                   '50'),
  ('bono_b_ofi_usd',                  '80'),
  ('meta_encuestas_pct',              '70'),
  ('meta_carteles_recuperados_pct',   '75'),
  ('moneda_principal',                'USD'),
  ('nombre_oficina',                  'REMAX Tradición');
