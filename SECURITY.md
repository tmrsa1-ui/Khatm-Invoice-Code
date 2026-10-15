# Security — الأمان

## Reporting

Please do not open a public issue with exploit details. Use [Security Advisories](../../security/advisories/new) on this repository.

لا تفتح Issue عامًا بتفاصيل استغلال؛ أبلغ عبر Security Advisories.

## Scope

- Invoices are processed on the device. The web app's CSP sets `connect-src 'none'`; nothing is uploaded.
- XML parsing rejects `DOCTYPE`, `ENTITY`, external entities and inputs over 2 MiB.
- The optional schema runner only reads paths inside the user's schema directory and calls `xmllint` with `--nonet --nowrite`.
- See [`docs/threat-model.md`](docs/threat-model.md) for the full threat model.
