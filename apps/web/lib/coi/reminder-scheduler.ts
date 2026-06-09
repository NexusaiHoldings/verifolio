/**
 * COI expiration sweep + reminder dispatch.
 *
 * Queries expiring / non-compliant COIs, applies per-property reminder config,
 * guards against duplicate sends (idempotency), and dispatches emails via Resend.
 */

import type { Db } from "@nexus/identity-and-access/api/_lib/db";
import type { EventBus } from "@nexus/identity-and-access/api/_lib/events";
import {
  REMINDER_THRESHOLDS,
  renderExpiringReminderHtml,
  renderNonCompliantReminderHtml,
  renderEscalationHtml,
  type ReminderType,
} from "./reminder-templates";

export interface ExpiringCOI {
  certificate_id: string;
  vendor_id: string;
  vendor_name: string;
  vendor_email: string;
  property_id: string;
  property_name: string;
  policy_number: string;
  expiry_date: string;
  coverage_type: string;
  days_until_expiry: number;
}

export interface NonCompliantVendor {
  certificate_id: string;
  vendor_id: string;
  vendor_name: string;
  vendor_email: string;
  property_id: string;
  property_name: string;
  policy_number: string;
  expiry_date: string;
  coverage_type: string;
  non_compliant_reasons: string[];
}

export interface PropertyReminderConfig {
  property_id: string;
  enabled: boolean;
  lead_days: number[];
  escalation_email: string | null;
  upload_url_base: string | null;
}

export interface SweepResult {
  expiring_processed: number;
  non_compliant_processed: number;
  emails_sent: number;
  emails_skipped: number;
  errors: string[];
}

const RESEND_API = "https://api.resend.com";

function fromAddress(): string {
  const explicit = process.env.EMAIL_FROM;
  if (explicit) return explicit;
  const slug = process.env.COMPANY_SLUG ?? "no-reply";
  const companyName = process.env.COMPANY_NAME ?? "Property Management";
  return `${companyName} <${slug}@nexusaiholdings.com>`;
}

function companyName(): string {
  return process.env.COMPANY_NAME ?? "Property Management";
}

function uploadUrl(propertyId: string, base: string | null): string {
  const appBase =
    base ??
    process.env.APP_BASE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "");
  return `${appBase}/coi/submit?property=${encodeURIComponent(propertyId)}`;
}

async function sendEmail(
  toEmail: string,
  subject: string,
  html: string,
): Promise<{ success: boolean; error: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    const resp = await fetch(`${RESEND_API}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromAddress(), to: [toEmail], subject, html }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      return { success: false, error: `Resend ${resp.status}: ${detail.slice(0, 200)}` };
    }
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function ensureReminderLogTable(db: Db): Promise<void> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS coi_reminder_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      certificate_id UUID NOT NULL,
      vendor_id UUID NOT NULL,
      reminder_type TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      email_address TEXT NOT NULL,
      success BOOLEAN NOT NULL DEFAULT TRUE,
      error_message TEXT
    )`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_coi_reminder_log_cert_type_date
     ON coi_reminder_log (certificate_id, reminder_type, (sent_at::date))`,
  );
}

async function hasReminderBeenSentToday(
  db: Db,
  certificateId: string,
  reminderType: ReminderType,
): Promise<boolean> {
  const rows = await db.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM coi_reminder_log
     WHERE certificate_id = $1::uuid
       AND reminder_type = $2
       AND sent_at::date = CURRENT_DATE`,
    certificateId,
    reminderType,
  );
  return parseInt(rows[0]?.cnt ?? "0", 10) > 0;
}

async function recordReminder(
  db: Db,
  certificateId: string,
  vendorId: string,
  reminderType: ReminderType,
  emailAddress: string,
  success: boolean,
  errorMessage: string | null,
): Promise<void> {
  await db.execute(
    `INSERT INTO coi_reminder_log
       (certificate_id, vendor_id, reminder_type, email_address, success, error_message)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)`,
    certificateId,
    vendorId,
    reminderType,
    emailAddress,
    success,
    errorMessage,
  );
}

