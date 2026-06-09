/**
 * /review-queue — COI Human Review Queue list page.
 *
 * Feature F1-007: Operator-facing queue for low-confidence AI extractions
 * and escalated compliance disputes. Lists all pending and in-review
 * extractions awaiting human decision.
 */
import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import { listPendingReviews } from "@/lib/coi/review-handler";
import type { PendingReview } from "@/lib/coi/review-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function confidenceBadge(score: number): JSX.Element {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80
      ? "bg-green-100 text-green-800"
      : pct >= 60
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${color}`}
    >
      {pct}%
    </span>
  );
}

function statusBadge(status: PendingReview["status"]): JSX.Element {
  const styles: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700",
    in_review: "bg-blue-100 text-blue-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-700"}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export default async function ReviewQueuePage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const reviews = await listPendingReviews().catch(() => [] as PendingReview[]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            COI Review Queue
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Low-confidence extractions and escalated compliance disputes
            awaiting human review.
          </p>
        </div>
        <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
          {reviews.length} pending
        </span>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-gray-500">
            No extractions are currently awaiting review.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Vendor
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Policy Type
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Confidence
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Reason
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Submitted
                </th>
                <th scope="col" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {reviews.map((review) => (
                <tr key={review.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {review.vendor_name ?? (
                      <span className="italic text-gray-400">Unknown</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {review.policy_type ?? (
                      <span className="italic text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {confidenceBadge(review.confidence_score)}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-sm text-gray-600">
                    {review.escalation_reason ? (
                      <span
                        title={review.escalation_reason}
                        className="block truncate"
                      >
                        {review.escalation_reason}
                      </span>
                    ) : (
                      <span className="italic text-gray-400">Low confidence</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {statusBadge(review.status)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(review.submitted_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <Link
                      href={`/review-queue/${review.extraction_id}`}
                      className="font-medium text-blue-600 hover:text-blue-800"
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
