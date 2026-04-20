
The user wants to add a new release entry to the What's New timeline covering today's work. Releases are managed via the `releases` table (admin-only Release Manager UI per memory `mem://features/release-announcement-system`).

Today's notable changes from this session:
1. Auto-draft Gmail replies (new feature + user toggle in Settings)
2. Token usage now appears in daily briefing
3. Daily briefing gated to once per calendar day (server-side)
4. Fixed blank Gmail drafts (multipart MIME)

I'll insert one new release row directly via migration so it appears on `/whats-new` immediately.

## Plan

### Add release entry "Today's date" via DB migration

Insert into `releases`:
- **version**: auto-incremented (next after current latest — will check, likely v1.x)
- **title**: "Auto-drafted replies & smarter briefings"
- **summary**: Short paragraph on the theme
- **status**: `published`
- **published_at**: now()
- **changes** (JSONB):
  - **feature**: "Duncan can now pre-draft Gmail replies in the background — toggle on/off in Settings → Gmail."
  - **feature**: "Daily briefing now includes your AI token usage today plus the 30-day team leaderboard."
  - **improvement**: "Daily briefing now shows once per calendar day instead of once per session — no more repeats across tabs or refreshes."
  - **fix**: "Auto-drafted Gmail replies no longer appear blank in the Gmail editor (multipart MIME fix)."

### Files
- One DB migration: `INSERT INTO releases (...)` — I'll first read the latest version number to pick the next one.

No code changes, no UI changes — the existing `/whats-new` page will render the new entry automatically.
