/**
 * COI expiration reminder email templates.
 *
 * Renders HTML email bodies for: expiring-certificate reminders at 30/15/7/0
 * days, non-compliant vendor notices, and management escalation notices.
 */

export const REMINDER_THRESHOLDS = [30, 15, 7, 0] as const;
export type ReminderThreshold = (typeof REMINDER_THRESHOLDS)[number];
export type ReminderType = `expiring_${ReminderThreshold}d` | "non_compliant" | "escalation";

export interface ReminderTemplateVars {
  vendorName: string;
  vendorEmail: string;
  propertyName: string;
  policyNumber: string;
  expiryDate: string;
  coverageType: string;
  companyName: string;
  uploadUrl: string;
  daysUntilExpiry?: number;
  nonCompliantReasons?: string[];
}

function baseLayout(subject: string, bodyHtml: string): string {
  return (
    `<div style="font-family:system-ui,Arial,sans-serif;font-size:15px;color:#111;max-width:600px;margin:0 auto">` +
    `<h2 style="color:#1d4ed8;margin-bottom:8px">${subject}</h2>` +
    bodyHtml +
    `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>` +
    `<p style="color:#9ca3af;font-size:12px">` +
    `This is an automated notice from your property management system. ` +
    `If you have questions, please contact your property manager.` +
    `</p></div>`
  );
}

/** 30/15/7/0-day expiration reminder sent to a vendor contact. */
export function renderExpiringReminderHtml(vars: ReminderTemplateVars): {
  subject: string;
  html: string;
} {
  const days = vars.daysUntilExpiry ?? 0;
  const urgency =
    days === 0
      ? "⚠️ EXPIRED TODAY"
      : days <= 7
        ? `⚠️ Expiring in ${days} day${days === 1 ? "" : "s"}`
        : `Expiring in ${days} days`;

  const subject = `[Action Required] COI ${urgency} — ${vars.propertyName}`;

  const bodyHtml =
    `<p>Dear ${escHtml(vars.vendorName)},</p>` +
    `<p>Your Certificate of Insurance on file for <strong>${escHtml(vars.propertyName)}</strong> ` +
    (days === 0
      ? `has <strong style="color:#dc2626">expired today</strong>.`
      : `will <strong>expire on ${escHtml(vars.expiryDate)}</strong> (in <strong>${days} day${days === 1 ? "" : "s"}</strong>).`) +
    `</p>` +
    `<table style="border-collapse:collapse;width:100%;margin:16px 0">` +
    `<tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:600;width:40%">Policy Number</td>` +
    `<td style="padding:6px 12px">${escHtml(vars.policyNumber)}</td></tr>` +
    `<tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:600">Coverage Type</td>` +
    `<td style="padding:6px 12px">${escHtml(vars.coverageType)}</td></tr>` +
    `<tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:600">Expiry Date</td>` +
    `<td style="padding:6px 12px;color:${days <= 7 ? "#dc2626" : "#111"}">${escHtml(vars.expiryDate)}</td></tr>` +
    `</table>` +
    `<p>Please submit your updated certificate of insurance as soon as possible to avoid any disruption to your vendor status.</p>` +
    `<p><a href="${escHtml(vars.uploadUrl)}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Submit Updated COI</a></p>` +
    `<p style="color:#6b7280;font-size:13px">If you have already submitted your updated COI, please disregard this notice.</p>`;

  return { subject, html: baseLayout(subject, bodyHtml) };
}

/** Non-compliant vendor notice sent to a vendor contact. */
export function renderNonCompliantReminderHtml(vars: ReminderTemplateVars): {
  subject: string;
  html: string;
} {
  const subject = `[Action Required] COI Compliance Issue — ${vars.propertyName}`;
  const reasons = vars.nonCompliantReasons ?? ["Coverage does not meet minimum requirements"];

  const reasonsHtml = reasons
    .map((r) => `<li style="margin:4px 0">${escHtml(r)}</li>`)
    .join("");

  const bodyHtml =
    `<p>Dear ${escHtml(vars.vendorName)},</p>` +
    `<p>Your Certificate of Insurance on file for <strong>${escHtml(vars.propertyName)}</strong> ` +
    `has been flagged as <strong style="color:#dc2626">non-compliant</strong>.</p>` +
    `<p><strong>Compliance issues identified:</strong></p>` +
    `<ul style="margin:8px 0;padding-left:20px">${reasonsHtml}</ul>` +
    `<table style="border-collapse:collapse;width:100%;margin:16px 0">` +
    `<tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:600;width:40%">Policy Number</td>` +
    `<td style="padding:6px 12px">${escHtml(vars.policyNumber)}</td></tr>` +
    `<tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:600">Coverage Type</td>` +
    `<td style="padding:6px 12px">${escHtml(vars.coverageType)}</td></tr>` +
    `</table>` +
    `<p>Please submit a corrected certificate of insurance that meets the requirements for <strong>${escHtml(vars.propertyName)}</strong>.</p>` +
    `<p><a href="${escHtml(vars.uploadUrl)}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Submit Corrected COI</a></p>`;

  return { subject, html: baseLayout(subject, bodyHtml) };
}

/** Escalation notice sent to property management staff. */
export function renderEscalationHtml(vars: ReminderTemplateVars): {
  subject: string;
  html: string;
} {
  const days = vars.daysUntilExpiry;
  const subject =
    days !== undefined && days <= 0
      ? `[Escalation] Expired COI — ${vars.vendorName} @ ${vars.propertyName}`
      : `[Escalation] Unresolved COI — ${vars.vendorName} @ ${vars.propertyName}`;

  const bodyHtml =
    `<p>This is an escalation notice for an unresolved Certificate of Insurance issue.</p>` +
    `<table style="border-collapse:collapse;width:100%;margin:16px 0">` +
    `<tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:600;width:40%">Vendor</td>` +
    `<td style="padding:6px 12px">${escHtml(vars.vendorName)}</td></tr>` +
    `<tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:600">Vendor Email</td>` +
    `<td style="padding:6px 12px">${escHtml(vars.vendorEmail)}</td></tr>` +
    `<tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:600">Property</td>` +
    `<td style="padding:6px 12px">${escHtml(vars.propertyName)}</td></tr>` +
    `<tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:600">Policy Number</td>` +
    `<td style="padding:6px 12px">${escHtml(vars.policyNumber)}</td></tr>` +
    `<tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:600">Expiry Date</td>` +
    `<td style="padding:6px 12px;color:#dc2626">${escHtml(vars.expiryDate)}</td></tr>` +
    `</table>` +
    `<p>Vendor reminders have been sent but the COI has not been updated. Manual follow-up may be required.</p>`;

  return { subject, html: baseLayout(subject, bodyHtml) };
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
