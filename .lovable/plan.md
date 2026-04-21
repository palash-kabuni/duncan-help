

## Add Parmy (CTO) to CEO Action Routing

Small follow-up to the previously approved "Send team actions" plan — Parmy was missing from the leadership routing map.

### What changes

Add a 7th owner to the seeded `ceo_action_routing` table:

```text
owner_key      email                display_name
-------------  -------------------  ----------------
parmy_cto      parmy@kabuni.com     Parmy (CTO)
```

This makes Parmy a valid routing target so he receives any briefing items where `expected_owner` mentions "Parmy" or "CTO" (e.g. tech/platform risks surfaced by `risk_radar`, Azure DevOps execution gaps, or workstreams he owns).

### Why this matters now

Without Parmy in the routing table, any tech-domain action items would fall into the **"⚠ Unrouted actions"** bucket in the send dialog and never reach him. Adding him now (alongside the initial seed) means the very first send works end-to-end for the tech function.

### Optional: assign Parmy to a priority

Currently no entry in `PRIORITY_DEFINITIONS` lists Parmy as `expected_owner`. The 6 priorities are commercial / ops / product / finance / Duncan-automation focused. If you want Parmy to be the named owner for a tech-side priority (e.g. **"Duncan automates 25%"** is currently Palash-only — it could become *"Palash (Head of Duncan) + Parmy (CTO)"* since the platform underpins automation), say the word and that line gets updated too.

### Files

```text
EDIT supabase/migrations/<timestamp>_ceo_briefing_emails.sql
       - Seed row for parmy_cto / parmy@kabuni.com / Parmy (CTO)

EDIT supabase/functions/send-ceo-briefing-actions/index.ts
       - Owner-name → owner_key resolver recognises "Parmy" and "CTO" tokens
         so expected_owner strings like "Parmy (CTO)" route correctly

EDIT src/components/ceo/CEORoutingPanel.tsx
       - Parmy row appears in the routing CRUD table out of the box

(Optional, only if you confirm)
EDIT supabase/functions/ceo-briefing/index.ts
       - Update PRIORITY_DEFINITIONS expected_owner for "Duncan automates 25%"
         to include Parmy alongside Palash
```

### Out of scope

- Adding additional leadership members beyond Parmy (ask if anyone else is missing — e.g. Ellaine was previously mentioned but isn't yet in the seed list either).

