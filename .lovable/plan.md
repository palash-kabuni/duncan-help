

## Goal
Publish a new "What's New" release covering everything shipped today since the last published release.

## Today's changes to log
1. **Lovable Contributors leaderboard (Section 07)** — new `lovable_usage_snapshots` table, `update_lovable_contributors` Duncan tool, `LovableContributorsCard` mounted in CEO/Team Briefing. Paste a Lovable People screenshot in chat and ask Duncan to refresh.
2. **Initiative Snapshot cleanup (Section 04)** — silent workstream tags (`duncan`, `kabuni-helpdesk`, `kabuni-mvp`) with zero cards no longer appear as empty "0 cards · silent" rows in the Team Briefing.

## How it ships
1. Read the latest published release from `releases` to confirm the previous version and pick the next semver bump (patch bump unless you want minor).
2. Either:
   - **(a)** Insert a new draft via `log_release_change` tool calls (one per change), then call the `finalize-release` Edge Function to publish, **or**
   - **(b)** Insert directly: create a `releases` row with `status='published'`, `published_at=now()`, auto-generated title + summary, and a `changes` JSON array containing the two items above (types: `feature`, `improvement`).
3. Verify the new entry appears at the top of `/whats-new` as "Latest".

No UI or schema changes — this is a content publish only.

## Files touched
- None. Database insert into `releases` (and optional `release_changes` if that's the schema) via the existing release pipeline.

## Open question
Should I also trigger **Send Notification** (email blast via `send-release-emails`) once published, or leave that for you to fire manually from `/whats-new`?

