/**
 * COI compliance domain — company-specific schema types.
 *
 * No ORM — raw SQL via pg pool. These types describe the Postgres tables
 * created by the migration below. The substrate schema-concatenation step
 * reads this file at build time.
 *
 * Tables:
 *   coi_vendors               — contractors / service providers
 *   coi_properties            — managed units / HOA communities
 *   coi_vendor_properties     — many-to-many vendor ↔ property assignments
 */

// ── Row shapes (match Postgres column names) ─────────────────────────────────

export interface VendorRow {
  id: string;
  org_id: string;
  name: string;
  trade: string | null;
  license_number: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PropertyRow {
  id: string;
  org_id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  property_type: string;
  unit_count: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface VendorPropertyRow {
  id: string;
  vendor_id: string;
  property_id: string;
  assigned_at: string;
}

// ── DDL (idempotent; run once at provisioning) ────────────────────────────────

export const COI_DDL = `
CREATE TABLE IF NOT EXISTS coi_vendors (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL,
  name           TEXT NOT NULL,
  trade          TEXT,
  license_number TEXT,
  contact_email  TEXT,
  contact_phone  TEXT,
  address        TEXT,
  notes          TEXT,
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coi_properties (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL,
  name          TEXT NOT NULL,
  address       TEXT,
  city          TEXT,
  state         TEXT,
  zip           TEXT,
  property_type TEXT NOT NULL DEFAULT 'managed',
  unit_count    INTEGER,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coi_vendor_properties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   UUID NOT NULL REFERENCES coi_vendors(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES coi_properties(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, property_id)
);

-- post-deploy-fix 2026-06-09: the dashboard/scoring queries reference these
-- two tables + deleted_at columns that the original DDL never defined
-- (schema-divergence across features). Added so the company DB is coherent.
ALTER TABLE coi_vendors    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE coi_properties ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS coi_compliance_templates (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   UUID,
  property_id              UUID REFERENCES coi_properties(id) ON DELETE CASCADE,
  name                     TEXT,
  certificate_type         TEXT NOT NULL,
  required_coverage_amount NUMERIC,
  coverage_lines           JSONB NOT NULL DEFAULT '[]'::jsonb,
  entries                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coi_certificates (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID,
  extraction_id           UUID,
  vendor_id               UUID REFERENCES coi_vendors(id) ON DELETE CASCADE,
  vendor_name             TEXT,
  property_id             UUID REFERENCES coi_properties(id) ON DELETE SET NULL,
  certificate_type        TEXT,
  policy_type             TEXT,
  form_type               TEXT,
  file_url                TEXT,
  document_url            TEXT,
  status                  TEXT NOT NULL DEFAULT 'active',
  is_active               BOOLEAN NOT NULL DEFAULT true,
  insured_name            TEXT,
  insurer                 TEXT,
  policy_number           TEXT,
  effective_date          DATE,
  expiration_date         DATE,
  coverage_amount         NUMERIC,
  general_liability_limit NUMERIC,
  auto_liability_limit    NUMERIC,
  workers_comp_limit      NUMERIC,
  umbrella_limit          NUMERIC,
  additional_insured      TEXT,
  certificate_holder      TEXT,
  promoted_at             TIMESTAMPTZ,
  promoted_by             UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coi_compliance_templates_property ON coi_compliance_templates(property_id);
CREATE INDEX IF NOT EXISTS idx_coi_certificates_vendor   ON coi_certificates(vendor_id);
CREATE INDEX IF NOT EXISTS idx_coi_certificates_property ON coi_certificates(property_id);

CREATE INDEX IF NOT EXISTS idx_coi_vendors_org_id ON coi_vendors(org_id);
CREATE INDEX IF NOT EXISTS idx_coi_properties_org_id ON coi_properties(org_id);
CREATE INDEX IF NOT EXISTS idx_coi_vendor_properties_vendor ON coi_vendor_properties(vendor_id);
CREATE INDEX IF NOT EXISTS idx_coi_vendor_properties_property ON coi_vendor_properties(property_id);
`;
