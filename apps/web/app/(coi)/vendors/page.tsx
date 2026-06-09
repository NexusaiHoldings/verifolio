/**
 * /vendors — vendor registry list page.
 *
 * Server component. Requires an authenticated session. Supports search via
 * the ?q= query param (handled server-side for SEO + accessibility).
 */
import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCOIUser, resolveOrgId } from "@/lib/coi/access";
import { listVendors } from "@/lib/coi/vendors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  searchParams: { q?: string; status?: string; page?: string };
}

export default async function VendorsPage({
  searchParams,
}: PageProps): Promise<JSX.Element> {
  const user = await getCOIUser();
  if (!user) redirect("/login");

  const orgId = resolveOrgId(user.id);
  const search = searchParams.q ?? "";
  const status = searchParams.status ?? "active";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const limit = 50;
  const offset = (page - 1) * limit;

  let vendors: Awaited<ReturnType<typeof listVendors>> = [];
  let fetchError: string | null = null;

  try {
    vendors = await listVendors(orgId, { search, status, limit, offset });
  } catch (err) {
    fetchError = `Failed to load vendors: ${String(err)}`;
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Vendors</h1>
          <p className="mt-1 text-sm text-gray-500">
            Contractors and service providers tracked for COI compliance.
          </p>
        </div>
        <Link
          href="/vendors/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Add vendor
        </Link>
      </div>

      {/* Search + filter bar */}
      <form method="GET" className="flex flex-wrap gap-3">
        <input
          type="text"
          name="q"
          defaultValue={search}
          placeholder="Search by name, trade, or email…"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="">All statuses</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Search
        </button>
        {(search || status !== "active") && (
          <Link
            href="/vendors"
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Clear
          </Link>
        )}
      </form>

      {fetchError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {fetchError}
        </div>
      )}

      {vendors.length === 0 && !fetchError ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
          {search
            ? `No vendors match "${search}".`
            : "No vendors yet. Add your first vendor to get started."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left font-medium text-gray-700">Name</th>
                <th className="p-3 text-left font-medium text-gray-700">Trade</th>
                <th className="p-3 text-left font-medium text-gray-700">Contact</th>
                <th className="p-3 text-left font-medium text-gray-700">License #</th>
                <th className="p-3 text-left font-medium text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vendors.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-gray-50">
                  <td className="p-3">
                    <Link
                      href={`/vendors/${encodeURIComponent(vendor.id)}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {vendor.name}
                    </Link>
                  </td>
                  <td className="p-3 text-gray-700">{vendor.trade ?? "—"}</td>
                  <td className="p-3 text-gray-700">
                    {vendor.contact_email ? (
                      <a
                        href={`mailto:${vendor.contact_email}`}
                        className="text-blue-500 hover:underline"
                      >
                        {vendor.contact_email}
                      </a>
                    ) : (
                      "—"
                    )}
                    {vendor.contact_phone && (
                      <div className="text-xs text-gray-400">{vendor.contact_phone}</div>
                    )}
                  </td>
                  <td className="p-3 text-gray-700">
                    {vendor.license_number ?? "—"}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        vendor.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {vendor.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {vendors.length === limit && (
        <div className="flex justify-end gap-2">
          {page > 1 && (
            <Link
              href={`/vendors?q=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&page=${page - 1}`}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Previous
            </Link>
          )}
          <Link
            href={`/vendors?q=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&page=${page + 1}`}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Next
          </Link>
        </div>
      )}
    </main>
  );
}
