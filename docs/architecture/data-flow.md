# Data flow — ختم فاتورة

```
[user file / camera] -> [in-memory ValidationSession] -> [on-screen findings]
                                              |-> optional local export
                                              |-> no invoice bytes on the network
```

Static inspect pages use `connect-src 'none'`.
Session wipe lives on Settings.
XSD/Schematron files stay out of git.
Not affiliated with ZATCA.