async function fetchExpiringCOIs(db: Db, daysAhead: number): Promise<ExpiringCOI[]> {
  return db.query<ExpiringCOI>(
    `SELECT
       c.id                                          AS certificate_id,
       v.id                                          AS vendor_id,
       v.name                                        AS vendor_name,
       v.email                                       AS vendor_email,
       p.id                                          AS property_id,
       COALESCE(p.name, 'Unknown Property')          AS property_name,
       c.policy_number,
       TO_CHAR(c.expiry_date, 'YYYY-MM-DD')          AS expiry_date,
       COALESCE(c.coverage_type, 'General Liability') AS coverage_type,
       (c.expiry_date::date - CURRENT_DATE)::int      AS days_until_expiry
     FROM coi_certificates c
     JOIN coi_vendors v ON v.id = c.vendor_id
     LEFT JOIN coi_properties p ON p.id = v.property_id
     WHERE c.expiry_date::date = (CURRENT_DATE + $1 * INTERVAL '1 day')::date
       AND c.is_active = TRUE
       AND v.email IS NOT NULL
       AND v.email <> ''`,
    daysAhead,
  );
}

async function fetchNonCompliantVendors(db: Db): Promise<NonCompliantVendor[]> {
  const rows = await db.query<{
    certificate_id: string;
    vendor_id: string;
    vendor_name: string;
    vendor_email: string;
    property_id: string;
    property_name: string;
    policy_number: string;
    expiry_date: string;
    coverage_type: string;
    non_compliant_reasons: string | string[];
  }>(
    `SELECT
       c.id                                          AS certificate_id,
       v.id                                          AS vendor_id,
       v.name                                        AS vendor_name,
       v.email                                       AS vendor_email,
       p.id                                          AS property_id,
       COALESCE(p.name, 'Unknown Property')          AS property_name,
       c.policy_number,
       TO_CHAR(c.expiry_date, 'YYYY-MM-DD')          AS expiry_date,
       COALESCE(c.coverage_type, 'General Liability') AS coverage_type,
       COALESCE(c.non_compliant_reasons, '[]'::jsonb) AS non_compliant_reasons
     FROM coi_certificates c
     JOIN coi_vendors v ON v.id = c.vendor_id
     LEFT JOIN coi_properties p ON p.id = v.property_id
     WHERE c.is_compliant = FALSE
       AND c.is_active = TRUE
       AND v.email IS NOT NULL
       AND v.email <> ''`,
  );

  return rows.map((r) => ({
    ...r,
    non_compliant_reasons: Array.isArray(r.non_compliant_reasons)
      ? r.non_compliant_reasons
      : (() => {
          try {
            const parsed = JSON.parse(r.non_compliant_reasons as string);
            return Array.isArray(parsed) ? (parsed as string[]) : [String(r.non_compliant_reasons)];
          } catch {
            return [String(r.non_compliant_reasons)];
          }
        })(),
  }));
}

async function fetchPropertyConfig(
  db: Db,
  propertyId: string,
): Promise<PropertyReminderConfig> {
  const rows = await db.query<{
    property_id: string;
    enabled: boolean;
    lead_days: string | number[];
    escalation_email: string | null;
    upload_url_base: string | null;
  }>(
    `SELECT property_id, enabled, lead_days, escalation_email, upload_url_base
     FROM coi_property_reminder_config
     WHERE property_id = $1::uuid`,
    propertyId,
  );

  if (rows.length === 0) {
    return {
      property_id: propertyId,
      enabled: true,
      lead_days: [30, 15, 7, 0],
      escalation_email: null,
      upload_url_base: null,
    };
  }

  const row = rows[0];
  let leadDays: number[] = [30, 15, 7, 0];
  if (Array.isArray(row.lead_days)) {
    leadDays = row.lead_days as number[];
  } else if (typeof row.lead_days === "string") {
    try {
      const parsed = JSON.parse(row.lead_days);
      if (Array.isArray(parsed)) leadDays = parsed as number[];
    } catch {
      leadDays = [30, 15, 7, 0];
    }
  }

  return {
    property_id: row.property_id,
    enabled: row.enabled,
    lead_days: leadDays,
    escalation_email: row.escalation_email ?? null,
    upload_url_base: row.upload_url_base ?? null,
  };
}

