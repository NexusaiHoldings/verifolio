/**
 * /vendors — vendor registry list page.
 *
 * Server component. Requires an authenticated session. Supports search via
 * the ?q= query param (handled server-side for SEO + accessibility).
 * Substrate element defaults + helpers only — the app has no Tailwind
 * (substrate-ui-baseline-001), so utility classes would be dead code.
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
    <main>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ marginBottom: "0.25rem" }}>Vendors</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            Contractors and service providers tracked for COI compliance.
          </p>
        </div>
        <Link href="/vendors/new" className="btn">
          Add vendor
        </Link>
      </div>

      {/* Search + filter bar */}
      <form method="GET" className="toolbar" style={{ marginTop: "1rem" }}>
        <label htmlFor="vendor-search" style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1, minWidth: 220 }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Search vendors</span>
          <input
            id="vendor-search"
            type="text"
            name="q"
            defaultValue={search}
            placeholder="e.g. roofing, Acme, joe@…"
          />
        </label>
        <label htmlFor="vendor-status" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Status</span>
          <select id="vendor-status" name="status" defaultValue={status}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="">All statuses</option>
          </select>
        </label>
        <button type="submit" style={{ alignSelf: "flex-end" }}>
          Search
        </button>
        {(search || status !== "active") && (
          <Link href="/vendors" style={{ alignSelf: "flex-end", fontSize: "0.9rem" }}>
            Clear filters
          </Link>
        )}
      </form>

      {fetchError && (
        <div
          role="alert"
          style={{
            border: "1px solid color-mix(in srgb, var(--substrate-danger) 40%, var(--substrate-border))",
            background: "color-mix(in srgb, var(--substrate-danger) 8%, var(--substrate-bg))",
            color: "var(--substrate-danger)",
            borderRadius: "var(--substrate-radius)",
            padding: "0.75rem 1rem",
            marginTop: "1rem",
          }}
        >
          {fetchError}
        </div>
      )}

      {vendors.length === 0 && !fetchError ? (
        <div className="empty" style={{ marginTop: "1.25rem" }}>
          {search ? (
            <>
              <p style={{ marginTop: 0 }}>No vendors match &ldquo;{search}&rdquo;.</p>
              <Link href="/vendors" className="btn secondary">
                Clear the search
              </Link>
            </>
          ) : (
            <>
              <p style={{ marginTop: 0 }}>
                No vendors yet. Add the contractors and service providers who work on your
                properties, then upload their certificates of insurance to track compliance.
              </p>
              <Link href="/vendors/new" className="btn">
                Add your first vendor
              </Link>
            </>
          )}
        </div>
      ) : vendors.length > 0 ? (
        <div className="card" style={{ marginTop: "1.25rem", padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "0.75rem" }}>Name</th>
                <th style={{ textAlign: "left", padding: "0.75rem" }}>Trade</th>
                <th style={{ textAlign: "left", padding: "0.75rem" }}>Contact</th>
                <th style={{ textAlign: "left", padding: "0.75rem" }}>License #</th>
                <th style={{ textAlign: "left", padding: "0.75rem" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={vendor.id} style={{ borderTop: "1px solid var(--substrate-border)" }}>
                  <td style={{ padding: "0.75rem" }}>
                    <Link
                      href={`/vendors/${encodeURIComponent(vendor.id)}`}
                      style={{ fontWeight: 600 }}
                    >
                      {vendor.name}
                    </Link>
                  </td>
                  <td style={{ padding: "0.75rem" }}>{vendor.trade ?? "—"}</td>
                  <td style={{ padding: "0.75rem" }}>
                    {vendor.contact_email ? (
                      <a href={`mailto:${vendor.contact_email}`}>{vendor.contact_email}</a>
                    ) : (
                      "—"
                    )}
                    {vendor.contact_phone && (
                      <div className="muted" style={{ fontSize: "0.82rem" }}>
                        {vendor.contact_phone}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "0.75rem" }}>{vendor.license_number ?? "—"}</td>
                  <td style={{ padding: "0.75rem" }}>
                    <span className={vendor.status === "active" ? "pill success" : "pill"}>
                      {vendor.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Pagination */}
      {vendors.length === limit && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
          {page > 1 && (
            <Link
              href={`/vendors?q=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&page=${page - 1}`}
              className="btn secondary"
            >
              Previous
            </Link>
          )}
          <Link
            href={`/vendors?q=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&page=${page + 1}`}
            className="btn secondary"
          >
            Next
          </Link>
        </div>
      )}
    </main>
  );
}
