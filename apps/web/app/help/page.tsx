/**
 * /help — knowledge base index (substrate-lego-wiring-001 Phase 2).
 * Server-renders published articles from @nexus/support-and-help, grouped by
 * category. Substrate element defaults + helpers only — no Tailwind in this
 * app, so utility classes would be dead code (the old version's dead
 * `justify-between` was concatenating title+category into "supportbasics").
 */
import type { JSX } from "react";
import Link from "next/link";
import { handleListArticles } from "@nexus/support-and-help";
import { buildDb } from "@/lib/db";
import { buildEventBus } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ArticleSummary {
  slug: string;
  title: string;
  category?: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  basics: "Getting started",
  vendors: "Vendors",
  certificates: "Certificates & compliance",
};

function labelFor(category: string): string {
  return CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1);
}

export default async function HelpPage(): Promise<JSX.Element> {
  let articles: ArticleSummary[] = [];
  try {
    const result = await handleListArticles(
      { db: buildDb(), events: buildEventBus() },
      { limit: 100 },
    );
    if (result.status === 200 && typeof result.body === "object") {
      articles = ((result.body as { articles?: ArticleSummary[] }).articles) ?? [];
    }
  } catch {
    articles = [];
  }

  const byCategory = new Map<string, ArticleSummary[]>();
  for (const a of articles) {
    const key = a.category ?? "general";
    const list = byCategory.get(key) ?? [];
    list.push(a);
    byCategory.set(key, list);
  }

  return (
    <main>
      <h1 style={{ marginBottom: "0.25rem" }}>Help Center</h1>
      <p className="muted" style={{ marginTop: 0, maxWidth: "42rem" }}>
        Guides for tracking vendor certificates of insurance with Verifolio. Can&rsquo;t find
        what you need? Use the support button in the corner or{" "}
        <Link href="/support">open a ticket</Link>.
      </p>

      {articles.length > 0 ? (
        Array.from(byCategory.entries()).map(([category, list]) => (
          <section key={category} style={{ marginTop: "1.75rem" }}>
            <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>{labelFor(category)}</h2>
            <div className="card" style={{ padding: 0 }}>
              {list.map((a, i) => (
                <Link
                  key={a.slug}
                  href={`/help/${encodeURIComponent(a.slug)}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "0.85rem 1.1rem",
                    borderTop: i > 0 ? "1px solid var(--substrate-border)" : "none",
                    textDecoration: "none",
                    color: "var(--substrate-fg)",
                    fontWeight: 600,
                  }}
                >
                  <span>{a.title}</span>
                  <span aria-hidden="true" className="muted">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="empty" style={{ marginTop: "1.25rem" }}>
          <p style={{ marginTop: 0 }}>
            Our knowledge base is being built out. Use the support button in the corner to ask a
            question or open a ticket — we&rsquo;re here to help.
          </p>
          <Link href="/support" className="btn secondary">
            Open a support ticket
          </Link>
        </div>
      )}

      <p style={{ marginTop: "2rem", fontSize: "0.9rem" }}>
        Need to talk to someone? <Link href="/support">View your support tickets</Link>.
      </p>
    </main>
  );
}