/** Main sweep: find expiring + non-compliant COIs and send reminders. */
export async function runExpirationSweep(
  db: Db,
  events: EventBus,
): Promise<SweepResult> {
  const result: SweepResult = {
    expiring_processed: 0,
    non_compliant_processed: 0,
    emails_sent: 0,
    emails_skipped: 0,
    errors: [],
  };

  await ensureReminderLogTable(db).catch((err: unknown) => {
    result.errors.push(`schema_init: ${String(err)}`);
  });

  const name = companyName();

  for (const days of REMINDER_THRESHOLDS) {
    let expiring: ExpiringCOI[] = [];
    try {
      expiring = await fetchExpiringCOIs(db, days);
    } catch (err) {
      result.errors.push(`fetch_expiring_${days}d: ${String(err)}`);
      continue;
    }

    for (const coi of expiring) {
      result.expiring_processed++;
      const reminderType: ReminderType = `expiring_${days}d`;

      let config: PropertyReminderConfig;
      try {
        config = await fetchPropertyConfig(db, coi.property_id);
      } catch {
        config = { property_id: coi.property_id, enabled: true, lead_days: [30, 15, 7, 0], escalation_email: null, upload_url_base: null };
      }

      if (!config.enabled || !config.lead_days.includes(days)) {
        result.emails_skipped++;
        continue;
      }

      const alreadySent = await hasReminderBeenSentToday(db, coi.certificate_id, reminderType).catch(() => false);
      if (alreadySent) {
        result.emails_skipped++;
        continue;
      }

      const vars = {
        vendorName: coi.vendor_name,
        vendorEmail: coi.vendor_email,
        propertyName: coi.property_name,
        policyNumber: coi.policy_number,
        expiryDate: coi.expiry_date,
        coverageType: coi.coverage_type,
        companyName: name,
        uploadUrl: uploadUrl(coi.property_id, config.upload_url_base),
        daysUntilExpiry: days,
      };

      const { subject, html } = renderExpiringReminderHtml(vars);
      const sendResult = await sendEmail(coi.vendor_email, subject, html);
      await recordReminder(db, coi.certificate_id, coi.vendor_id, reminderType, coi.vendor_email, sendResult.success, sendResult.error).catch(() => {});

      if (sendResult.success) {
        result.emails_sent++;
        await events.publish("coi.reminder_sent", {
          reminder_type: reminderType,
          vendor_id: coi.vendor_id,
          certificate_id: coi.certificate_id,
          property_id: coi.property_id,
          days_until_expiry: days,
        }).catch(() => {});
      } else {
        result.emails_skipped++;
        result.errors.push(`send_expiring_${days}d:${coi.certificate_id}: ${sendResult.error}`);
      }

      if (config.escalation_email && days <= 0) {
        const { subject: escSubject, html: escHtml } = renderEscalationHtml(vars);
        const escResult = await sendEmail(config.escalation_email, escSubject, escHtml);
        if (escResult.success) {
          result.emails_sent++;
        } else {
          result.errors.push(`escalation:${coi.certificate_id}: ${escResult.error}`);
        }
      }
    }
  }

  let nonCompliant: NonCompliantVendor[] = [];
  try {
    nonCompliant = await fetchNonCompliantVendors(db);
  } catch (err) {
    result.errors.push(`fetch_non_compliant: ${String(err)}`);
    return result;
  }

  for (const vendor of nonCompliant) {
    result.non_compliant_processed++;
    const reminderType: ReminderType = "non_compliant";

    let config: PropertyReminderConfig;
    try {
      config = await fetchPropertyConfig(db, vendor.property_id);
    } catch {
      config = { property_id: vendor.property_id, enabled: true, lead_days: [30, 15, 7, 0], escalation_email: null, upload_url_base: null };
    }

    if (!config.enabled) {
      result.emails_skipped++;
      continue;
    }

    const alreadySent = await hasReminderBeenSentToday(db, vendor.certificate_id, reminderType).catch(() => false);
    if (alreadySent) {
      result.emails_skipped++;
      continue;
    }

    const vars = {
      vendorName: vendor.vendor_name,
      vendorEmail: vendor.vendor_email,
      propertyName: vendor.property_name,
      policyNumber: vendor.policy_number,
      expiryDate: vendor.expiry_date,
      coverageType: vendor.coverage_type,
      companyName: name,
      uploadUrl: uploadUrl(vendor.property_id, config.upload_url_base),
      nonCompliantReasons: vendor.non_compliant_reasons,
    };

    const { subject, html } = renderNonCompliantReminderHtml(vars);
    const sendResult = await sendEmail(vendor.vendor_email, subject, html);
    await recordReminder(db, vendor.certificate_id, vendor.vendor_id, reminderType, vendor.vendor_email, sendResult.success, sendResult.error).catch(() => {});

    if (sendResult.success) {
      result.emails_sent++;
      await events.publish("coi.non_compliant_reminder_sent", {
        vendor_id: vendor.vendor_id,
        certificate_id: vendor.certificate_id,
        property_id: vendor.property_id,
      }).catch(() => {});
    } else {
      result.emails_skipped++;
      result.errors.push(`send_non_compliant:${vendor.certificate_id}: ${sendResult.error}`);
    }

    if (config.escalation_email) {
      const { subject: escSubject, html: escHtml } = renderEscalationHtml(vars);
      await sendEmail(config.escalation_email, escSubject, escHtml);
    }
  }

  return result;
}
