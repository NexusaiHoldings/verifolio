/**
 * COI domain access helpers.
 *
 * Thin wrapper around the identity lego's session handler — resolves the
 * current authenticated user without requiring admin privileges. Property
 * managers, board members, and admins all use these pages.
 */

import { getSessionUser } from "@/lib/admin-auth";

export type { SessionUser } from "@/lib/admin-auth";

/**
 * Resolve the current session user for COI pages.
 * Returns null when the request is unauthenticated.
 */
export async function getCOIUser(): Promise<{ id: string; email: string } | null> {
  return getSessionUser();
}

/**
 * Return a fallback org_id for the current user. In production this would
 * come from @nexus/organizations-and-teams; for now we derive it from the
 * user id so multi-tenant isolation is preserved without the org lego call.
 */
export function resolveOrgId(userId: string): string {
  return userId;
}
