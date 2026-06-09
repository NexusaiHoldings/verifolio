/**
 * /vendors/[id] — COI vendor detail / edit page.
 * Server component; requires authenticated session.
 * Use id="new" to render a blank creation form.
 */

import type { JSX } from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCoiSession } from "@/lib/coi/access";
import { getVendor, createVendor, updateVendor } from "@/lib/coi/vendors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface VendorDetailPageProps {
  params: { id: string };
  searchParams?: { saved?: string; error?: string };
}

export default async function VendorDetailPage({
  params,
  searchParams,
}: VendorDetailPageProps): Promise<JSX.Element> {
  const session = await getCoiSession();
  if (!session) redirect("/login");

  const isNew = params.id === "new";

  let vendor = null;
  if (!isNew) {
    try {
      vendor = await getVendor(session.orgId, params.id);
    } catch {
      vendor = null;
    }
    if (!vendor) notFound();
  }

  const saved = searchParams?.saved === "1";
  const errorMsg = searchParams?.error ?? null;

  const orgId = session.orgId;
  const vendorId = params.id;

  async function handleSave(data: FormData): Promise<never> {
    "use server";
    const name = (data.get("name") as string | null)?.trim() ?? "";
    if (!name) {
      redirect(`/vendors/${vendorId}?error=Name+is+required`);
    }

    const input = {
      name,
      trade_category: (data.get("trade_category") as string | null) || null,
      contact_name: (data.get("contact_name") as string | null) || null,
      contact_email: (data.get("contact_email") as string | null) || null,
      contact_phone: (data.get("contact_phone") as string | null) || null,
      address: (data.get("address") as string | null) || null,
      notes: (data.get("notes") as string | null) || null,
    };

    // Compute the destination URL before calling redirect() (which throws
    // internally) so that DB errors are caught separately.
    let dest: string;
    try {
      if (vendorId === "new") {
        const created = await createVendor(orgId, input);
        dest = `/vendors/${created.id}?saved=1`;
      } else {
        await updateVendor(orgId, vendorId, input);
        dest = `/vendors/${vendorId}?saved=1`;
      }
    } catch (err) {
      const msg = encodeURIComponent(
        err instanceof Error ? err.message : "Save failed",
      );
      dest = `/vendors/${vendorId}?error=${msg}`;
    }
    redirect(dest);
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="flex items-center gap-4">
        <Link href="/vendors" className="text-sm text-blue-600 hover:underline">
          ← All vendors
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">
          {isNew ? "New vendor" : (vendor?.name ?? "Vendor")}
        </h1>
      </div>

      {saved && (
        <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
          Vendor saved successfully.
        </div>
      )}
      {errorMsg && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      <form action={handleSave} className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700"
          >
            Vendor name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={vendor?.name ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="trade_category"
            className="block text-sm font-medium text-gray-700"
          >
            Trade / category
          </label>
          <input
            id="trade_category"
            name="trade_category"
            type="text"
            defaultValue={vendor?.trade_category ?? ""}
            placeholder="e.g. Plumbing, HVAC, Landscaping"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="contact_name"
              className="block text-sm font-medium text-gray-700"
            >
              Contact name
            </label>
            <input
              id="contact_name"
              name="contact_name"
              type="text"
              defaultValue={vendor?.contact_name ?? ""}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="contact_phone"
              className="block text-sm font-medium text-gray-700"
            >
              Phone
            </label>
            <input
              id="contact_phone"
              name="contact_phone"
              type="tel"
              defaultValue={vendor?.contact_phone ?? ""}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="contact_email"
            className="block text-sm font-medium text-gray-700"
          >
            Contact email
          </label>
          <input
            id="contact_email"
            name="contact_email"
            type="email"
            defaultValue={vendor?.contact_email ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="address"
            className="block text-sm font-medium text-gray-700"
          >
            Address
          </label>
          <input
            id="address"
            name="address"
            type="text"
            defaultValue={vendor?.address ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-gray-700"
          >
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={vendor?.notes ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {isNew ? "Create vendor" : "Save changes"}
          </button>
          <Link
            href="/vendors"
            className="rounded-md border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>

      {!isNew && vendor && (
        <div className="border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-400">
            ID: {vendor.id} &nbsp;·&nbsp; Created:{" "}
            {new Date(vendor.created_at).toLocaleDateString()} &nbsp;·&nbsp;
            Updated: {new Date(vendor.updated_at).toLocaleDateString()}
          </p>
        </div>
      )}
    </main>
  );
}
