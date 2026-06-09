/**
 * Email templates for COI expiration and non-compliance reminders.
 * Used by the daily expiration sweep cron to dispatch vendor notifications.
 */

export interface ExpirationTemplateVars {
  vendorName: string;
  propertyName: string;
  certificateType: string;
  expiryDate: string;
  daysUntilExpiry: number;
  uploadUrl: string;
  companyName: string;
}

export interface NonComplianceTemplateVars {
  vendorName: string;
  propertyName: string;
  missingRequirements: string;
  uploadUrl: string;
  companyName: string;
}

export interface EscalationTemplateVars {
  vendorName: string;
  propertyName: string;
  certificateType: string;
  expiryDate: string;
  daysUntilExpiry: number;
  vendorEmail: string;
  companyName: string;
}

export interface ReminderTemplate {
  subject: string;
  html: string;
}

function urgencyLabel(days: number): string {
  if (days <= 0) return "EXPIRED";
  if (days <= 7) return "URGENT";
  if (days <= 15) return "ACTION REQUIRED";
  return "Reminder";
}

function urgencyColor(days: number): string {
  if (days <= 0) return "#dc2626";
  if (days <= 7) return "#ea580c";
  if (days <= 15) return "#d97706";
  return "#2563eb";
}

function footerHtml(companyName: string): string {
  return `<div style="padding:16px 32px;background:#f1f5f9;border-top:1px solid #e2e8f0">
    <p style="margin:0;color:#94a3b8;font-size:12px">&copy; ${new Date().getFullYear()} ${companyName}. This is an automated compliance notice.</p>
  </div>`;
}

export function buildExpirationReminderTemplate(vars: ExpirationTemplateVars): ReminderTemplate {
  const label = urgencyLabel(vars.daysUntilExpiry);
  const color = urgencyColor(vars.daysUntilExpiry);
  const dayWord = vars.daysUntilExpiry === 1 ? "day" : "days";

  const expiryMessage =
    vars.daysUntilExpiry <= 0
      ? `Your Certificate of Insurance for <strong>${vars.propertyName}</strong> has <strong>expired</strong>.`
      : `Your Certificate of Insurance for <strong>${vars.propertyName}</strong> expires in <strong>${vars.daysUntilExpiry} ${dayWord}</strong> (${vars.expiryDate}).`;

  const subject =
    vars.daysUntilExpiry <= 0
      ? `[${label}] COI Expired — ${vars.propertyName}`
      : `[${label}] COI Expiring in ${vars.daysUntilExpiry} ${dayWord} — ${vars.propertyName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
  <div style="background:${color};padding:24px 32px">
    <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700">${vars.companyName}</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,.85);font-size:13px">Certificate of Insurance Notice</p>
  </div>
  <div style="padding:32px">
    <h2 style="margin:0 0 16px;font-size:20px;color:#0f172a">${label}: Certificate of Insurance</h2>
    <p style="margin:0 0 16px;color:#334155;line-height:1.6">Dear ${vars.vendorName},</p>
    <p style="margin:0 0 16px;color:#334155;line-height:1.6">${expiryMessage}</p>
    <p style="margin:0 0 16px;color:#334155;line-height:1.6">
      <strong>Certificate Type:</strong> ${vars.certificateType}<br>
      <strong>Property:</strong> ${vars.propertyName}<br>
      <strong>Expiry Date:</strong> ${vars.expiryDate}
    </p>
    <p style="margin:0 0 24px;color:#334155;line-height:1.6">
      To maintain active vendor status, please upload an updated certificate immediately.
      Work cannot be authorized until a valid COI is on file.
    </p>
    <a href="${vars.uploadUrl}" style="display:inline-block;padding:12px 24px;background:${color};color:#fff;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">Upload Updated COI</a>
    <p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.5">
      If you have already submitted an updated certificate, please disregard this notice.
    </p>
  </div>
  ${footerHtml(vars.companyName)}
</div>
</body>
</html>`;

  return { subject, html };
}

