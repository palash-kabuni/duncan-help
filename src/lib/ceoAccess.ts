/**
 * Single source of truth for CEO Briefing access control.
 * If this email ever changes, also update:
 *  - supabase/functions/ceo-briefing/index.ts (CEO_EMAIL constant)
 *  - supabase/functions/norman-chat/index.ts (CEO_EMAIL constant)
 *  - RLS policies on `ceo_briefings` table
 */
export const CEO_EMAIL = "nimesh@kabuni.com";

export const isCEO = (email: string | null | undefined): boolean =>
  (email ?? "").toLowerCase() === CEO_EMAIL;
