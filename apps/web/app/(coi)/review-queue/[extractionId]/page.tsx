/**
 * /review-queue/[extractionId] — detail view for a single COI extraction.
 *
 * Reviewer can:
 *   - Correct key extracted field values (vendor, policy #, type, dates, coverage).
 *   - Choose to approve or reject the extraction.
 *   - Add free-text reviewer notes.
 *
 * On approval: the Server Action calls submitReview, which promotes the
 * corrected extraction to coi_certificates and sets compliance_status =
 * 'pending_scoring' so the scoring pipeline re-evaluates it automatically.
 *
 * Uses Next.js 14 Server Actions for form submission (no client JS required).
 */

import type { JSX } from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import { getExtractionDetail, submitReview } from "@/lib/coi/review-handler";
import type { ExtractionDetail } from "@/lib/coi/review-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function FieldRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}): JSX.Element {
  return (
    <div className="flex items-baseline justify-between border-b border-gray-100 py-2 last:border-0">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className="text-sm text-gray-800">
        {value !== null && value !== undefined && value !== "" ? String(value) : (
          <span className="text-gray-400">not extracted</span>
        )}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }): JSX.Element {
  const styles: Record<string, string> = {
    pending_review: "bg-yellow-100 text-yellow-800",
    escalated: "bg-red-100 text-red-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-gray-100 text-gray-700",
  };
  const cls = styles[status] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${cls}`}>
      {status.replace(/_/g, "\u00a0")}
    </span>
  );
}

function ConfidenceIndicator({ score }: { score: number | null }): JSX.Element {
  if (score === null) return <span className="text-sm text-gray-400">Not available</span>;
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "text-green-700" : pct >= 60 ? "text-yellow-700" : "text-red-700";
  const barColor = pct >= 80 ? "bg-green-400" : pct >= 60 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-2 rounded-full ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-sm font-semibold ${color}`}>{pct}%</span>
    </div>
  );
}

