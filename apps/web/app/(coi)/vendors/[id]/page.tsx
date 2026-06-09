/**
 * /vendors/[id] — vendor detail + edit page.
 *
 * Server component. Shows vendor details and the list of properties the
 * vendor is assigned to. Edit form posts to a server action.
 */
import type { JSX } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCOIUser, resolveOrgId } from "@/lib/coi/access";
import {
  getVendor,
  listVendorProperties,
  updateVendor,
  archiveVendor,
} from "@/lib/coi/vendors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: { id: string };
}

export default async function VendorDetailPage({
  params,
}: PageProps): Promise<JSX.Element> {
  const user = await getCOIUser();
  if (!user) redirect("/login");

  const orgId = resolveOrgId(user.id);
  const vendorId = params.id;

  let vendor: Awaited<ReturnType<typeof getVendor>> = null;
  let properties: Awaited<ReturnType<typeof listVendorProperties>> = [];
  let fetchError: string | null = null;

  try {
    vendor = await getVendor(orgId, vendorId);
    if (!vendor) notFound();
    properties = await listVendorProperties(vendorId);
  } catch (err) {
    fetchError = `Failed to load vendor: ${String(err)}`;
  }

  // Server actions for update and archive
  async function handleUpdate(formData: FormData): Promise<void> {
    "use server";
    const serverUser = await getCOIUser();
    if (!serverUser) return;
    const serverOrgId = resolveOrgId(serverUser.id);
    await updateVendor(serverOrgId, vendorId, {
      name: String(formData.get("name") ?? "").trim(),
      trade: String(formData.get("trade") ?? "").trim() || undefined,
      license_number:
        String(formData.get("license_number") ?? "").trim() || undefined,
      contact_email:
        String(formData.get("contact_email") ?? "").trim() || undefined,
      contact_phone:
        String(formData.get("contact_phone") ?? "").trim() || undefined,
      address: String(formData.get("address") ?? "").trim() || undefined,
      notes: String(formData.get("notes") ?? "").trim() || undefined,
      status: String(formData.get("status") ?? "active"),
    });
    redirect(`/vendors/${vendorId}`);
  }

  async function handleArchive(): Promise<void> {
    "use server";
    const serverUser = await getCOIUser();
    if (!serverUser) return;
    const serverOrgId = resolveOrgId(serverUser.id);
    await archiveVendor(serverOrgId, vendorId);
    redirect("/vendors");
  }

  if (fetchError || !vendor) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/vendors" className="text-sm text-blue-600 hover:underline">
          ← Back to vendors
        </Link>
        <div
          role="alert"
          className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {fetchError ?? "Vendor not found."}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div className="flex items-center justify-between">
        <Link href="/vendors" className="text-sm text-blue-600 hover:underline">
          ← Back to vendors
        </Link>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            vendor.status === "active"
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {vendor.status}
        </span>
      </div>

      <h1 className="text-2xl font-semibold text-gray-900">{vendor.name}</h1>

      {/* Edit form */}
      <section className="rounded-md border border-gray-200 p-6">
        <h2 className="mb-4 text-base font-medium text-gray-800">Vendor details</h2>
        <form action={handleUpdate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Name *</span>
              <input
                type="text"
                name="name"
                required
                defaultValue={vendor.name}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Trade / specialty</span>
              <input
                type="text"
                name="trade"
                defaultValue={vendor.trade ?? ""}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">License number</span>
              <input
                type="text"
                name="license_number"
                defaultValue={vendor.license_number ?? ""}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Status</span>
              <select
                name="status"
                defaultValue={vendor.status}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Contact email</span>
              <input
                type="email"
                name="contact_email"
                defaultValue={vendor.contact_email ?? ""}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Contact phone</span>
              <input
                type="tel"
                name="contact_phone"
                defaultValue={vendor.contact_phone ?? ""}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Address</span>
            <input
              type="text"
              name="address"
              defaultValue={vendor.address ?? ""}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Notes</span>
            <textarea
              name="notes"
              rows={3}
              defaultValue={vendor.notes ?? ""}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Save changes
            </button>
          </div>
        </form>
      </section>

      {/* Assigned properties */}
      <section className="rounded-md border border-gray-200 p-6">
        <h2 className="mb-4 text-base font-medium text-gray-800">
          Assigned properties ({properties.length})
        </h2>
        {properties.length === 0 ? (
          <p className="text-sm text-gray-500">
            No properties assigned to this vendor yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {properties.map((assignment) => (
              <li key={assignment.property_id} className="py-2">
                <Link
                  href={`/properties/${encodeURIComponent(assignment.property_id)}`}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  {assignment.property_name}
                </Link>
                <span className="ml-2 text-xs text-gray-400">
                  assigned {new Date(assignment.assigned_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Danger zone */}
      {vendor.status === "active" && (
        <section className="rounded-md border border-red-200 p-6">
          <h2 className="mb-2 text-base font-medium text-red-700">Danger zone</h2>
          <p className="mb-4 text-sm text-gray-600">
            Archiving this vendor will remove it from active COI tracking. This
            can be reversed by setting the status back to active.
          </p>
          <form action={handleArchive}>
            <button
              type="submit"
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Archive vendor
            </button>
          </form>
        </section>
      )}

      <div className="text-xs text-gray-400">
        Created {new Date(vendor.created_at).toLocaleString()} · Last updated{" "}
        {new Date(vendor.updated_at).toLocaleString()}
      </div>
    </main>
  );
}
