/**
 * COI compliance domain — company-specific schema definitions.
 * Exports TypeScript interfaces + idempotent SQL DDL for:
 *   coi_vendors, coi_properties, coi_vendor_property_assignments
 *
 * The substrate concatenates packages/db/company/*.ts into the schema at
 * provisioning time. No drizzle-orm import — raw DDL strings only.
 */

export interface CoiVendor {
  id: string;
  org_id: string;
  name: string;
  trade_category: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CoiProperty {
  id: string;
  org_id: string;
  name: string;
  address: string | null;
  property_type: string | null;
  unit_count: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CoiVendorPropertyAssignment {
  id: string;
  vendor_id: string;
  property_id: string;
  assigned_by_user_id: string | null;
  assigned_at: Date;
}

export const CREATE_VENDORS_TABLE = `
CREATE TABLE IF NOT EXISTS coi_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  trade_category TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS coi_vendors_org_id_idx ON coi_vendors (org_id);
CREATE INDEX IF NOT EXISTS coi_vendors_name_idx ON coi_vendors USING gin (to_tsvector('english', name));
`;

export const CREATE_PROPERTIES_TABLE = `
CREATE TABLE IF NOT EXISTS coi_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  property_type TEXT,
  unit_count INTEGER,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS coi_properties_org_id_idx ON coi_properties (org_id);
`;

export const CREATE_VENDOR_PROPERTY_ASSIGNMENTS_TABLE = `
CREATE TABLE IF NOT EXISTS coi_vendor_property_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES coi_vendors(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES coi_properties(id) ON DELETE CASCADE,
  assigned_by_user_id UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vendor_id, property_id)
);
CREATE INDEX IF NOT EXISTS coi_vpa_vendor_id_idx ON coi_vendor_property_assignments (vendor_id);
CREATE INDEX IF NOT EXISTS coi_vpa_property_id_idx ON coi_vendor_property_assignments (property_id);
`;

/** All COI DDL in dependency order — idempotent (IF NOT EXISTS). */
export const COI_SCHEMA_DDL = [
  CREATE_VENDORS_TABLE,
  CREATE_PROPERTIES_TABLE,
  CREATE_VENDOR_PROPERTY_ASSIGNMENTS_TABLE,
].join("\n");