export default async function ExtractionDetailPage({
  params,
  searchParams,
}: {
  params: { extractionId: string };
  searchParams: Record<string, string | undefined>;
}): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const extraction: ExtractionDetail | null = await getExtractionDetail(
    params.extractionId,
  );
  if (!extraction) notFound();

  const isReviewed =
    extraction.status === "approved" || extraction.status === "rejected";

  const errorMsg =
    searchParams.error === "invalid_decision"
      ? "Please select Approve or Reject before submitting."
      : searchParams.error === "submit_failed"
      ? "Review submission failed. Please try again."
      : null;

  // Server Action: handles form POST, updates DB, and redirects.
  // Captures `params.extractionId` and `user.id` from the enclosing scope.
  async function handleReviewAction(formData: FormData): Promise<void> {
    "use server";

    const decision = formData.get("decision");
    if (decision !== "approved" && decision !== "rejected") {
      redirect(
        `/review-queue/${encodeURIComponent(params.extractionId)}?error=invalid_decision`,
      );
    }

    const notes = formData.get("notes");

    // Collect reviewer-corrected field values; only include non-empty entries.
    const correctedFields: Record<string, unknown> = {};

    const vendorName = formData.get("vendor_name");
    if (typeof vendorName === "string" && vendorName.trim() !== "") {
      correctedFields.vendor_name = vendorName.trim();
    }

    const policyNumber = formData.get("policy_number");
    if (typeof policyNumber === "string" && policyNumber.trim() !== "") {
      correctedFields.policy_number = policyNumber.trim();
    }

    const insuranceType = formData.get("insurance_type");
    if (typeof insuranceType === "string" && insuranceType.trim() !== "") {
      correctedFields.insurance_type = insuranceType.trim();
    }

    const effectiveDate = formData.get("effective_date");
    if (typeof effectiveDate === "string" && effectiveDate.trim() !== "") {
      correctedFields.effective_date = effectiveDate.trim();
    }

    const expirationDate = formData.get("expiration_date");
    if (typeof expirationDate === "string" && expirationDate.trim() !== "") {
      correctedFields.expiration_date = expirationDate.trim();
    }

    const coverageAmountRaw = formData.get("coverage_amount");
    if (typeof coverageAmountRaw === "string" && coverageAmountRaw.trim() !== "") {
      const parsed = parseFloat(coverageAmountRaw.trim());
      if (!isNaN(parsed)) correctedFields.coverage_amount = parsed;
    }

    const result = await submitReview({
      extractionId: params.extractionId,
      reviewerId: user.id,
      decision: decision as "approved" | "rejected",
      correctedFields:
        Object.keys(correctedFields).length > 0 ? correctedFields : undefined,
      notes: typeof notes === "string" && notes.trim() !== "" ? notes.trim() : undefined,
    });

    if (!result.success) {
      redirect(
        `/review-queue/${encodeURIComponent(params.extractionId)}?error=submit_failed`,
      );
    }

    redirect("/review-queue");
  }

  const extractedFieldEntries = Object.entries(extraction.extracted_fields).filter(
    ([key]) =>
      !["vendor_name", "policy_number", "insurance_type", "effective_date",
        "expiration_date", "coverage_amount"].includes(key),
  );

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      {/* Back navigation */}
      <Link href="/review-queue" className="text-sm text-blue-600 hover:underline">
        ← Back to review queue
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {extraction.vendor_name ?? "Unknown Vendor"}
          </h1>
          <p className="mt-0.5 font-mono text-xs text-gray-500">
            ID: {extraction.id}
          </p>
        </div>
        <StatusBadge status={extraction.status} />
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">{errorMsg}</p>
        </div>
      )}

      {/* Escalation notice */}
      {extraction.escalation_reason && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">Escalated dispute</p>
          <p className="mt-1 text-sm text-red-700">{extraction.escalation_reason}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* AI extraction summary */}
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            AI Extraction
          </h2>
          <div className="mb-4">
            <span className="mr-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Confidence
            </span>
            <ConfidenceIndicator score={extraction.confidence_score} />
          </div>
          <FieldRow label="Vendor" value={extraction.vendor_name} />
          <FieldRow label="Policy #" value={extraction.policy_number} />
          <FieldRow label="Type" value={extraction.insurance_type} />
          <FieldRow label="Effective Date" value={extraction.effective_date} />
          <FieldRow label="Expiration Date" value={extraction.expiration_date} />
          <FieldRow
            label="Coverage Amount"
            value={
              extraction.coverage_amount !== null
                ? `$${Number(extraction.coverage_amount).toLocaleString()}`
                : null
            }
          />
          {extraction.document_url && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <a
                href={extraction.document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                View source document ↗
              </a>
            </div>
          )}
        </section>

        {/* Additional extracted fields */}
        {extractedFieldEntries.length > 0 && (
          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Additional Extracted Fields
            </h2>
            {extractedFieldEntries.map(([key, val]) => (
              <FieldRow
                key={key}
                label={key.replace(/_/g, " ")}
                value={
                  val !== null && val !== undefined
                    ? typeof val === "object"
                      ? JSON.stringify(val)
                      : String(val)
                    : null
                }
              />
            ))}
          </section>
        )}
      </div>

      {/* Prior review result (read-only) */}
      {isReviewed && (
        <section className="rounded-lg border border-gray-200 bg-gray-50 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Review Decision (recorded)
          </h2>
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <span className="font-medium">Decision: </span>
              <StatusBadge status={extraction.status} />
            </p>
            {extraction.reviewer_notes && (
              <p>
                <span className="font-medium">Notes: </span>
                {extraction.reviewer_notes}
              </p>
            )}
            {extraction.reviewed_at && (
              <p>
                <span className="font-medium">Reviewed at: </span>
                {new Date(extraction.reviewed_at).toLocaleString()}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Review form (only for pending / escalated) */}
      {!isReviewed && (
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Submit Review
          </h2>
          <form action={handleReviewAction} className="space-y-5">
            {/* Editable field corrections */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-gray-700">
                Correct extracted values (leave blank to keep AI value)
              </legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="vendor_name"
                    className="block text-xs font-medium text-gray-600"
                  >
                    Vendor name
                  </label>
                  <input
                    id="vendor_name"
                    name="vendor_name"
                    type="text"
                    defaultValue={extraction.vendor_name ?? ""}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="policy_number"
                    className="block text-xs font-medium text-gray-600"
                  >
                    Policy number
                  </label>
                  <input
                    id="policy_number"
                    name="policy_number"
                    type="text"
                    defaultValue={extraction.policy_number ?? ""}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="insurance_type"
                    className="block text-xs font-medium text-gray-600"
                  >
                    Insurance type
                  </label>
                  <input
                    id="insurance_type"
                    name="insurance_type"
                    type="text"
                    defaultValue={extraction.insurance_type ?? ""}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="coverage_amount"
                    className="block text-xs font-medium text-gray-600"
                  >
                    Coverage amount ($)
                  </label>
                  <input
                    id="coverage_amount"
                    name="coverage_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={extraction.coverage_amount ?? ""}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="effective_date"
                    className="block text-xs font-medium text-gray-600"
                  >
                    Effective date
                  </label>
                  <input
                    id="effective_date"
                    name="effective_date"
                    type="date"
                    defaultValue={extraction.effective_date ?? ""}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="expiration_date"
                    className="block text-xs font-medium text-gray-600"
                  >
                    Expiration date
                  </label>
                  <input
                    id="expiration_date"
                    name="expiration_date"
                    type="date"
                    defaultValue={extraction.expiration_date ?? ""}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </fieldset>

            {/* Decision */}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-gray-700">
                Decision <span className="text-red-500">*</span>
              </legend>
              <div className="flex gap-6">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="decision"
                    value="approved"
                    className="text-green-600 focus:ring-green-500"
                  />
                  <span className="font-medium text-green-700">Approve</span>
                  <span className="text-xs text-gray-500">
                    — promote to certificates &amp; re-score
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="decision"
                    value="rejected"
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span className="font-medium text-red-700">Reject</span>
                  <span className="text-xs text-gray-500">
                    — mark extraction invalid
                  </span>
                </label>
              </div>
            </fieldset>

            {/* Notes */}
            <div>
              <label
                htmlFor="notes"
                className="block text-sm font-medium text-gray-700"
              >
                Reviewer notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Add context about your decision or corrections (optional)…"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Submit */}
            <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Submit review
              </button>
              <Link
                href="/review-queue"
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Cancel
              </Link>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
