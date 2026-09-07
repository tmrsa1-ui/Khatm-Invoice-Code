# Khatm Invoice — ختم فاتورة

Local-first technical inspector for Saudi electronic invoices (FATOORA).
Decode QR TLV, inspect XML, check totals, and compare QR fields with XML.

**Khatm Invoice is not affiliated with ZATCA and is not an official approval tool.**
A local pass means the invoice passed the rules this version actually ran.
It does not mean ZATCA accepted the invoice.

## What this version does

- Decode Base64 TLV QR (tags 1–9 catalog in a versioned ruleset)
- Reject hostile XML (DOCTYPE / ENTITY / XXE)
- Inspect UBL headers and selected totals
- Cross-check QR against XML when both exist
- Emit bilingual findings with evidence
- Run without an account and without uploading the invoice

## What this version does not do

- Generate invoices or QR codes
- Sign, patch, or submit to FATOORA
- Bundle the official ZATCA SDK, XSD, or Schematron
- Declare a certificate trusted without Authority anchors
- Use the word “approved” / «معتمدة» as a result

## Quick start

Requires Node.js 20+.

```bash
# QR (official published sample)
node --experimental-strip-types apps/cli/src/index.ts qr \
  AQxCb2JzIFJlY29yZHMCDzMxMDEyMjM5MzUwMDAwMwMUMjAyMi0wNC0yNVQxNTozMDowMFoEBzEwMDAuMDAFBjE1MC4wMA==

# XML
node --experimental-strip-types apps/cli/src/index.ts xml tests/fixtures/xml/synthetic-minimal-wellformed.xml

# Compare
node --experimental-strip-types apps/cli/src/index.ts compare \
  --qr <base64-or-file> --xml <file.xml>

# Tests
node --test --experimental-strip-types tests/conformance/*.test.ts tests/security/*.test.ts

# Pin official publications (files stay in official-sources/cache, gitignored)
node scripts/fetch-official-sources.mjs

# Optional local schemas / SDK (never vendored)
node --experimental-strip-types apps/cli/src/index.ts schemas
node --experimental-strip-types apps/cli/src/index.ts sdk-status
node --experimental-strip-types apps/cli/src/index.ts xml invoice.xml --pdf report.pdf
```

Static PWA (no bundler):

```bash
python3 -m http.server 4173 --directory apps/web
```

## Result states

`PASS_LOCAL_RULES` `PASS_OFFICIAL_SDK` `FAILED` `WARNING` `INCONCLUSIVE` `NOT_CHECKED` `NOT_APPLICABLE` `UNSUPPORTED_RULESET`

`NOT_CHECKED` is not a pass. XSD and Schematron are `NOT_CHECKED` until official schemas are retrieved under license.

## Official sources

See `official-sources/manifest.json`. Active set:

- XML Implementation Standard v1.2 (2023-05-19)
- Data Dictionary (2023-05-19)
- Security Features Implementation Standards v1.2 (2023-05-19)
- QRCodeCreation.pdf (2021-11-18)

QR Base64 cap: 500 characters in the 2021 QR guide, **700** in Security Features v1.2. The active ruleset uses 700 and prints the version.

## License

Apache-2.0 for original project code, pending the third-party audit in `THIRD_PARTY_LICENSES.md`.
Do not vendor the official ZATCA SDK.
