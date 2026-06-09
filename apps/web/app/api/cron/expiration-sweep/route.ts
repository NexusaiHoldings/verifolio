/**
 * GET /api/cron/expiration-sweep — daily COI expiration sweep.
 *
 * Identifies COIs expiring within 30/15/7/0 days and non-compliant vendors,
 * then dispatches templated email reminders to vendor contacts via Resend.
 * Reminder sequences are configurable per property (frequency, lead time,
 * escalation to management company staff).
 *
 * Schedule: daily at 08:00 UTC (vercel.json crons). Auth: CRON_SECRET bearer.
 */

import { NextResponse } from "next/server";
import { buildDb } from "@/lib/db";
import { buildEventBus } from "@/lib/events";
import { runExpirationSweep } from "@/lib/coi/reminder-scheduler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!cronAuthorized(request)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const db = buildDb();
  const events = buildEventBus();

  let summary;
  try {
    summary = await runExpirationSweep(db, events);
  } catch (e) {
    console.error("[cron/expiration-sweep] sweep failed:", String(e));
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }

  console.log("[cron/expiration-sweep] completed", JSON.stringify(summary));
  return NextResponse.json({
    ok: true,
    expiration_reminders_sent: summary.expiration_reminders_sent,
    noncompliance_reminders_sent: summary.noncompliance_reminders_sent,
    escalations_sent: summary.escalations_sent,
    error_count: summary.errors.length,
    errors: summary.errors.slice(0, 20),
  });
}
