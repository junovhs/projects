// DirAnalyze2/frontend/src/main.js
// dav2 glue code: retains dav1 mental model (sidebar + viewer + apply patch),
// but simplifies data flow and uses browser FS directly.

import { listFilesRecursively, readText, writeText, chooseDirectory } from "./file_handles.js";
import { renderFileList, renderCodeWithLineNumbers, appendLog } from "./ui.js";
import { applyLNRP } from "./ai_patcher_lnrp.js";

const state = {
  dirHandle: null,
  files: [],              // [{ path, handle }]
  fileMap: new Map(),     // path -> handle
  currentPath: null,
  currentText: ""
};

export async function initApp() {
  const $fileList = document.getElementById("fileList");
  const $viewer = document.getElementById("fileViewer");
  const $currentPath = document.getElementById("currentPath");
  const $btnOpen = document.getElementById("btnOpenFolder");
  const $btnRefresh = document.getElementById("btnRefresh");
  const $btnSave = document.getElementById("btnSaveFile");
  const $btnApply = document.getElementById("btnApplyPatch");
  const $btnSample = document.getElementById("btnLoadSample");
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
    const json = $patchInput.value;
    if (!json.trim()) return;
    try {
      const getHandleByPath = async (p) => state.fileMap.get(p);
      const readFileText = async (h) => await readText(h);
      const writeFileText = async (h, s) => { await writeText(h, s); };
      const logFn = (msg) => appendLog($log, msg);

      await applyLNRP(json, getHandleByPath, readFileText, writeFileText, logFn);
      appendLog($log, "✅ Patch application complete.");
      // If viewing a file that changed, refresh its view
      if (state.currentPath) {
        const handle = state.fileMap.get(state.currentPath);
        state.currentText = await readText(handle);
        renderCodeWithLineNumbers($viewer, state.currentText);
      }
    } catch (e) {
      appendLog($log, "❌ " + (e && e.message ? e.message : e));
    }
  });

  $btnSample.addEventListener("click", async () => {
    const sample = await fetch("./patches/example.lnrp.json").then(r => r.text());
    $patchInput.value = sample;
  });

  // Sidebar click (load file)
  $fileList.addEventListener("click", async (e) => {
    const li = e.target.closest("li[data-path]");
    if (!li) return;
    for (const node of $fileList.querySelectorAll("li")) node.classList.remove("active");
    li.classList.add("active");

    const path = li.dataset.path;
    state.currentPath = path;
    const handle = state.fileMap.get(path);
    state.currentText = await readText(handle);
    $currentPath.textContent = path;
    renderCodeWithLineNumbers($viewer, state.currentText);
  });
}

async function hydrateFiles() {
  const $fileList = document.getElementById("fileList");
  const dirHandle = state.dirHandle;
  state.files = await listFilesRecursively(dirHandle);
  state.fileMap.clear();
  for (const f of state.files) state.fileMap.set(f.path, f.handle);
  renderFileList($fileList, state.files);
  document.getElementById("currentPath").textContent = "No file loaded";
  document.getElementById("fileViewer").textContent = "Select a file…";
  state.currentPath = null;
  state.currentText = "";
}
