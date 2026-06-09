/**
 * /vendors — COI vendor registry list page.
 * Server component; requires authenticated session.
 */

import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCoiSession } from "@/lib/coi/access";
import { listVendors } from "@/lib/coi/vendors";
import type { CoiVendor } from "@/lib/coi/vendors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface VendorsPageProps {
  searchParams?: { q?: string };
}

export default async function VendorsPage({
  searchParams,
}: VendorsPageProps): Promise<JSX.Element> {
  const session = await getCoiSession();
  if (!session) redirect("/login");

  const query = searchParams?.q?.trim() ?? "";

  let vendors: CoiVendor[] = [];
  try {
    vendors = await listVendors(session.orgId, query || undefined);
  } catch {
    vendors = [];
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Vendors</h1>
        <Link
          href="/vendors/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add vendor
        </Link>
      </div>

      <form method="GET" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search vendors by name, trade, or contact…"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Search
        </button>
        {query && (
          <Link
            href="/vendors"
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Clear
          </Link>
        )}
      </form>

      {vendors.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 py-12 text-center">
          <p className="text-gray-500">
            {query
              ? `No vendors match "${query}".`
              : "No vendors yet. Add your first vendor to get started."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left font-medium text-gray-700">Name</th>
                <th className="p-3 text-left font-medium text-gray-700">Trade</th>
                <th className="p-3 text-left font-medium text-gray-700">Contact</th>
                <th className="p-3 text-left font-medium text-gray-700">Email</th>
                <th className="p-3 text-left font-medium text-gray-700">Phone</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr
                  key={v.id}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="p-3">
                    <Link
                      href={`/vendors/${encodeURIComponent(v.id)}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {v.name}
                    </Link>
                  </td>
                  <td className="p-3 text-gray-600">{v.trade_category ?? "—"}</td>
                  <td className="p-3 text-gray-600">{v.contact_name ?? "—"}</td>
                  <td className="p-3 text-gray-600">
                    {v.contact_email ? (
                      <a
                        href={`mailto:${v.contact_email}`}
                        className="text-blue-600 hover:underline"
                      >
                        {v.contact_email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3 text-gray-600">{v.contact_phone ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        {vendors.length} vendor{vendors.length !== 1 ? "s" : ""} shown
      </p>
    </main>
  );
}
