# Threat model — ختم فاتورة

Maps to docs/risks.md. Date 2026-09-07.

- Spoofing: independent brand + frozen disclaimer.
- Tampering: 2 MiB cap, DTD/ENTITY reject, no URL-open in QR.
- Repudiation: status enum; PASS_LOCAL_RULES is not approval.
- Disclosure: no upload in the free path; session stays in-tab.
- DoS: size cap + billion-laughs reject.
- Elevation: escapeHtml; no innerHTML of invoice text.

C14N remains INCONCLUSIVE. Official schemas are not vendored.
