# Changelog — سجل التغيير

## 0.2.0 — 2026-10-16

- README: header with CI and test badges, real screenshots of the inspector (desktop + mobile), links to Arabic README, threat model and privacy.
- CI now runs the full suite (`npm test`, 44 tests: conformance, security, unit, packages) plus `npm run lint`.
- `npm run lint` was pointing to a missing `scripts/check-repo.mjs`; added it (required files, valid JSON, no tracked `.env`, no secret patterns, no scripts pointing to missing files).
- Removed `sources:fetch`, `sources:dry` and `init` scripts that pointed to files never committed.
- Added `SECURITY.md`.

## 0.1.0 — 2026-09-14

- QR TLV decode (tags 1–9), hostile-XML rejection, UBL header and totals inspection, QR↔XML cross-check, bilingual findings, local schema runner jailed with `--nonet --nowrite`, offline PWA.
