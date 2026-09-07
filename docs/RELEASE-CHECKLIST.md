# Release checklist — v0.1.0-beta

Do not announce a complete MVP until store builds, Schematron, and C14N11 hash are honest.

A local pass is not ZATCA approval.

## Must remain true

- [x] `computeInvoiceHash` exported, `implemented: false`, status `INCONCLUSIVE`
- [x] User XSD only via `KHATM_SCHEMA_DIR` + sha256 pins + xmllint; never vendor Authority files
- [x] Browser CSP `connect-src 'none'`
- [ ] Public HTTPS without team SSO (GitHub Pages workflow landed; enable Pages + public repo)
- [ ] iOS/Android store binaries from a Mac with Xcode
- [ ] Signed commercial contract and human-set prices

## Do not ship as «جاهز تجاريًا» while any box above is open
