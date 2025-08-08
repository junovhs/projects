# Technical Audit v2 (Red Team)

**VERDICT: Brittle** — Sound architectural intent, but single-point-of-failure DB file, insufficient hostile-input handling, and optimistic rule-engine constraints leave the system at high risk of catastrophic data loss under realistic failure combinations.

### Non-Negotiable Hardening Requirements (must be proven in code & tests)

1.  **Journalling & Snapshot Rotation**
    *Implement continuous shadow-copy snapshots with automatic integrity-check on open; restore flow must be user-invocable and scriptable.*

2.  **Strict Input Sanitisation Pipeline**
    *Enforce streaming, size-bounded parsers; store only validated UTF-8; all UI rendering must pass through a single, centralised HTML-escaper with CSP + Trusted Types.*

3.  **Rule-Engine Sandbox with Global Budget**
    *Move rule evaluation into a dedicated worker process with deterministic step/memory caps and kill-signal; persist budget exhaustion events to an audit log.*

4.  **Patch-File Verification & Authenticated Transport**
    *Apply patches only after schema-hash match, canonical Unicode normalisation, op-count cap, and optional Ed25519 signature check.*

5.  **Automated Fuzz & Chaos Tests in CI**
    *Integrate sqldiff/corpus fuzzing (e.g., `sqlite3 fuzzcheck`) plus fault-injection harness simulating mid-transaction crashes, disk-full conditions, and power loss; gate releases on zero unhandled defects.*

Implementing—and objectively proving—the above will move Living Canvas from *Brittle* toward *Robust*. Without them, data integrity remains at unacceptable risk.