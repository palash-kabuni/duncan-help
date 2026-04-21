/**
 * Single source of truth for CEO Briefing access control.
 * If this allowlist ever changes, also update:
 *  - supabase/functions/ceo-briefing/index.ts (CEO_EMAILS)
 *  - supabase/functions/ceo-briefing-status/index.ts (CEO_EMAILS)
 *  - supabase/functions/norman-chat/index.ts (CEO_EMAILS)
 *  - supabase/functions/send-ceo-briefing-actions/index.ts (CEO_EMAILS)
 *  - RLS policies on `ceo_briefings` table
 */
export const CEO_EMAILS = ["nimesh@kabuni.com", "palash@kabuni.com"] as const;

/** @deprecated use CEO_EMAILS. Kept for backwards-compat with older imports. */
export const CEO_EMAIL = CEO_EMAILS[0];

export const isCEO = (email: string | null | undefined): boolean =>
  CEO_EMAILS.includes(((email ?? "").toLowerCase()) as (typeof CEO_EMAILS)[number]);
