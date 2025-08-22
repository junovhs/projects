// DirAnalyze2/frontend/src/main.js
// dav2 glue with v1 parity features: tree with checkboxes (Active Set),
// expand/collapse, filter, "apply patch to selected", independent scroll panes,
// resizable gutters, and improved logs.

import { listFilesRecursively, readText, writeText, chooseDirectory } from "./file_handles.js";
import { renderCodeWithLineNumbers, appendLog, buildTree, renderTree, updateStats, initGutters, pad4 } from "./ui.js";
import { applyLNRP } from "./ai_patcher_lnrp.js";

const state = {
  dirHandle: null,
  files: [],              // [{ path, handle }]
  fileMap: new Map(),     // path -> handle
  currentPath: null,
  currentText: "",
  selected: new Set(),    // Active Set for "commit/apply"
  showSelectedOnly: false,
  treeModel: null
};

export async function initApp() {
  initGutters();

  const $tree = document.getElementById("fileTree");
  const $viewer = document.getElementById("fileViewer");
  const $currentPath = document.getElementById("currentPath");
  const $btnOpen = document.getElementById("btnOpenFolder");
  const $btnRefresh = document.getElementById("btnRefresh");
  const $btnSave = document.getElementById("btnSaveFile");
  const $btnApply = document.getElementById("btnApplyPatch");
  const $btnSample = document.getElementById("btnLoadSample");
  const $btnClearPatch = document.getElementById("btnClearPatch");
  const $btnSelectAll = document.getElementById("btnSelectAll");
  const $btnDeselectAll = document.getElementById("btnDeselectAll");
  const $btnExpandAll = document.getElementById("btnExpandAll");
  const $btnCollapseAll = document.getElementById("btnCollapseAll");
  const $search = document.getElementById("fileSearch");
  const $chkSelectedOnly = document.getElementById("chkShowSelectedOnly");
  const $chkApplyToSelected = document.getElementById("chkApplyToSelected");
  const $btnCopyVisible = document.getElementById("btnCopyVisible");
  const $log = document.getElementById("aiPatchOutputLog");
  const $patchInput = document.getElementById("aiPatchInput");

  $btnOpen.addEventListener("click", async () => {
    state.dirHandle = await chooseDirectory();
    await hydrateFiles();
  });

  $btnRefresh.addEventListener("click", async () => {
    if (!state.dirHandle) return;
    await hydrateFiles();
  });

  $btnSave.addEventListener("click", async () => {
    if (!state.currentPath) return;
    const handle = state.fileMap.get(state.currentPath);
    await writeText(handle, state.currentText);
    appendLog($log, "✔ Saved " + state.currentPath);
  });

  $btnApply.addEventListener("click", async () => {
    const raw = $patchInput.value;
    if (!raw.trim()) return;
    try {
      // Optionally filter patch to selected files
      let spec = JSON.parse(raw);
      if ($chkApplyToSelected.checked) {
        const allowed = state.selected;
        spec.files = (spec.files || []).filter(f => allowed.has(f.path));
        appendLog($log, `• Filtered to ${spec.files.length} file(s) in Active Set.`);
      }
      const json = JSON.stringify(spec);

      const getHandleByPath = async (p) => state.fileMap.get(p);
      const readFileText = async (h) => await readText(h);
      const writeFileText = async (h, s) => { await writeText(h, s); };
      const logFn = (msg) => appendLog($log, msg);

      await applyLNRP(json, getHandleByPath, readFileText, writeFileText, logFn);
      appendLog($log, "✅ Patch application complete.");
      if (state.currentPath) {
        const handle = state.fileMap.get(state.currentPath);
        state.currentText = await readText(handle);
        renderCodeWithLineNumbers($viewer, state.currentText);
      }
    } catch (e) {
      appendLog($log, "❌ " + (e?.message || e));
    }
  });

  $btnSample.addEventListener("click", async () => {
    const sample = await fetch("./frontend/patches/example.lnrp.json").then(r => r.text()).catch(() => "");
    if (sample) $patchInput.value = sample;
  });

  $btnClearPatch.addEventListener("click", () => {
    $patchInput.value = "";
  });

  $btnSelectAll.addEventListener("click", () => {
    for (const f of state.files) state.selected.add(f.path);
    renderTreeAndWire();
  });

  $btnDeselectAll.addEventListener("click", () => {
    state.selected.clear();
    renderTreeAndWire();
  });

  $btnExpandAll.addEventListener("click", () => {
    expandCollapseAll(true);
  });

  $btnCollapseAll.addEventListener("click", () => {
    expandCollapseAll(false);
  });

  $chkSelectedOnly.addEventListener("change", () => {
    state.showSelectedOnly = $chkSelectedOnly.checked;
    renderTreeAndWire();
  });

  $search.addEventListener("input", () => {
    renderTreeAndWire();
  });

  // Copy visible viewer content with line numbers
  $btnCopyVisible.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($viewer.textContent || "");
      appendLog($log, "✔ Copied visible content with line numbers.");
    } catch {
      appendLog($log, "❌ Failed to copy.");
    }
  });

  // Tree click handling (selection + open file)
  document.getElementById("fileTree").addEventListener("click", async (e) => {
    const cb = e.target.closest('input[type="checkbox"][data-path]');
    if (cb) {
      const p = cb.dataset.path;
      if (cb.checked) state.selected.add(p); else state.selected.delete(p);
      updateStats(state.files.length, state.selected.size);
      return;
    }
    const name = e.target.closest('.name[data-path]');
    if (name) {
      const p = name.dataset.path;
      const handle = state.fileMap.get(p);
      if (!handle) return;
      state.currentPath = p;
      const text = await readText(handle);
      state.currentText = text;
      document.getElementById("currentPath").textContent = p;
      renderCodeWithLineNumbers($viewer, text);
    }
  });

  // Initial stats
  updateStats(0, 0);
}

async function hydrateFiles() {
  const dirHandle = state.dirHandle;
  state.files = await listFilesRecursively(dirHandle);
  state.fileMap.clear();
  for (const f of state.files) state.fileMap.set(f.path, f.handle);

  // Preserve previous selection where possible
  const prev = new Set(state.selected);
  state.selected.clear();
  for (const f of state.files) if (prev.has(f.path)) state.selected.add(f.path);

  // Build tree model
  state.treeModel = buildTree(state.files.map(f => f.path));

  renderTreeAndWire();

  document.getElementById("currentPath").textContent = "No file loaded";
  document.getElementById("fileViewer").textContent = "Select a file…";
  state.currentPath = null;
  state.currentText = "";
}

function renderTreeAndWire() {
  const container = document.getElementById("fileTree");
  const filter = document.getElementById("fileSearch").value.trim();
  renderTree(container, state.treeModel, state.selected, {
    showSelectedOnly: state.showSelectedOnly,
    filter
  });
  updateStats(state.files.length, state.selected.size);
}

function expandCollapseAll(open) {
  // Walk DOM and toggle all folder ULs
  const container = document.getElementById("fileTree");
  container.querySelectorAll(".toggle").forEach(t => {
    const ul = t.closest("li").querySelector("ul");
    if (!ul) return;
    ul.classList.toggle("hidden", !open);
    t.classList.toggle("open", open);
    t.textContent = open ? "−" : "+";
  });
}
