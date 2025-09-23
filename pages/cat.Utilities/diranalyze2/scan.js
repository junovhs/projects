/* ============================================================================
   DirAnalyze - Phase 2 (scan.js)
   - Browser-only, read-only recursive scan (Directory Picker + Drag & Drop)
   - Binary omit: non-text MIME types are excluded (with safe fallbacks)
   - Deterministic ordering: directories first, then files (case-insensitive)
   - Emits strict console logs via logEvent/traceError (falls back to console)
   - Renders: tree (nested), text report (ASCII), stats table
   - No writes. Export button remains a stub until Phase 3.
   ========================================================================== */

const LOG = (msg, data) => {
  (window.logEvent ? window.logEvent : console.log)(`[EVENT] ${msg}`, data ?? "");
};
const ERR = (msg, data) => {
  (window.traceError ? window.traceError : console.error)(msg, data ?? "");
};

// --- Classification tables (local to this module) ---
const TEXTUAL_APPLICATION_MIME = new Set([
  "application/json",
  "application/x-ndjson",
  "application/javascript",
  "application/xml",
  "application/x-sh",
  "application/sql",
  "application/x-toml",
  "application/x-yaml",
  "text/yaml",
  "application/x-www-form-urlencoded",
]);

// Extensions considered textual when MIME is empty/unknown.
const TEXT_EXT_ALLOW = new Set([
  // general
  "txt","log","md","markdown","rst","adoc","textile","license","changelog","lock",
  // data
  "csv","tsv","ndjson","json","jsonc","yaml","yml","toml","ini","cfg","conf","properties","props","env","dotenv",
  // markup
  "html","htm","xhtml","xml",
  // scripts
  "sh","bash","zsh","ksh","fish","ps1","psm1","bat","cmd",
  // programming
  "js","mjs","cjs","ts","jsx","tsx",
  "py","rb","php","pl","pm","t",
  "java","kt","kts","groovy","scala",
  "go","rs","swift","m","mm",
  "c","cc","cpp","cxx","h","hh","hpp",
  "cs","vb","fs",
  "dart","lua","r","jl",
  // build/tooling
  "makefile","gnumakefile","mk","cmake","gradle","pom",
  "babelrc","prettierrc","editorconfig","npmrc","nvmrc","eslintignore","gitignore","gitattributes",
  // sql
  "sql","psql","mysql","sqlite","hql",
  // notebooks
  "ipynb"
]);

// Always-binary deny-list when MIME unknown.
const BINARY_EXT_DENY = new Set([
  // images & graphics
  "png","jpg","jpeg","gif","webp","avif","bmp","tiff","ico","icns","svgz","psd","ai","sketch","fig","svg",
  // archives
  "zip","tar","gz","tgz","bz2","xz","7z","rar","zst","jar","war","ear","nupkg",
  // office
  "pdf","doc","docx","ppt","pptx","xls","xlsx","key","pages","numbers",
  // audio/video
  "mp3","aac","wav","flac","ogg","m4a","mp4","mov","mkv","avi","webm","wmv",
  // fonts
  "ttf","otf","woff","woff2","eot",
  // execs/libs
  "exe","msi","dll","so","dylib","bin","o","a","class","wasm"
]);

// Dotfiles (with dot) to treat as text.
const DOTFILE_TEXT = new Set([
  ".gitignore",".gitattributes",".npmrc",".nvmrc",".env",".env.local",".editorconfig",".prettierrc",".eslintrc",".stylelintrc"
]);

// Filenames without extension to always treat as text (e.g., LICENSE, Makefile)
const NAME_TEXT = new Set([
  "LICENSE","COPYING","NOTICE","AUTHORS","README","CHANGELOG","CODEOWNERS","CONTRIBUTING","SECURITY","VERSION",
  "Makefile","Dockerfile","Procfile"
]);

