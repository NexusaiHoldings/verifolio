/**
 * GET /api/cron/expiration-sweep
 *
 * Daily Vercel Cron job that sweeps for COIs expiring within 30/15/7/0 days
 * and non-compliant vendors, then dispatches templated email reminders to
 * vendor contacts via Resend.
 *
 * Auth: when CRON_SECRET is set, Vercel sends `Authorization: Bearer <secret>`.
 * In dev (no CRON_SECRET) the route runs unguarded.
 *
 * Schedule: daily (configure in vercel.json crons).
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

  let result;
  try {
    result = await runExpirationSweep(db, events);
  } catch (err) {
    console.error("[cron/expiration-sweep] unhandled error:", err);
    return NextResponse.json(
      { error: String((err as Error).message) },
      { status: 500 },
    );
  }

  console.log(
    `[cron/expiration-sweep] done — expiring=${result.expiring_processed} non_compliant=${result.non_compliant_processed} sent=${result.emails_sent} skipped=${result.emails_skipped} errors=${result.errors.length}`,
  );

  return NextResponse.json({
    ok: true,
    expiring_processed: result.expiring_processed,
    non_compliant_processed: result.non_compliant_processed,
    emails_sent: result.emails_sent,
    emails_skipped: result.emails_skipped,
    error_count: result.errors.length,
    errors: result.errors.slice(0, 20),
  });
}
