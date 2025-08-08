# Architectural Specification: Living Canvas

**Objective:** To define a resilient, secure, and performant architecture for a local-first application.

## 1. Core Architecture: Local-First with SQLite

The application operates on a single `.living` file, which is a self-contained SQLite database. This provides:

*   **Transactional Integrity:** All operations are wrapped in `BEGIN TRANSACTION...COMMIT` blocks, ensuring the database is always in a consistent state.
*   **Atomic Saves:** SQLite's Write-Ahead Logging (WAL) mode is enabled by default. This ensures that crashes during a save operation do not corrupt the main database file.
*   **Performance:** SQLite is highly optimized for local read/write operations and can handle millions of rows efficiently.

## 2. Data Model: Typed Property Graph

The data is stored in normalized SQL tables representing a property graph:
*   `items` table: Stores core item information (ID, type).
*   `properties` table: A key-value store for all item properties, linked by `item_id`.
*   `links` table: An adjacency list representing relationships between items.

## 3. Security & Data Integrity Mitigations

*   **Data Ingress:** All external data is handled via a strict sanitization pipeline. A `Smart Connector` uses parameterized queries exclusively to prevent SQL injection. All text destined for UI rendering is context-aware escaped to prevent XSS.
*   **Rule Engine:** The 'Rule Canvas' is sandboxed. Rules are stored as declarative data, not executable code. The engine has a fixed-step evaluation limit and a global execution budget (time, memory) to prevent infinite loops and runaway processes.
*   **Collaboration:** Patch files (`.living-patch`) are validated before application. This includes checks for schema version, path validation against an allow-list, operation counts, and cryptographic signatures to ensure authenticity.

## 4. Failure & Recovery

*   **Corrupted Writes:** Beyond WAL, the application will maintain rolling shadow copies (snapshots) of the database file. On startup, an `PRAGMA integrity_check` is run. If corruption is detected, the user will be prompted to restore from the most recent valid snapshot.
*   **Faulty Rules:** A rule that triggers the execution budget will be automatically disabled, and the transaction rolled back. The user will be notified of the faulty rule.
