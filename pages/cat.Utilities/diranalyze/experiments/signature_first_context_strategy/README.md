# Hierarchical Semantic Sketch — Research Track
*A deep-dive into minimal-token, high-recall context retrieval for LLM-assisted coding.*

---

## 0. Motivation  

Modern LLM copilots guzzle entire files—or whole repositories—blowing past token limits and leaking secrets.  
We want a **budget-bounded, auditable pipeline** that surfaces *exactly* the code an LLM needs—no more, no less—while keeping the user in full control.

> **North-star metric** *Locate and patch a one-line bug in a `100,000`-LOC repo with ≤ `10,000` prompt tokens and **zero** secret leaks.*

---

## 1. Conceptual model  

### Data-flow architecture

| Stage      | Component      | Input                               | Output                               |
|------------|---------------|-------------------------------------|--------------------------------------|
| **Parse**  | Sketch Builder | Repo                                | Summary Tree                         |
| **Query**  | Embed / FTS    | Prompt                              | Scored Nodes                         |
| **Budget** | Budget Walker  | Summary Tree + Scored Nodes         | Context Package                      |
| **Audit**  | Secret Gate    | Context Package                     | Verified Context **or Fail**         |
| **Generate** | LLM          | Verified Context                    | Code Solution                        |
| **Record** | Hash Logger    | Verified Context + LLM Diff         | Immutable Log                        |

1. **Sketch Builder** translates raw code into a **summary tree** (package → file → symbol).  
2. **Query Scoring** combines lexical hits and embedding similarity to rank nodes.  
3. **Budget Walker** performs best-first traversal, expanding nodes until the user-set token cap is hit.  
4. **Secret Gate** scans the context package *before* LLM submission; hard-fails on leaks.  
5. **Hash Logger** records each shipped node's SHA-256, traversal path **and resulting diff** for deterministic replay.

---

## 2. Detailed workflow (planned)

### 2.1 Parse

| Step | Tool                                    | Output |
|------|-----------------------------------------|--------|
| 1    | `tree-sitter-swift` / `tree-sitter-javascript` | Raw AST |
| 2    | Custom visitor                          | *Signature JSON*<br>`{ "id": 42, "kind": "func", "name": "render", "parent": 17, "loc": 12 }` |
| 3    | Store in SQLite                         | Tables `node`, `edge`, `text`, `sha256` |

Edge types: `contains`, `import`, `calls` (calls are best-effort static).

### 2.2 Summarise

```python
def summarise(node_text: str) -> str:
    """
    Return ≤256-token GPT-4o summary capturing intent, side-effects, invariants.
    Stored as text.body with kind='summary'.
    """
```

Summaries run once per node and are cached; key = `model_id‖node_sha`.

### 2.3 Score

```text
score = 0.5 · FTS_TFIDF(prompt, node_text)
      + 0.5 · cosine(embed(prompt), embed(summary))
```

*Embeddings*: MiniLM-L6 (alpha, swappable)  
*FTS*: SQLite FTS5 with trigram tokenizer

### 2.4 Expand (budget walker)

```python
queue   = MaxHeap(seed_nodes_by_score)
tokens  = 0
while queue and tokens < BUDGET:
    node = queue.pop()
    if node not in shipped:
        ship(node)
        tokens += estimate(node)          # summary_tokens or body_tokens
    for child in node.children:
        queue.push(child, combined_score(child))
```

### 2.5 Audit

* **TruffleHog CLI** — rulesets `high_entropy`, `aws`, `generic_secrets`
* Hard-fail on **HIGH** confidence; medium confidence ignored by default
* Overrides require Secret-Override trailer (logged)

### 2.6 Log (deterministic)

```sql
INSERT INTO tx_log(ts, op, node_id, sha256, tokens, path_json);
-- PRIMARY KEY (ts, node_id)
```

Replaying the log with identical code and model must recreate byte-identical context packages.

---

## 3. Data schema (draft)

