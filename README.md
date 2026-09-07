# Khatm Invoice — ختم فاتورة

Local-first technical inspector for Saudi electronic invoices (FATOORA).
Decode QR TLV, inspect XML, check totals, and compare QR fields with XML.

**Khatm Invoice is not affiliated with ZATCA and is not an official approval tool.**
A local pass means the invoice passed the rules this version actually ran.
It does not mean ZATCA accepted the invoice.

Full source for this preview lives in the engineering workspace; this repository holds the public contract, source pins, and release checklist.

## Result states

`PASS_LOCAL_RULES` `PASS_OFFICIAL_SDK` `FAILED` `WARNING` `INCONCLUSIVE` `NOT_CHECKED` `NOT_APPLICABLE` `UNSUPPORTED_RULESET`

Never “approved” / «معتمدة».

## Official source pins (retrieved 2026-09-07)

- XML Implementation Standard v1.2 — `5aa15ff95efb98d3696083c309470d116d7e93ea7e134cca63f9680bc112685e`
- Data Dictionary — `61148ff46d174e5b1f04471418c2c209192de668198b7ae1de781f7032e9f038`
- Security Features v1.2 — `9049935ee34f9d491c592151506984944d036b5f946f77b443321bf580e704d4`
- QR guide 2021-11-18 — `a27159ab6f6e7ba024f8bdda41a1e3ddfe232c5738a93076ec7523f719361092`

SDK binaries and XSD/Schematron packs are not stored here.
