/**
 * COI pipeline feature tables — extraction, human review, compliance scoring,
 * and expiration reminders.
 *
 * These were referenced by apps/web/lib/coi/* and apps/web/lib/agent-tools/* but
 * had NO build-time DDL (the same class as the CondoCentral /violations 500,
 * caught by the build-time table-reference guard). Each table's columns are
 * taken from its WRITER (the code that INSERTs it), which is authoritative.
 * No hard FKs (avoid insert-order / missing-parent failures); idempotent.
 *
 * KNOWN RESIDUAL DRIFT (NOT resolved here — needs a COI feature-reconciliation
 * pass, see findings.md): the COI feature set carries cross-file schema drift
 * beyond table existence —
 *   - review-handler.ts reads FLAT columns from coi_extractions (policy_type,
 *     insured_name, …) that extract.ts stores as a single `extraction_data`
 *     jsonb blob; those reads will still error at the column level.
 *   - two parallel compliance systems coexist: the score-tool path
 *     (coi_compliance_templates / coi_vendor_template_bindings /
 *     coi_compliance_results) vs the scorer path (compliance_templates /
 *     compliance_rules / compliance_results / compliance_rule_results).
 *   - reminder-scheduler.ts reads columns on coi_vendors/coi_properties/
 *     coi_certificates that the coi.ts schema doesn't define (try/caught).
 * Defining these tables removes the table-missing 500s and lets the writer
 * paths work; the column-level reconciliation is tracked separately.
 */

// ── extraction (writer: lib/coi/extract.ts persistResults) ──────────────────
export const COI_EXTRACTIONS_DDL = `
CREATE TABLE IF NOT EXISTS coi_extractions (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id        uuid        NOT NULL,
  org_id                uuid        NOT NULL,
  form_type             text,
  extraction_data       jsonb,
  overall_confidence    numeric,
  needs_human_review    boolean     NOT NULL DEFAULT false,
  low_confidence_fields jsonb,
  extracted_at          timestamptz NOT NULL DEFAULT now(),
  reviewed_at           timestamptz,
  reviewed_by           uuid
);
CREATE INDEX IF NOT EXISTS idx_coi_extractions_cert
  ON coi_extractions (certificate_id, extracted_at DESC);
`;

// ── agent-tool scoring (writer: lib/agent-tools/score_coi_compliance_gap.ts) ─
export const COI_SCORE_TOOL_DDL = `
CREATE TABLE IF NOT EXISTS coi_extraction_results (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id  uuid        NOT NULL,
  vendor_id       uuid,
  extracted_fields jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coi_extraction_results_cert
  ON coi_extraction_results (certificate_id, created_at DESC);

CREATE TABLE IF NOT EXISTS coi_vendor_template_bindings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   uuid        NOT NULL,
  template_id uuid        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_coi_vendor_template_bindings
  ON coi_vendor_template_bindings (vendor_id, template_id);

CREATE TABLE IF NOT EXISTS coi_compliance_results (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_id  uuid        NOT NULL UNIQUE,
  certificate_id uuid,
  vendor_id      uuid,
  template_id    uuid,
  template_name  text,
  overall_status text,
  total_lines    integer     NOT NULL DEFAULT 0,
  passed_lines   integer     NOT NULL DEFAULT 0,
  critical_gaps  integer     NOT NULL DEFAULT 0,
  major_gaps     integer     NOT NULL DEFAULT 0,
  minor_gaps     integer     NOT NULL DEFAULT 0,
  gap_lines      jsonb,
  scored_at      timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
`;

// ── human review queue (writer: lib/coi/review-handler.ts submitReview) ─────
export const COI_REVIEW_DDL = `
CREATE TABLE IF NOT EXISTS coi_review_queue (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_id    uuid        NOT NULL,
  vendor_id        uuid,
  status           text        NOT NULL DEFAULT 'pending',
  confidence_score numeric,
  escalation_reason text,
  reviewer_id      uuid,
  reviewer_notes   text,
  corrected_fields jsonb,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coi_review_queue_status
  ON coi_review_queue (status, created_at ASC);

CREATE TABLE IF NOT EXISTS coi_compliance_jobs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id uuid        NOT NULL,
  triggered_by   text,
  status         text        NOT NULL DEFAULT 'pending',
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coi_compliance_jobs_status
  ON coi_compliance_jobs (status, created_at ASC);
`;

// ── expiration reminders (writer: lib/coi/reminder-scheduler.ts logReminder) ─
export const COI_REMINDER_LOG_DDL = `
CREATE TABLE IF NOT EXISTS coi_reminder_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id uuid,
  vendor_id      uuid,
  property_id    uuid,
  reminder_type  text        NOT NULL,
  recipient_email text,
  success        boolean     NOT NULL DEFAULT false,
  error_message  text,
  sent_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coi_reminder_log_cert
  ON coi_reminder_log (certificate_id, reminder_type);
CREATE INDEX IF NOT EXISTS idx_coi_reminder_log_vendor
  ON coi_reminder_log (vendor_id, property_id, sent_at DESC);
`;

// ── rule-based compliance scorer (writer: lib/coi/compliance-scorer.ts) ─────
export const COMPLIANCE_SCORER_DDL = `
CREATE TABLE IF NOT EXISTS compliance_templates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  description   text,
  property_type text        NOT NULL DEFAULT 'general',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_rules (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id       uuid        NOT NULL,
  coverage_type     text        NOT NULL,
  label             text        NOT NULL,
  is_required       boolean     NOT NULL DEFAULT true,
  min_per_occurrence numeric,
  min_aggregate     numeric
);
CREATE INDEX IF NOT EXISTS idx_compliance_rules_template
  ON compliance_rules (template_id);

CREATE TABLE IF NOT EXISTS compliance_results (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coi_id         uuid        NOT NULL,
  template_id    uuid        NOT NULL,
  overall_status text        NOT NULL,
  pass_count     integer     NOT NULL DEFAULT 0,
  fail_count     integer     NOT NULL DEFAULT 0,
  gap_count      integer     NOT NULL DEFAULT 0,
  evaluated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compliance_results_coi
  ON compliance_results (coi_id, template_id);

CREATE TABLE IF NOT EXISTS compliance_rule_results (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coi_id       uuid        NOT NULL,
  template_id  uuid        NOT NULL,
  rule_id      uuid        NOT NULL,
  status       text        NOT NULL,
  details      text,
  evaluated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compliance_rule_results_coi
  ON compliance_rule_results (coi_id, template_id);
`;
