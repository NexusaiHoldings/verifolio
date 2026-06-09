/**
 * POST /api/webhooks/email-inbound
 * Resend inbound-parse webhook: receives forwarded emails containing COI PDFs,
 * creates a certificate record, and triggers AI extraction.
 */
import { NextRequest, NextResponse } from "next/server";
import { buildDb } from "@/lib/db";
import { extractCOIFromPdf } from "@/lib/coi/extract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ResendAttachment {
  filename: string;
  content: string; // base64-encoded file content
  contentType: string;
}

interface ResendInboundPayload {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  attachments?: ResendAttachment[];
}

function isPdf(attachment: ResendAttachment): boolean {
  return (
    attachment.contentType === "application/pdf" ||
    attachment.filename?.toLowerCase().endsWith(".pdf")
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Validate webhook secret if configured
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = req.headers.get("svix-signature") ?? req.headers.get("x-resend-signature");
    if (!signature || signature !== webhookSecret) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  let payload: ResendInboundPayload;
  try {
    payload = (await req.json()) as ResendInboundPayload;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const pdfAttachments = (payload.attachments ?? []).filter(isPdf);
  if (pdfAttachments.length === 0) {
    return NextResponse.json(
      { message: "no PDF attachments found; skipping" },
      { status: 200 }
    );
  }

  const db = buildDb();
  const results: Array<{ filename: string; certificateId: string; requiresReview: boolean }> = [];

  for (const attachment of pdfAttachments) {
    const certificateId = crypto.randomUUID();

    // Create a placeholder certificate record before extraction
    await db.execute(
      `INSERT INTO coi_certificates (
         id, filename, source, sender_email, subject,
         extraction_status, created_at, updated_at
       ) VALUES ($1, $2, 'email', $3, $4, 'pending', NOW(), NOW())`,
      certificateId,
      attachment.filename,
      payload.from ?? "unknown",
      payload.subject ?? "",
    );

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = Buffer.from(attachment.content, "base64");
    } catch {
      await db.execute(
        `UPDATE coi_certificates SET extraction_status = 'failed', updated_at = NOW() WHERE id = $1`,
        certificateId,
      );
      continue;
    }

    try {
      const output = await extractCOIFromPdf({
        pdfBuffer,
        filename: attachment.filename,
        certificateId,
      });
      results.push({
        filename: attachment.filename,
        certificateId,
        requiresReview: output.requiresReview,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db.execute(
        `UPDATE coi_certificates
         SET extraction_status = 'failed',
             extraction_error  = $1,
             updated_at        = NOW()
         WHERE id = $2`,
        message,
        certificateId,
      );
    }
  }

  return NextResponse.json({ processed: results }, { status: 200 });
}
