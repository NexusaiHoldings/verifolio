/**
 * /review-queue — operator-facing COI human review queue.
 *
 * Shows extractions where AI confidence fell below the acceptance threshold
 * or a compliance dispute was escalated. Accessible to any authenticated user
 * (operators, reviewers, admins). Escalated items sort to the top.
 */

import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import { listPendingExtractions } from "@/lib/coi/review-handler";
import type { ExtractionSummary } from "@/lib/coi/review-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function StatusBadge({ status }: { status: string }): JSX.Element {
  const styles: Record<string, string> = {
    pending_review: "bg-yellow-100 text-yellow-800",
    escalated: "bg-red-100 text-red-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-gray-100 text-gray-700",
  };
  const cls = styles[status] ?? "bg-gray-100 text-gray-700";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {status.replace(/_/g, "\u00a0")}
    </span>
  );
}

function ConfidenceBar({ score }: { score: number | null }): JSX.Element {
  if (score === null) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  const pct = Math.round(score * 100);
  const barColor =
    pct >= 80 ? "bg-green-400" : pct >= 60 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-1.5 rounded-full ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-600">{pct}%</span>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default async function ReviewQueuePage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const extractions: ExtractionSummary[] = await listPendingExtractions();
  const escalatedCount = extractions.filter((e) => e.status === "escalated").length;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            COI Review Queue
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Low-confidence AI extractions and escalated compliance disputes
            awaiting human review.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {escalatedCount > 0 && (
            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
              {escalatedCount} escalated
            </span>
          )}
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
            {extractions.length} pending
          </span>
        </div>
      </div>

      {escalatedCount > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            {escalatedCount} escalated dispute
            {escalatedCount !== 1 ? "s" : ""} require priority attention.
            These appear at the top of the queue.
          </p>
        </div>
      )}

      {extractions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <p className="font-medium text-gray-600">Queue is empty</p>
          <p className="mt-1 text-sm text-gray-400">
            Items appear here when AI extraction confidence falls below the
            acceptance threshold or a compliance dispute is escalated.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="p-3">Vendor</th>
                <th className="p-3">Policy #</th>
                <th className="p-3">Type</th>
                <th className="p-3">Confidence</th>
                <th className="p-3">Status</th>
                <th className="p-3">Submitted</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {extractions.map((ext) => (
                <tr
                  key={ext.id}
                  className={
                    ext.status === "escalated"
                      ? "bg-red-50 hover:bg-red-100"
                      : "hover:bg-gray-50"
                  }
                >
                  <td className="p-3 font-medium text-gray-900">
                    {ext.vendor_name ?? (
                      <span className="text-gray-400">Unknown vendor</span>
                    )}
                  </td>
                  <td className="p-3 font-mono text-xs text-gray-700">
                    {ext.policy_number ?? "—"}
                  </td>
                  <td className="p-3 text-gray-700">{ext.insurance_type ?? "—"}</td>
                  <td className="p-3">
                    <ConfidenceBar score={ext.confidence_score} />
                  </td>
                  <td className="p-3">
                    <StatusBadge status={ext.status} />
                  </td>
                  <td className="p-3 text-xs text-gray-500">
                    {formatDate(ext.created_at)}
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/review-queue/${encodeURIComponent(ext.id)}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
