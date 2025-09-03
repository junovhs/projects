// /upload.js (browser)
// Progress UI + password-aware uploads
import { upload } from "https://esm.sh/@vercel/blob@0.24.0/client";

// --- tiny UI helper injected dynamically ---
const ProgressUI = (() => {
  const el = document.createElement("div");
  el.style.cssText = `
    position: fixed; right: 12px; bottom: 12px; z-index: 99999;
    max-width: 380px; font: 13px/1.3 system-ui, -apple-system, Segoe UI, Roboto;
    color: #111;
  `;
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(el));
  const units = (n) => {
    const f = (x, u) => `${x.toFixed(1)} ${u}`;
    if (n >= 1<<30) return f(n/(1<<30), "GB");
    if (n >= 1<<20) return f(n/(1<<20), "MB");
    if (n >= 1<<10) return f(n/(1<<10), "KB");
    return `${n} B`;
  };
  const makeBar = (label) => {
    const row = document.createElement("div");
    row.style.cssText = "background:#fff;border:1px solid #ddd;border-radius:10px;padding:10px;margin-top:8px;box-shadow:0 2px 6px rgba(0,0,0,.06)";
    row.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px">${label}</div>
      <div class="meta" style="margin:6px 0 8px 0;opacity:.8"></div>
      <div style="height:8px;background:#eee;border-radius:6px;overflow:hidden">
        <div class="bar" style="height:100%;width:0%"></div>
      </div>
    `;
    const bar = row.querySelector(".bar");
    bar.animate([{ background:"#66a3ff" }, { background:"#66a3ff"}], {duration:1, fill:"forwards"});
    const meta = row.querySelector(".meta");
    return {
      el: row,
      update(loaded, total) {
        const pct = total ? Math.round((loaded/total)*100) : 0;
        bar.style.width = `${pct}%`;
        meta.textContent = total
          ? `${units(loaded)} of ${units(total)} (${pct}%)`
          : `${units(loaded)} uploaded`;
      },
      done(final) {
        bar.style.width = "100%";
        meta.textContent = final || "Complete";
        setTimeout(() => el.contains(row) && el.removeChild(row), 1200);
      }
    };
  };
  return { add(label){ const b = makeBar(label); el.appendChild(b.el); return b; } };
})();

function getPassword() {
  const existing = localStorage.getItem("ai_api_password");
  if (existing) return existing;
  const pw = prompt("Upload password");
  if (pw) localStorage.setItem("ai_api_password", pw);
  return pw || "";
}

// Export a single function your app can call
export async function uploadImagesWithProgress(files) {
  const results = [];
  for (const file of files) {
    const ui = ProgressUI.add(`Uploading: ${file.name}`);
    const pwd = getPassword();

    const blob = await upload(file.name, file, {
      access: "public",
      handleUploadUrl: "/api/images",
      headers: { "x-api-password": pwd }, // forwarded to /api/images
      // official progress callback
      onUploadProgress: (e) => {
        // e.loaded, e.total, e.percentage
        ui.update(e.loaded || 0, e.total || 0);
      },
    });

    ui.done("Uploaded");
    results.push(blob);
  }
  return results;
}

// If your app previously imported { upload } from this file,
// you can re-export for compatibility:
export { upload };