// --- Small UI helpers for spinner & visibility ---
function setLoading(on) {
  const el = document.getElementById("loader");
  if (el) el.style.display = on ? "flex" : "none";
}
function toggleReportVisibility(show) {
  const report = document.getElementById("report");
  const exportBtn = document.getElementById("exportReportBtn");
  if (report) report.style.display = show ? "block" : "none";
  if (exportBtn) exportBtn.style.display = show ? "block" : "none";
}
function toggleEmptyNotice(treeExists) {
  const empty = document.getElementById("emptyTreeNotice");
  if (empty) empty.style.display = treeExists ? "none" : "block";
}

// Public API namespace
const DirAnalyze = {
  state: {
    projectRootName: "",
    filesMap: Object.create(null), // relPath -> { size, ext, mime, isBinary }
    tree: null,
    stats: null,
  },

  // ---------- Classification ----------
  mimeLooksTextual(mime) {
    if (!mime) return false;
    if (mime.startsWith("text/")) return true;
    if (TEXTUAL_APPLICATION_MIME.has(mime)) return true;
    return false;
  },

  extLooksTextual(ext, filename) {
    if (!ext) {
      if (DOTFILE_TEXT.has(filename)) return true;
      if (NAME_TEXT.has(filename)) return true;
      return false;
    }
    const e = (ext + "").toLowerCase();
    if (BINARY_EXT_DENY.has(e)) return false;
    if (TEXT_EXT_ALLOW.has(e)) return true;
    // Default: treat as binary unless explicitly allowed.
    return false;
  },

  classifyByMimeAndExt({ mime, ext, name }) {
    let isBinary = true;
    if (mime) {
      isBinary = !this.mimeLooksTextual(mime);
    } else {
      isBinary = !this.extLooksTextual(ext, name);
    }
    return { isBinary };
  },

  // ---------- Scan from Picker ----------
  async scanFromPicker() {
    if (!window.showDirectoryPicker) {
      ERR("Scan error: File System Access API not supported");
      return;
    }
    try {
      setLoading(true);
      const dirHandle = await showDirectoryPicker({ mode: "read" });
      const rootName = dirHandle.name || "root";
      LOG(`Scan start: ${rootName}`);
      this.state.projectRootName = rootName;

      const files = [];
      await this._walkFSDirectoryHandle(dirHandle, "", files);
      this._ingestFiles(files);

      LOG(`Scan complete: kept ${this._keptCount()}/${files.length} files, ${this._keptBytes()} bytes (omitted ${this._omittedCount()})`);
      this.renderAll();
    } catch (e) {
      ERR("Scan error: picker failed", e);
    } finally {
      setLoading(false);
    }
  },

  // ---------- Scan from Drag & Drop ----------
  async scanFromDropEvent(evt) {
    try {
      setLoading(true);
      const dt = evt.dataTransfer;
      if (!dt) return;

      const items = Array.from(dt.items || []);
      LOG(`Drop fired: Items ${items.length}`);

      // Prefer webkitGetAsEntry if available (lets us traverse directories)
      const entryFiles = [];
      if (items.length && items[0] && typeof items[0].webkitGetAsEntry === "function") {
        const roots = items
          .map(it => it.webkitGetAsEntry())
          .filter(Boolean);
        // Derive root name from first folder or from common prefix of files.
        let rootName = "drop";
        for (const root of roots) {
          if (root.isDirectory) { rootName = root.name; break; }
        }
        LOG(`Scan start: ${rootName}`);
        this.state.projectRootName = rootName;

        for (const root of roots) {
          await this._walkWebkitEntry(root, "", entryFiles);
        }
      } else {
        // Fallback: only File objects; use webkitRelativePath if present.
        const files = Array.from(dt.files || []);
        if (!files.length) return;
        const rootName = (files[0].webkitRelativePath || files[0].name || "drop").split("/")[0] || "drop";
        LOG(`Scan start: ${rootName}`);
        this.state.projectRootName = rootName;
        for (const f of files) {
          const rel = f.webkitRelativePath ? f.webkitRelativePath.split("/").slice(1).join("/") : f.name;
          entryFiles.push({ file: f, relPath: rel });
        }
      }

      this._ingestFiles(entryFiles);
      LOG(`Scan complete: kept ${this._keptCount()}/${entryFiles.length} files, ${this._keptBytes()} bytes (omitted ${this._omittedCount()})`);
      this.renderAll();
    } catch (e) {
      ERR("Scan error: drop failed", e);
    } finally {
      setLoading(false);
    }
  },

  // ---------- Internal walkers ----------
  async _walkFSDirectoryHandle(dirHandle, base, out) {
    const rel = base ? `${base}/${dirHandle.name}` : dirHandle.name;
    LOG(`Dir enter: ${rel}`);
    try {
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === "directory") {
          await this._walkFSDirectoryHandle(handle, rel, out);
        } else if (handle.kind === "file") {
          try {
            const file = await handle.getFile();
            const relPath = `${rel}/${name}`;
            out.push({ file, relPath });
          } catch (e) {
            ERR("Scan error: getFile failed", { name, e });
          }
        }
      }
    } finally {
      LOG(`Dir leave: ${rel}`);
    }
  },

  async _walkWebkitEntry(entry, base, out) {
    const name = entry.name || "";
    const rel = base ? `${base}/${name}` : name;

    if (entry.isDirectory) {
      LOG(`Dir enter: ${rel}`);
      const reader = entry.createReader();
      // readEntries may return in chunks; loop until empty array
      const readAll = async () => {
        return new Promise((resolve, reject) => {
          const results = [];
          const step = () => {
            reader.readEntries(async (ents) => {
              if (!ents.length) return resolve(results);
              results.push(...ents);
              step();
            }, reject);
          };
          step();
        });
      };
      try {
        const children = await readAll();
        for (const c of children) {
          await this._walkWebkitEntry(c, rel, out);
        }
      } catch (e) {
        ERR("Scan error: readEntries failed", { rel, e });
      } finally {
        LOG(`Dir leave: ${rel}`);
      }
    } else if (entry.isFile) {
      try {
        const file = await new Promise((res, rej) => entry.file(res, rej));
        out.push({ file, relPath: rel });
      } catch (e) {
        ERR("Scan error: FileEntry.file failed", { rel, e });
      }
    }
  },

  // ---------- Ingest + Build ----------
  _ingestFiles(pairs) {
    // Reset state
    this.state.filesMap = Object.create(null);

    let kept = 0, omitted = 0, keptBytes = 0;
    for (const { file, relPath } of pairs) {
      const name = file.name || "";
      const mime = (file.type || "").toLowerCase();
      const ext = this._extFromName(name);
      const { isBinary } = this.classifyByMimeAndExt({ mime, ext, name });

      if (isBinary) {
        LOG(`Binary omitted: ${relPath} (${mime || "unknown"})`);
        omitted++;
        continue;
      }

      const rec = {
        size: file.size || 0,
        ext: ext || "",
        mime,
        isBinary: false
      };
      this.state.filesMap[relPath] = rec;
      kept++;
      keptBytes += rec.size;
      LOG(`File added: ${relPath} (size ${rec.size} bytes, mime ${mime || "unknown"})`);
    }

    // Build tree + stats with deterministic ordering
    this.state.tree = this._buildTree(this.state.filesMap);
    this.state.stats = this._computeStats(this.state.filesMap);
    // Tally for completion log helpers
    this._internalCounts = { kept, omitted, keptBytes, total: pairs.length };
  },

  _keptCount() { return (this._internalCounts && this._internalCounts.kept) || 0; },
  _omittedCount() { return (this._internalCounts && this._internalCounts.omitted) || 0; },
  _keptBytes() { return (this._internalCounts && this._internalCounts.keptBytes) || 0; },

  _extFromName(name) {
    if (!name) return "";
    const dot = name.lastIndexOf(".");
    if (dot <= 0) {
      // extensionless or dotfile
      return "";
    }
    return name.slice(dot + 1).toLowerCase();
  },

  _buildTree(filesMap) {
    const root = { name: this.state.projectRootName || "root", type: "dir", children: new Map() };

    // Insert paths
    const paths = Object.keys(filesMap);
    // Deterministic: natural case-insensitive
    paths.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    for (const p of paths) {
      const parts = p.split("/").filter(Boolean);
      let node = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        if (isLast) {
          // file node
          if (!node.children.has(part)) {
            node.children.set(part, { name: part, type: "file", path: p });
          }
        } else {
          // dir node
          const existing = node.children.get(part);
          if (existing && existing.type === "dir") {
            node = existing;
          } else {
            const child = { name: part, type: "dir", children: new Map() };
            node.children.set(part, child);
            node = child;
          }
        }
      }
    }
    return root;
  },

  _computeStats(filesMap) {
    const stats = {
      totalFiles: 0,
      kept: 0,
      omitted: this._omittedCount(),
      totalBytes: 0,
      byExt: Object.create(null)
    };
    for (const rec of Object.values(filesMap)) {
      stats.totalFiles++;
      stats.kept++;
      stats.totalBytes += rec.size;
      const key = rec.ext || "(noext)";
      const bucket = stats.byExt[key] || { count: 0, bytes: 0 };
      bucket.count += 1;
      bucket.bytes += rec.size;
      stats.byExt[key] = bucket;
    }
    return stats;
  },

  // ---------- Rendering ----------
  renderAll(opts = {}) {
    const {
      treeSelector = "#tree",
      reportSelector = "#report",
      statsSelector = "#stats-table"
    } = opts;

    const treeEl = document.querySelector(treeSelector);
    const reportEl = document.querySelector(reportSelector);
    const statsEl = document.querySelector(statsSelector);

    if (treeEl) this._renderTree(treeEl, this.state.tree);
    if (reportEl) this._renderReport(reportEl, this.state.tree);
    if (statsEl) this._renderStatsTable(statsEl, this.state.stats);

    // Toggle visibility states
    toggleEmptyNotice(!!this.state.tree);
    toggleReportVisibility(!!this.state.tree);
  },

  _renderTree(container, tree) {
    container.innerHTML = "";
    if (!tree) return;

    const ul = document.createElement("ul");
    ul.className = "tree-root";

    const build = (node, parentUl) => {
      const li = document.createElement("li");
      li.className = node.type === "dir" ? "tree-dir" : "tree-file";

      const label = document.createElement("div");
      label.className = "tree-label";
      label.textContent = node.name;
      li.appendChild(label);

      parentUl.appendChild(li);

      if (node.type === "dir") {
        // sort: dirs first, then files (case-insensitive)
        const entries = Array.from(node.children.values());
        entries.sort((a, b) => {
          if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
        const inner = document.createElement("ul");
        for (const child of entries) build(child, inner);
        li.appendChild(inner);
      } else {
        // file node click: (Phase 3 will load preview; Phase 2 is no-op)
        label.addEventListener("click", () => {
          LOG(`Tree click: ${node.path}`);
          // hook for Phase 3 preview
        });
      }
    };

    build(tree, ul);
    container.appendChild(ul);
  },

  _renderReport(container, tree) {
    // ASCII directory report
    const pre = document.createElement("pre");
    pre.className = "report-pre";

    const lines = [];
    lines.push(`// Directory: ${this.state.projectRootName || "root"}`);
    const walk = (node, prefix, isLast) => {
      const branch = prefix ? (isLast ? "└── " : "├── ") : ""; // root line has no branch
      if (prefix) lines.push(prefix + branch + node.name);

      if (node.type === "dir") {
        const kids = Array.from(node.children.values());
        kids.sort((a, b) => {
          if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
        const len = kids.length;
        kids.forEach((child, idx) => {
          const nextPrefix = prefix
            ? prefix + (isLast ? "    " : "│   ")
            : ""; // root children start with ""
          walk(child, nextPrefix, idx === len - 1);
        });
      }
    };

    if (tree) {
      lines.push(tree.name);
      const children = Array.from(tree.children.values());
      children.sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
      const len = children.length;
      children.forEach((child, idx) => walk(child, "", idx === len - 1));
    }

    pre.textContent = lines.join("\n");
    container.innerHTML = "";
    container.appendChild(pre);
  },

  _renderStatsTable(tableEl, stats) {
    if (!stats) return;
    const isTable = tableEl.tagName.toLowerCase() === "table";
    let container;
    if (isTable) {
      let tbody = tableEl.querySelector("tbody");
      if (!tbody) {
        tbody = document.createElement("tbody");
        tableEl.appendChild(tbody);
      }
      tbody.innerHTML = "";
      container = tbody;
    } else {
      tableEl.innerHTML = "";
      container = tableEl;
    }

    const rows = [];
    // Global summary rows
    rows.push(["Total files (kept)", String(stats.kept)]);
    rows.push(["Omitted (binary)", String(stats.omitted)]);
    rows.push(["Total size (bytes)", String(stats.totalBytes)]);

    // Per-extension rows (sorted by count desc, then name)
    const extRows = Object.entries(stats.byExt)
      .map(([ext, v]) => [ext, v.count, v.bytes])
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    // Render summary
    for (const r of rows) {
      const tr = document.createElement("tr");
      const th = document.createElement("th"); th.textContent = r[0];
      const td = document.createElement("td"); td.textContent = r[1];
      tr.appendChild(th); tr.appendChild(td);
      container.appendChild(tr);
    }

    // Spacer row (optional)
    const spacer = document.createElement("tr");
    spacer.innerHTML = `<td colspan="2" style="height:8px;border:0;"></td>`;
    container.appendChild(spacer);

    // Render per-ext
    for (const [ext, count, bytes] of extRows) {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.textContent = ext === "(noext)" ? "(noext)" : `.${ext}`;
      const td = document.createElement("td");
      td.textContent = `${count} • ${bytes} bytes`;
      tr.appendChild(th); tr.appendChild(td);
      container.appendChild(tr);
    }
  },

  // ---------- UI glue ----------
  attachUI({
    dropSelector = "#drop-zone",
    folderBtnSelector = "#select-folder",
    treeSelector = "#tree",
    reportSelector = "#report",
    statsSelector = "#stats-table"
  } = {}) {
    // store selectors to reuse in renderAll
    this._uiSelectors = { treeSelector, reportSelector, statsSelector };

    // Folder picker button
    const pickBtn = document.querySelector(folderBtnSelector);
    if (pickBtn) {
      pickBtn.addEventListener("click", () => this.scanFromPicker());
    }

    // Drop zone
    const dz = document.querySelector(dropSelector);
    if (dz) {
      const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
      ["dragenter","dragover","dragleave","drop"].forEach(ev => dz.addEventListener(ev, prevent));
      dz.addEventListener("dragover", (e) => {
        const types = (e.dataTransfer && Array.from(e.dataTransfer.types).join(", ")) || "";
        LOG(`Drag over: types ${types}`);
      });
      dz.addEventListener("drop", (e) => this.scanFromDropEvent(e));
    }
  }
};

// Expose globally
window.DirAnalyze = DirAnalyze;

// Auto-attach if conventional IDs exist
window.addEventListener("DOMContentLoaded", () => {
  const hasConventional = document.querySelector("#drop-zone") || document.querySelector("#select-folder");
  if (hasConventional) {
    DirAnalyze.attachUI({});
  }
});
