/**
 * /help/[slug] — a single KB article (substrate-lego-wiring-001 Phase 2).
 * Server-renders the article body from @nexus/support-and-help. The body is
 * plain text with blank-line paragraph breaks — preserved via pre-line (the
 * old version's Tailwind `whitespace-pre-wrap` was dead code, so articles
 * rendered as a single wall of text).
 */
import type { JSX } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { handleGetArticle } from "@nexus/support-and-help";
import { buildDb } from "@/lib/db";
import { buildEventBus } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Article {
  title: string;
  body: string;
  category?: string | null;
  updated_at?: string;
}

export default async function ArticlePage({
  params,
}: {
  params: { slug: string };
}): Promise<JSX.Element> {
  let article: Article | null = null;
  const result = await handleGetArticle(
    { db: buildDb(), events: buildEventBus() },
    params.slug,
  );
  if (result.status === 200 && typeof result.body === "object") {
    article = (result.body as { article?: Article }).article ?? null;
  }
  if (!article) notFound();

  return (
    <main>
      <nav aria-label="Breadcrumb" style={{ marginBottom: "1rem" }}>
        <Link href="/help" style={{ fontSize: "0.9rem" }}>
          ← Help Center
        </Link>
      </nav>
      <h1 style={{ marginBottom: "1rem" }}>{article.title}</h1>
      <article
        style={{
          whiteSpace: "pre-line",
          lineHeight: 1.7,
          maxWidth: "44rem",
        }}
      >
        {article.body}
      </article>
      <div className="cta-band" style={{ marginTop: "2.5rem", padding: "1.5rem", maxWidth: "44rem" }}>
        <p style={{ margin: 0 }}>
          Still stuck? Use the support button in the corner or{" "}
          <Link href="/support">open a ticket</Link> and we&rsquo;ll get back to you.
        </p>
      </div>
    </main>
  );
}
