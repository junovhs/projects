// DirAnalyze2/frontend/src/ui.js
// dav2 UI: resizable 3-pane layout, collapsible tree with checkboxes (Active Set),
// independent scrolling panes, and helpers reused by main.js.

export function pad4(n) { return n.toString().padStart(4, " "); }

export function renderCodeWithLineNumbers(preEl, text) {
  const lines = text.split(/\r?\n/);
  preEl.textContent = lines.map((l, i) => pad4(i + 1) + ": " + l).join("\n");
}

export function appendLog(el, msg) {
  const time = new Date().toLocaleTimeString();
  el.textContent += `[${time}] ${msg}\n`;
  el.scrollTop = el.scrollHeight;
}

/* ---------- Split Resizers ---------- */
export function initGutters() {
  const layout = document.getElementById("layout");
  const left = document.getElementById("gutterLeft");
  const right = document.getElementById("gutterRight");

  const startDrag = (e, which) => {
    e.preventDefault();
    const startX = e.clientX;
    const initLeft = parseSize(getComputedStyle(layout).getPropertyValue("--col-left"));
    const initRight = parseSize(getComputedStyle(layout).getPropertyValue("--col-right"));
    const move = (ev) => {
      const dx = ev.clientX - startX;
      if (which === "left") {
        const w = Math.max(180, initLeft + dx);
        layout.style.setProperty("--col-left", w + "px");
      } else {
        const w = Math.max(280, initRight - dx);
        layout.style.setProperty("--col-right", w + "px");
      }
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  left.addEventListener("mousedown", (e) => startDrag(e, "left"));
  right.addEventListener("mousedown", (e) => startDrag(e, "right"));
}
function parseSize(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 300;
}

/* ---------- File Tree ---------- */
export function buildTree(paths) {
  const root = { type: "dir", name: "", children: new Map() };
  for (const p of paths) {
    const parts = p.split("/").filter(Boolean);
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1 && !p.endsWith("/");
      const key = part + (isFile ? "|f" : "|d");
      if (!node.children.has(key)) {
        node.children.set(key, { type: isFile ? "file" : "dir", name: part, path: parts.slice(0, i + 1).join("/"), children: new Map(), open: i < 2 });
      }
      node = node.children.get(key);
    }
  }
  return root;
}

export function renderTree(container, tree, selectedSet, opts = {}) {
  container.innerHTML = "";
  const { showSelectedOnly = false, filter = "" } = opts;

  const matchesFilter = (name, path) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return name.toLowerCase().includes(q) || path.toLowerCase().includes(q);
  };

  const ul = document.createElement("ul");
  container.appendChild(ul);

  const walk = (node, parentUL) => {
    for (const [, child] of node.children) {
      if (child.type === "dir") {
        // If filtering to selected only and no selected desc in this dir, skip later
        const li = document.createElement("li");
        const row = document.createElement("div");
        row.className = "item";
        const toggle = document.createElement("span");
        toggle.className = "toggle" + (child.open ? " open" : "");
        toggle.textContent = child.open ? "−" : "+";
        toggle.dataset.path = child.path;
        const name = document.createElement("span");
        name.className = "name";
        name.textContent = child.name;
        name.dataset.path = child.path;
        row.append(toggle, name);
        li.appendChild(row);
        parentUL.appendChild(li);

        const sub = document.createElement("ul");
        sub.className = child.open ? "" : "hidden";
        li.appendChild(sub);
        walk(child, sub);
      } else {
        if (showSelectedOnly && !selectedSet.has(child.path)) continue;
        if (!matchesFilter(child.name, child.path)) continue;

        const li = document.createElement("li");
        const row = document.createElement("div");
        row.className = "item";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.dataset.path = child.path;
        cb.checked = selectedSet.has(child.path);

        const name = document.createElement("span");
        name.className = "name";
        name.textContent = child.name;
        name.dataset.path = child.path;

        row.append(cb, name);
        li.appendChild(row);
        parentUL.appendChild(li);
      }
    }
  };
  walk(tree, ul);

  // Delegation for folder toggle and file clicks
  container.addEventListener("click", (e) => {
    const t = e.target;
    if (t.classList.contains("toggle")) {
      const path = t.dataset.path;
      const elUL = t.closest("li").querySelector("ul");
      const isOpen = !elUL.classList.contains("hidden");
      elUL.classList.toggle("hidden", isOpen);
      t.classList.toggle("open", !isOpen);
      t.textContent = isOpen ? "+" : "−";
      e.stopPropagation();
    }
  }, { once: true });
}

/* ---------- Helpers for stats ---------- */
export function updateStats(totalCount, selectedCount) {
  const a = document.getElementById("statTotal");
  const b = document.getElementById("statSelected");
  a.textContent = `${totalCount} files`;
  b.textContent = `${selectedCount} selected`;
}
