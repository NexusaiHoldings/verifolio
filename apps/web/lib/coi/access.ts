/**
 * COI domain access control.
 * All COI pages require an authenticated session. org_id is resolved from
 * the ORG_ID environment variable (set per deployment).
 */

import { getSessionUser } from "@/lib/admin-auth";

export interface CoiSession {
  userId: string;
  email: string;
  orgId: string;
}

/**
 * Returns the current session as a CoiSession, or null if unauthenticated.
 * orgId falls back to a placeholder UUID when ORG_ID env is unset (dev only).
 */
export async function getCoiSession(): Promise<CoiSession | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const orgId = process.env.ORG_ID ?? "00000000-0000-0000-0000-000000000001";
  return { userId: user.id, email: user.email, orgId };
}
