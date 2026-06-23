/**
 * COI expiration sweep scheduler.
 * Queries expiring certificates and non-compliant vendors, dispatches
 * templated email reminders via Resend, and logs each send to coi_reminder_log.
 */

import { randomUUID } from "node:crypto";
import type { Db } from "@nexus/identity-and-access/api/_lib/db";
import type { EventBus } from "@nexus/identity-and-access/api/_lib/events";
import {
  buildExpirationReminderTemplate,
  buildNonComplianceReminderTemplate,
  buildEscalationTemplate,
} from "./reminder-templates";

const RESEND_API = "https://api.resend.com";

interface ExpiringCertRow {
  certificate_id: string;
  vendor_id: string;
  vendor_name: string;
  vendor_contact_email: string;
  property_id: string;
  property_name: string;
  certificate_type: string;
  expiry_date: string;
  days_until_expiry: number;
  escalation_email: string | null;
  escalation_threshold_days: number;
  reminder_enabled: boolean;
}

interface NonCompliantVendorRow {
  vendor_id: string;
  vendor_name: string;
  vendor_contact_email: string;
  property_id: string;
  property_name: string;
  missing_requirements: string;
  reminder_frequency_days: number;
}

interface EmailResult {
  success: boolean;
  error: string | null;
}

export interface SweepSummary {
  expiration_reminders_sent: number;
  noncompliance_reminders_sent: number;
  escalations_sent: number;
  errors: string[];
}