| Table    | Columns                                                 | Notes                              |
| -------- | ------------------------------------------------------- | ---------------------------------- |
| `node`   | `id PK`, `kind`, `name`, `parent`, `loc`, `summary_sha` |                                    |
| `edge`   | `src`, `dst`, `type`                                    | `type ∈ {contains, import, calls}` |
| `text`   | `node_id`, `body` (BLOB)                                | Raw code or summary                |
| `sha256` | `node_id`, `sha`                                        |                                    |
| `log`    | `ts`, `op`, `node_id`, `sha`, `tokens`, `meta`          | Deterministic session log          |

---

## 4. Example walk-through (aspirational)

1. **Prompt** "Why does `SaveAsPDF` crash on empty title?"
2. Scorer surfaces `document.swift/SaveAsPDF()`, `utils/io.swift`, `ui/toolbar.js` in top 30.
3. Budget Walker expands helpers; total 8,418 tokens.
4. Secret Gate passes (no leaks) → package sent.
5. LLM returns two-line patch adding a nil-check.
6. Hash Log captures 52 nodes and the diff.

---

## 5. Evaluation plan

| Metric                        | Target          | Measurement                             |
| ----------------------------- | --------------- | --------------------------------------- |
| **Recall** (bug line present) | ≥ 0.95          | 50 public GH PRs, hidden diff           |
| **Tokens shipped**            | ≤ `10,000`      | same corpus                             |
| **Secret-leak false-neg**     | 0               | seeded secrets in fixture repos         |
| **Runtime** (index)           | ≤ 2 s / 1k LOC  | Apple M1 Pro (16 GB, macOS 14) baseline |

CI job `bench/run.sh` fails on any regression.

---

## 6. Current status (2025-06-02)

| Work item                        | Owner | State     | Notes                         |
| -------------------------------- | ----- | --------- | ----------------------------- |
| Tree-sitter bindings (Swift, JS) | @you  | 🟥 todo   | Vendoring script drafted      |
| Signature extractor ↔ SQLite     | @you  | 🟥 todo   | Schema in `/design/node.sql`  |
| GPT-4o summary cache             | —     | 🟥 todo   | Waiting on API-key UI         |
| Scorer prototype                 | —     | 🟨 spec   | Constants in `scorer.yaml`    |
| Budget Walker                    | —     | 🟨 spec   | Pseudocode above              |
| TruffleHog CLI harness           | —     | 🟧 stub   | Calls scan, returns exit code |
| Deterministic log v1             | —     | 🟨 schema | Hash = SHA-256(body)          |
| Benchmark harness                | —     | 🟥 design | Select 50 PRs                 |

Legend: 🟥 not started 🟧 stubbed 🟨 drafted/spec 🟩 done

---

## 7. Next-milestone tasks (0.1 Bootstrap)

1. Vendored Tree-sitter grammars + Zig/Rust build script
2. CLI `diranalyze sketch build <repo>` → `sketch.sqlite`
3. Scorer returning top-N nodes as JSON
4. Hard-fail TruffleHog wrapper
5. Log insertion + unit test reproducing a session

---

## 8. How to contribute

* **Good first issues** `[parser]` LOC → token estimator, `[bench]` collect public repos ≤ 50,000 LOC
* **Code style** `cargo fmt` / `zig fmt`; wrap Markdown at 100 chars
* **Commit msgs** see `docs/git_conventions.md`
* **Algorithm PRs** must include benchmark delta

---

## 9. References & prior art

* Aider context map — [https://github.com/addforce/aider](https://github.com/addforce/aider)
* Sourcegraph Cody embeddings — [https://about.sourcegraph.com/blog/cody-v1](https://about.sourcegraph.com/blog/cody-v1)
* Tree-sitter — [https://tree-sitter.github.io/tree-sitter/](https://tree-sitter.github.io/tree-sitter/)
* MiniLM — Wang et al., 2020. DOI: 10.48550/arXiv.2002.10957
* TruffleHog — [https://github.com/trufflesecurity/trufflehog](https://github.com/trufflesecurity/trufflehog)

---

*Everything here is living documentation—update tables and diagrams in the same PR that lands code changes.*