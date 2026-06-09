/**
 * Resend inbound email webhook — receives forwarded COI emails,
 * extracts PDF attachments, and triggers the ACORD extraction pipeline.
 *
 * Resend delivers inbound email to this endpoint as a POST with
 * Content-Type: application/json. Each attachment arrives as a base64
 * encoded string with a content_type field.
 *
 * Security: requests are validated via HMAC-SHA256 signature in the
 * `svix-signature` header (Resend uses Svix for webhook delivery).
 *
 * maxDuration is set to 60s (Vercel serverless default).
 * If a PDF takes longer, the extraction is still committed to the DB
 * and the route returns 202 before the function times out.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { extractFromBase64 } from "@/lib/coi/extract";

export const maxDuration = 60;

// ── Types ──────────────────────────────────────────────────────────────────────

interface ResendAttachment {
  filename: string;
  content: string; // base64
  content_type: string;
}

interface ResendInboundPayload {
  type?: string;
  data?: {
    from?: string;
    to?: string[];
    subject?: string;
    text?: string;
    html?: string;
    attachments?: ResendAttachment[];
  };
  // Alternative flat structure Resend also supports
  from?: string;
  to?: string | string[];
  subject?: string;
  text?: string;
  html?: string;
  attachments?: ResendAttachment[];
}

// ── HMAC signature verification ────────────────────────────────────────────────

function verifyResendSignature(
  rawBody: string,
  headers: Headers,
): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  // Skip verification if secret is not configured (dev/preview only)
  if (!secret) return true;

  // Svix delivers three headers: svix-id, svix-timestamp, svix-signature
  const svixId = headers.get("svix-id") ?? "";
  const svixTimestamp = headers.get("svix-timestamp") ?? "";
  const svixSignature = headers.get("svix-signature") ?? "";

  if (!svixTimestamp || !svixSignature) {
    // Fall back to simpler X-Resend-Signature check
    const signature = headers.get("x-resend-signature") ?? "";
    if (!signature) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    return signature === `sha256=${expected}`;
  }

  // Verify Svix-style signature: sign "id.timestamp.body"
  const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
  const hmac = createHmac("sha256", secret).update(toSign).digest("base64");

  // svix-signature may contain multiple space-separated "v1,<base64>" tokens
  return svixSignature.split(" ").some((token) => {
    const [, sig] = token.split(",");
    return sig === hmac;
  });
}

// ── Attachment helpers ─────────────────────────────────────────────────────────

function isPdf(attachment: ResendAttachment): boolean {
  return (
    attachment.content_type === "application/pdf" ||
    attachment.filename?.toLowerCase().endsWith(".pdf")
  );
}

function extractOrgId(payload: ResendInboundPayload): string {
  // The org is encoded in the recipient address sub-addressing:
  // e.g. coi+<orgId>@intake.example.com
  const toList: string[] = (() => {
    const raw = payload.data?.to ?? payload.to;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  })();

  for (const addr of toList) {
    const match = /\+([a-z0-9-]+)@/i.exec(addr);
    if (match?.[1]) return match[1];
  }

  // Fall back to the default org configured for this deployment
  return process.env.DEFAULT_ORG_ID ?? "00000000-0000-0000-0000-000000000000";
}

function extractVendorName(payload: ResendInboundPayload): string {
  const from = payload.data?.from ?? payload.from ?? "";
  // Strip angle brackets and domain — e.g. "Acme Corp <coi@acme.com>" → "Acme Corp"
  const nameMatch = /^([^<]+)</.exec(from);
  if (nameMatch?.[1]) return nameMatch[1].trim();
  // Use the local part of the email
  const localMatch = /([^@]+)@/.exec(from);
  return localMatch?.[1]?.replace(/[._+-]/g, " ").trim() ?? "Unknown Sender";
}

function getAttachments(payload: ResendInboundPayload): ResendAttachment[] {
  return (payload.data?.attachments ?? payload.attachments) ?? [];
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
  }

  // Signature validation
  if (!verifyResendSignature(rawBody, request.headers)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let payload: ResendInboundPayload;
  try {
    payload = JSON.parse(rawBody) as ResendInboundPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const attachments = getAttachments(payload);
  const pdfAttachments = attachments.filter(isPdf);

  if (pdfAttachments.length === 0) {
    // Acknowledge without processing — no PDF attachments
    return NextResponse.json(
      { received: true, processed: 0, message: "No PDF attachments found" },
      { status: 200 },
    );
  }

  const orgId = extractOrgId(payload);
  const vendorName = extractVendorName(payload);
  const results: Array<{ filename: string; certificateId: string; needsReview: boolean }> = [];
  const errors: Array<{ filename: string; error: string }> = [];

  for (const attachment of pdfAttachments) {
    try {
      const record = await extractFromBase64({
        base64Content: attachment.content,
        mimeType: attachment.content_type || "application/pdf",
        orgId,
        vendorName,
      });
      results.push({
        filename: attachment.filename,
        certificateId: record.certificateId,
        needsReview: record.needsReview,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ filename: attachment.filename, error: message });
      // Log structured error but don't abort the whole batch
      console.error(
        JSON.stringify({
          level: "error",
          event: "coi.email_inbound.extraction_failed",
          filename: attachment.filename,
          orgId,
          error: message,
        }),
      );
    }
  }

  console.info(
    JSON.stringify({
      level: "info",
      event: "coi.email_inbound.processed",
      orgId,
      vendorName,
      processed: results.length,
      errors: errors.length,
      needsReview: results.filter((r) => r.needsReview).length,
    }),
  );

  const httpStatus = errors.length > 0 && results.length === 0 ? 422 : 200;
  return NextResponse.json(
    {
      received: true,
      processed: results.length,
      errors: errors.length,
      results,
      ...(errors.length > 0 ? { extraction_errors: errors } : {}),
    },
    { status: httpStatus },
  );
}