async function wasReminderSentForTier(db: Db, certId: string, tier: string): Promise<boolean> {
  const rows = await db.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM coi_reminder_log
     WHERE certificate_id = $1::uuid AND reminder_type = $2`,
    certId,
    tier,
  );
  return parseInt(rows[0]?.cnt ?? "0", 10) > 0;
}
async function wasNonComplianceReminderSentRecently(
  db: Db,
  vendorId: string,
  propertyId: string,
  freqDays: number,
): Promise<boolean> {
  const rows = await db.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM coi_reminder_log
     WHERE vendor_id = $1::uuid
       AND property_id = $2::uuid
       AND reminder_type = 'noncompliance'
       AND sent_at >= NOW() - ($3::int * INTERVAL '1 day')`,
    vendorId,
    propertyId,
    freqDays,
  );
  return parseInt(rows[0]?.cnt ?? "0", 10) > 0;
}
async function logReminder(
  db: Db,
  certId: string | null,
  vendorId: string,
  propertyId: string,
  reminderType: string,
  recipientEmail: string,
  success: boolean,
  errorMessage: string | null,
): Promise<void> {
  await db.execute(
    `INSERT INTO coi_reminder_log
     (id, certificate_id, vendor_id, property_id, reminder_type, recipient_email, success, error_message, sent_at)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, NOW())`,
    randomUUID(),
    certId,
    vendorId,
    propertyId,
    reminderType,
    recipientEmail,
    success,
    errorMessage,
  );
}
async function sendEmail(
  toEmail: string,
  fromEmail: string,
  subject: string,
  html: string,
  apiKey: string,
): Promise<EmailResult> {
  try {
    const resp = await fetch(`${RESEND_API}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromEmail, to: [toEmail], subject, html }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return { success: false, error: `resend ${resp.status}: ${body.slice(0, 200)}` };
    }
    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
function getReminderTier(days: number): string | null {
  if (days <= 0) return "expiry";
  if (days <= 7) return "7day";
  if (days <= 15) return "15day";
  if (days <= 30) return "30day";
  return null;
}
export async function runExpirationSweep(db: Db, events: EventBus): Promise<SweepSummary> {
  const apiKey = process.env.RESEND_API_KEY ?? "";
  const companyName = process.env.COMPANY_NAME ?? "Property Management";
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "";
  const appBaseUrl = (process.env.APP_BASE_URL ?? vercelUrl).replace(/\/+$/, "");
  const fromEmail =
    process.env.EMAIL_FROM ??
    `coi@${process.env.COMPANY_SLUG ?? "company"}.nexusaiholdings.com`;

  const summary: SweepSummary = {
    expiration_reminders_sent: 0,
    noncompliance_reminders_sent: 0,
    escalations_sent: 0,
    errors: [],
  };

  // ── 1. Expiring certificates ───────────────────────────────────────────────
  let expiringCerts: ExpiringCertRow[] = [];
  try {
    expiringCerts = await db.query<ExpiringCertRow>(
      `SELECT
         c.id                                                   AS certificate_id,
         v.id                                                   AS vendor_id,
         v.name                                                 AS vendor_name,
         v.contact_email                                        AS vendor_contact_email,
         p.id                                                   AS property_id,
         p.name                                                 AS property_name,
         c.certificate_type,
         TO_CHAR(c.expiration_date, 'YYYY-MM-DD')                  AS expiry_date,
         (c.expiration_date::date - CURRENT_DATE)::int              AS days_until_expiry,
         p.escalation_email,
         COALESCE(p.escalation_threshold_days, 7)::int         AS escalation_threshold_days,
         COALESCE(p.reminders_enabled, true)                   AS reminder_enabled
       FROM coi_certificates c
       JOIN coi_vendors v ON v.id = c.vendor_id
       JOIN coi_vendor_properties vp ON vp.vendor_id = v.id
       JOIN coi_properties p ON p.id = vp.property_id
       WHERE c.expiration_date::date <= CURRENT_DATE + INTERVAL '30 days'
         AND c.status != 'superseded'
         AND v.status = 'active'
         AND v.contact_email IS NOT NULL
       ORDER BY c.expiration_date ASC`,
    );
  } catch (e) {
    summary.errors.push(`query expiring certs: ${String(e)}`);
    return summary;
  }

  for (const cert of expiringCerts) {
    if (!cert.reminder_enabled) continue;

    const tier = getReminderTier(cert.days_until_expiry);
    if (!tier) continue;

    try {
      const alreadySent = await wasReminderSentForTier(db, cert.certificate_id, tier);
      if (alreadySent) continue;

      const uploadUrl = `${appBaseUrl}/vendor/coi-upload?vendor=${encodeURIComponent(cert.vendor_id)}`;

      if (apiKey) {
        const { subject, html } = buildExpirationReminderTemplate({
          vendorName: cert.vendor_name,
          propertyName: cert.property_name,
          certificateType: cert.certificate_type,
          expiryDate: cert.expiry_date,
          daysUntilExpiry: cert.days_until_expiry,
          uploadUrl,
          companyName,
        });

        const result = await sendEmail(cert.vendor_contact_email, fromEmail, subject, html, apiKey);
        await logReminder(
          db,
          cert.certificate_id,
          cert.vendor_id,
          cert.property_id,
          tier,
          cert.vendor_contact_email,
          result.success,
          result.error,
        );

        if (result.success) {
          summary.expiration_reminders_sent++;
        } else {
          summary.errors.push(`expiry email ${cert.vendor_contact_email}: ${result.error}`);
        }
      }

      // Escalation: notify management when within the configured threshold
      if (
        cert.escalation_email &&
        cert.days_until_expiry <= cert.escalation_threshold_days
      ) {
        const escAlreadySent = await wasReminderSentForTier(
          db,
          cert.certificate_id,
          "escalation",
        );
        if (!escAlreadySent && apiKey) {
          const { subject: escSubject, html: escHtml } = buildEscalationTemplate({
            vendorName: cert.vendor_name,
            propertyName: cert.property_name,
            certificateType: cert.certificate_type,
            expiryDate: cert.expiry_date,
            daysUntilExpiry: cert.days_until_expiry,
            vendorEmail: cert.vendor_contact_email,
            companyName,
          });

          const escResult = await sendEmail(
            cert.escalation_email,
            fromEmail,
            escSubject,
            escHtml,
            apiKey,
          );
          await logReminder(
            db,
            cert.certificate_id,
            cert.vendor_id,
            cert.property_id,
            "escalation",
            cert.escalation_email,
            escResult.success,
            escResult.error,
          );

          if (escResult.success) {
            summary.escalations_sent++;
          } else {
            summary.errors.push(`escalation email ${cert.escalation_email}: ${escResult.error}`);
          }
        }
      }
    } catch (e) {
      summary.errors.push(`cert ${cert.certificate_id}: ${String(e)}`);
    }
  }

  // ── 2. Non-compliant vendors ───────────────────────────────────────────────
  let nonCompliantVendors: NonCompliantVendorRow[] = [];
  try {
    nonCompliantVendors = await db.query<NonCompliantVendorRow>(
      `SELECT
         v.id                                                              AS vendor_id,
         v.name                                                            AS vendor_name,
         v.contact_email                                                   AS vendor_contact_email,
         p.id                                                              AS property_id,
         p.name                                                            AS property_name,
         COALESCE(v.missing_requirements, 'Missing required certificate(s)') AS missing_requirements,
         COALESCE(p.noncompliance_reminder_frequency_days, 7)::int        AS reminder_frequency_days
       FROM coi_vendors v
       JOIN coi_vendor_properties vp ON vp.vendor_id = v.id
       JOIN coi_properties p ON p.id = vp.property_id
       WHERE v.is_compliant = false
         AND v.status = 'active'
         AND v.contact_email IS NOT NULL`,
    );
  } catch (e) {
    summary.errors.push(`query non-compliant vendors: ${String(e)}`);
    return summary;
  }

  for (const vendor of nonCompliantVendors) {
    try {
      const alreadySent = await wasNonComplianceReminderSentRecently(
        db,
        vendor.vendor_id,
        vendor.property_id,
        vendor.reminder_frequency_days,
      );
      if (alreadySent) continue;

      if (!apiKey) continue;

      const uploadUrl = `${appBaseUrl}/vendor/coi-upload?vendor=${encodeURIComponent(vendor.vendor_id)}`;
      const { subject, html } = buildNonComplianceReminderTemplate({
        vendorName: vendor.vendor_name,
        propertyName: vendor.property_name,
        missingRequirements: vendor.missing_requirements,
        uploadUrl,
        companyName,
      });

      const result = await sendEmail(
        vendor.vendor_contact_email,
        fromEmail,
        subject,
        html,
        apiKey,
      );
      await logReminder(
        db,
        null,
        vendor.vendor_id,
        vendor.property_id,
        "noncompliance",
        vendor.vendor_contact_email,
        result.success,
        result.error,
      );

      if (result.success) {
        summary.noncompliance_reminders_sent++;
      } else {
        summary.errors.push(`noncompliance email ${vendor.vendor_contact_email}: ${result.error}`);
      }
    } catch (e) {
      summary.errors.push(`vendor ${vendor.vendor_id}: ${String(e)}`);
    }
  }

  await events.publish("coi.expiration_sweep_completed", {
    expiration_reminders_sent: summary.expiration_reminders_sent,
    noncompliance_reminders_sent: summary.noncompliance_reminders_sent,
    escalations_sent: summary.escalations_sent,
    error_count: summary.errors.length,
  });

  return summary;
}