export function buildNonComplianceReminderTemplate(vars: NonComplianceTemplateVars): ReminderTemplate {
  const subject = `[Action Required] COI Non-Compliance — ${vars.propertyName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
  <div style="background:#dc2626;padding:24px 32px">
    <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700">${vars.companyName}</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,.85);font-size:13px">Compliance Notice</p>
  </div>
  <div style="padding:32px">
    <h2 style="margin:0 0 16px;font-size:20px;color:#0f172a">COI Compliance Requirements Outstanding</h2>
    <p style="margin:0 0 16px;color:#334155;line-height:1.6">Dear ${vars.vendorName},</p>
    <p style="margin:0 0 16px;color:#334155;line-height:1.6">
      Our records show that your Certificate of Insurance for <strong>${vars.propertyName}</strong>
      does not meet current compliance requirements.
    </p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:16px;margin:0 0 24px">
      <p style="margin:0 0 8px;font-weight:600;color:#991b1b">Missing or Non-Compliant Items:</p>
      <p style="margin:0;color:#7f1d1d;white-space:pre-line">${vars.missingRequirements}</p>
    </div>
    <p style="margin:0 0 24px;color:#334155;line-height:1.6">
      Please upload an updated COI that satisfies all requirements. Continued non-compliance
      may result in suspension of work authorization.
    </p>
    <a href="${vars.uploadUrl}" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">Upload Updated COI</a>
    <p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.5">
      If you believe this notice is in error, please contact ${vars.companyName} immediately.
    </p>
  </div>
  ${footerHtml(vars.companyName)}
</div>
</body>
</html>`;

  return { subject, html };
}

export function buildEscalationTemplate(vars: EscalationTemplateVars): ReminderTemplate {
  const statusLabel =
    vars.daysUntilExpiry <= 0
      ? "expired"
      : `expiring in ${vars.daysUntilExpiry} day${vars.daysUntilExpiry === 1 ? "" : "s"}`;

  const subject =
    vars.daysUntilExpiry <= 0
      ? `[Escalation] Vendor COI Expired — ${vars.vendorName} / ${vars.propertyName}`
      : `[Escalation] Vendor COI Expiring Soon — ${vars.vendorName} / ${vars.propertyName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
  <div style="background:#7c3aed;padding:24px 32px">
    <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700">${vars.companyName}</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,.85);font-size:13px">Management Escalation</p>
  </div>
  <div style="padding:32px">
    <h2 style="margin:0 0 16px;font-size:20px;color:#0f172a">Vendor COI Escalation Notice</h2>
    <p style="margin:0 0 16px;color:#334155;line-height:1.6">
      This is an automated escalation notice. The following vendor's Certificate of Insurance
      is <strong>${statusLabel}</strong> and requires management attention.
    </p>
    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:6px;padding:16px;margin:0 0 24px">
      <p style="margin:0 0 6px;color:#4c1d95"><strong>Vendor:</strong> ${vars.vendorName}</p>
      <p style="margin:0 0 6px;color:#4c1d95"><strong>Property:</strong> ${vars.propertyName}</p>
      <p style="margin:0 0 6px;color:#4c1d95"><strong>Certificate Type:</strong> ${vars.certificateType}</p>
      <p style="margin:0 0 6px;color:#4c1d95"><strong>Expiry Date:</strong> ${vars.expiryDate}</p>
      <p style="margin:0;color:#4c1d95"><strong>Vendor Contact:</strong> ${vars.vendorEmail}</p>
    </div>
    <p style="margin:0;color:#334155;line-height:1.6">
      Automated reminders have been sent to the vendor. Please follow up directly if the situation
      is not resolved promptly.
    </p>
  </div>
  <div style="padding:16px 32px;background:#f1f5f9;border-top:1px solid #e2e8f0">
    <p style="margin:0;color:#94a3b8;font-size:12px">&copy; ${new Date().getFullYear()} ${vars.companyName}. This is an automated management escalation.</p>
  </div>
</div>
</body>
</html>`;

  return { subject, html };
}
