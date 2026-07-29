# Launch Checklist — Cashflow 2.0 Academy (2026-07-29)

## The data flow (as wired, live now)
Opt-in page / any traffic → platform /signup (30s: name, email, password) → instantly, in parallel:
1. Postgres account (progress, saved deals, quiz answers, all activity save here)
2. Airtable Leads row (Lead Source "Cashflow 2.0 Academy", Opted In ✓) → the CRM / dialing list
3. Kit: subscriber created + "Cashflow Academy Member" tag (21590067) + enrolled in the 56-email nurture (sequence 2838059)
4. First-party tracking starts: lessons, checklists, calculators, quiz (financial qualification), minutes, booking-link clicks
5. Welcome video plays in-app; team calls same-day (SOP)
Qualified-lead visibility = /admin: ranked call list (score, HOT/WARM/NURTURE/COLD, $-band from quiz, signals), per-lead timeline. Airtable stays the dialing surface; /admin decides WHO first.

## DONE (verified live today)
- [x] Password reset flow (forgot -> 1h single-use emailed link -> reset -> auto-login); Resend-backed mailer, dev fallback; NEEDS RESEND_API_KEY to actually send (see switches)
- [x] Brute-force rate limiting (login 10/15min, signup 20/hr, forgot 5/hr) + security headers (nosniff, frame-deny, HSTS)
- [x] Self-serve admin management inside /admin (add/remove by email; Loic + Joseph are permanent root admins; admins never appear in the lead list)
- [x] Quiz "experience" question (never bought -> own 4+) feeding the admin drill-down; Home shows a Start-Here quiz prompt until taken
- [x] Kit wiring: signup → subscriber + tag + sequence enroll (commit 8c0ba7c; KIT_API_KEY/KIT_SEQUENCE_ID/KIT_TAG_ID on Railway)
- [x] ADMIN_EMAILS set: loic@scalewisemedia.com, joseph@investingsection8.com
- [x] 56-email sequence rebuilt by team as id 2838059, all 56 published, E50 4hr-course link filled (youtu.be/vFawo5bxTpc, UTM'd), 9,491 subscribers STAGED, sequence INACTIVE
- [x] Analytics + lead scoring + /admin (shipped 2026-07-24)
- [x] Airtable signup mirror (live since v1)

## GO/NO-GO SWITCHES (Loic)
- [ ] Course videos → Loic sends embeds one by one → wire into lessonMeta.js + deploy each batch
- [ ] ACTIVATE sequence 2838059 — one flip starts all 9,491 staged subscribers at email 1 (next 11am ET slot, Mon–Sat) AND makes new-signup enrollment work (enrollment 422s while inactive). Activate before/at traffic start. Say the word and it flips via API.
- [ ] Admin accounts: sign up on the platform with the two admin emails (gate matches the ACCOUNT email; different emails = tell me, env updates in seconds)
- [ ] Landing page CTA → point the opt-in to the platform /signup (GHL edit), or confirm traffic goes direct
- [ ] Ops: same-day call SOP (Will/Alen) · "S8" IG keyword manned · replies manned (E2/E17/E28/E30/E38/E45 promise a human)
- [ ] RESEND: create account (resend.com, free tier), verify investingsection8.com domain (DNS records they show you), send me the API key -> I set RESEND_API_KEY + MAIL_FROM and password-reset emails go out from your domain. Until then resets can't send.
- [ ] Videos: Level 1 (14) LIVE; awaiting Level 2 (25) + Level 3 (6) embeds

## Catch-up rule
Anyone who signs up while the sequence is still inactive gets subscriber+tag but NOT enrolled. After activation, bulk-add everyone with the "Cashflow Academy Member" tag who isn't in the sequence (one API sweep — ask me).

## Not launch-blocking
Custom domain (then swap Academy links in the 56 emails, one find-replace) · Airtable score-sync (phase 2) · dead IG handle on financing-blueprint page · events pruning at volume.

## Trap log
The kit-joseph MCP connector is pointed at a DIFFERENT Kit account than Joseph's real one (tag created there didn't exist in his account). Use the raw API key from the credentials file for all Joseph Kit writes until reconnected. GitHub repo renamed: loic-bit/is8-academy (old remote URL redirects).
