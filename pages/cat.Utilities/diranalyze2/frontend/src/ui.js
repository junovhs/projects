// DirAnalyze2/frontend/src/ui.js
// dav2 progression: retains dav1 "simple list + code view" but strips heavy framework.
// Adds consistent "copy with line numbers" rendering for AI context.

export function renderFileList(ul, files) {
  ul.innerHTML = "";
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const f of sorted) {
    const li = document.createElement("li");
    li.textContent = f.path;
    li.dataset.path = f.path;
    ul.appendChild(li);
  }
}

export function renderCodeWithLineNumbers(preEl, text) {
  const lines = text.split(/\r?\n/);
  const numbered = lines.map((l, i) => pad4(i + 1) + ": " + l).join("\n");
  preEl.textContent = numbered;
}

function pad4(n) { return n.toString().padStart(4, " "); }

export function appendLog(el, msg) {
  const time = new Date().toLocaleTimeString();
  el.textContent += "[" + time + "] " + msg + "\n";
  el.scrollTop = el.scrollHeight;
}
