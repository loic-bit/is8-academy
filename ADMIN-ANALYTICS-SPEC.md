# Admin Analytics + Lead Scoring: Build Spec

Requested by Loic 2026-07-21. **SHIPPED 2026-07-24 (commit d8f03ed).** Tracking is live and collecting for every user; /admin activates the moment ADMIN_EMAILS is set on the Railway service (comma-separated). Admin accounts are excluded from the lead list. activeMinutes = heartbeat count x 2 (120s visible-active beats). Phase 2 open: Airtable score sync (needs 5 fields on the Leads table + admin sync button). Ops note: prune events older than ~12 months once volume warrants; scoring is recency-driven.

## The idea (Loic's requirements, captured)
The more of the free course someone consumes, the more nurtured and likely to buy the paid services. So:
1. **Admin-only backend** (invisible to users) tracking each account's activity: video watch %, course material progress, modules completed, checklists opened, quizzes taken, AI Deal Finder trial signups, time on platform, clicks.
2. **Rank / sort / filter accounts by activity** so the sales team calls the MOST educated + nurtured leads first.
3. **Financial qualification from quiz answers** (capital, readiness) attached to each account, so outreach targets the best-qualified, not just the most active.
4. Tracking infrastructure question answered: NO third-party tracking software needed for in-app activity. We own client + server + DB → first-party event tracking (better data, no consent/blocker problems, free). Loic's link tracker stays for off-platform assets; email clicks already come from Kit.

## Design intentions (to be validated against the codebase map)
- **events table** (user_id, type, meta jsonb, created_at) + batched client tracker (sendBeacon on unload) + visibility-aware heartbeat for time-on-platform.
- Event catalog: page_view, lesson_open, lesson_complete, vault_asset_open (checklists), kit_open, tool_open, calc_run, quiz_complete (with answers), checkpoint_attempt/pass, finder_view, trial_request, gethelp_view, call_link_click (outbound calendar!), video_progress quartiles (ready for when lesson videos land; YouTube IFrame API gives play/quartile events).
- **quiz_results table**: sync the Readiness Quiz out of localStorage (answers + profile) → the financial qualification signal.
- **Scoring**: engagement score (weighted actions, recency-decayed) × qualification band (from quiz capital/timeline answers) → priority tier; "call list" = top tier sorted.
- **Admin**: is_admin on users (seeded via ADMIN_EMAILS env), admin-only API (aggregates + per-user timeline) + /admin dashboard route (ranked table, sort/filter, user drawer with full activity timeline, summary stats).
- **Sales handoff**: score + band + top signals mirrored to Airtable Leads (fire-and-forget, same pattern as existing mirrors) so Will/Alen see priority without logging in anywhere new.

## Needed from Loic
1. Admin emails (who gets /admin access): at least Loic + Joseph.
2. When course videos are recorded: hosting choice affects watch-% fidelity (YouTube unlisted = decent quartile data via IFrame API; Bunny/Vimeo = better). Decide at recording time, schema is ready either way.
3. Nothing else. No external tracking tools for v1.
