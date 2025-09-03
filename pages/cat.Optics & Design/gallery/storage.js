// /storage.js
// Streams /api/images for "every byte" load progress and shows a storage meter.
// Also attaches password header automatically on write operations.

const REQ_HEADER = "x-api-password";
function getPassword() {
  return localStorage.getItem("ai_api_password") || "";
}
function bytes(n) {
  const f = (x, u) => `${x.toFixed(1)} ${u}`;
  if (n >= 1<<30) return f(n/(1<<30), "GB");
  if (n >= 1<<20) return f(n/(1<<20), "MB");
  if (n >= 1<<10) return f(n/(1<<10), "KB");
  return `${n} B`;
}

// --- tiny UI overlay for loading + storage ---
const LoaderUI = (() => {
  const host = document.createElement("div");
  host.style.cssText = `
    position: fixed; left: 12px; bottom: 12px; z-index: 99998;
    max-width: 380px; font: 13px/1.3 system-ui, -apple-system, Segoe UI, Roboto; color:#111;
  `;
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(host));
  function card(title) {
    const el = document.createElement("div");
    el.style.cssText = "background:#fff;border:1px solid #ddd;border-radius:10px;padding:10px;margin-top:8px;box-shadow:0 2px 6px rgba(0,0,0,.06)";
    el.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px">${title}</div>
      <div class="meta" style="margin:6px 0 8px 0;opacity:.8"></div>
      <div style="height:8px;background:#eee;border-radius:6px;overflow:hidden">
        <div class="bar" style="height:100%;width:0%"></div>
      </div>
    `;
    host.appendChild(el);
    return {
      set(loaded, total, text) {
        const pct = total ? Math.round((loaded/total)*100) : 0;
        el.querySelector(".bar").style.width = `${pct}%`;
        el.querySelector(".meta").textContent = text ?? (total ? `${bytes(loaded)} of ${bytes(total)} (${pct}%)` : `${bytes(loaded)} loaded`);
      },
      done(finalText) {
        el.querySelector(".bar").style.width = "100%";
        el.querySelector(".meta").textContent = finalText || "Complete";
        setTimeout(() => host.contains(el) && host.removeChild(el), 1200);
      }
    };
  }
  const storageBadge = document.createElement("div");
  storageBadge.style.cssText = "background:#fff;border:1px solid #ddd;border-radius:10px;padding:10px;margin-top:8px;box-shadow:0 2px 6px rgba(0,0,0,.06)";
  storageBadge.innerHTML = `<div style="font-weight:600;margin-bottom:6px">Storage</div><div class="smeta" style="opacity:.85"></div>`;
  function ensureBadge() {
    if (!host.contains(storageBadge)) host.appendChild(storageBadge);
  }
  return {
    start(title) { return card(title); },
    setStorage({ usedBytes, totalBytes, availableBytes, count }) {
      ensureBadge();
      const sm = storageBadge.querySelector(".smeta");
      if (totalBytes) {
        sm.textContent = `${bytes(usedBytes)} used / ${bytes(totalBytes)} total — ${bytes(availableBytes)} free (${count} files)`;
      } else {
        sm.textContent = `${bytes(usedBytes)} used (${count} files)`;
      }
    }
  };
})();

export class ImageStorageRemote {
  async getAllImages() {
    const ui = LoaderUI.start("Loading images");
    const res = await fetch("/api/images", { cache: "no-store" });
    const total = Number(res.headers.get("content-length") || 0);
    const reader = res.body?.getReader();
    if (!reader) {
      const list = await res.json();
      ui.done();
      this._updateStorageMeter(); // async
      return list.map(this._mapItem);
    }
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength || value.length || 0;
      ui.set(received, total);
    }
    const text = new TextDecoder().decode(concatUint8(chunks));
    ui.done();
    this._updateStorageMeter(); // async
    const list = JSON.parse(text);
    return list.map(this._mapItem);
  }

  async saveImageMeta({ id, name, tags }) {
    const res = await fetch("/api/images", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        [REQ_HEADER]: getPassword(),
      },
      body: JSON.stringify({ id, name, tags }),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async deleteImage(id) {
    const res = await fetch(`/api/images?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { [REQ_HEADER]: getPassword() },
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async getAllAlbums() {
    const res = await fetch("/api/albums", { cache: "no-store" });
    return await res.json();
  }

  async saveAlbum(album) {
    const res = await fetch("/api/albums", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        [REQ_HEADER]: getPassword(),
      },
      body: JSON.stringify(album),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async createAlbum(album) {
    const res = await fetch("/api/albums", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [REQ_HEADER]: getPassword(),
      },
      body: JSON.stringify(album),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }

  async deleteAlbum(id) {
    const res = await fetch(`/api/albums?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { [REQ_HEADER]: getPassword() },
    });
    if (!res.ok) throw new Error(await res.text());
  }

  // --- helpers ---
  _mapItem(it) {
    return {
      id: it.id,
      name: it.name,
      data: it.url,
      uploadDate: it.uploadDate,
      tags: it.tags || [],
      size: it.size,
      pathname: it.pathname,
    };
  }

  async _updateStorageMeter() {
    try {
      const res = await fetch("/api/storage", { cache: "no-store" });
      if (!res.ok) return;
      const info = await res.json();
      LoaderUI.setStorage(info);
    } catch {}
  }
}

// util to join Uint8Array chunks
function concatUint8(chunks) {
  const len = chunks.reduce((a, c) => a + c.byteLength, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}
