// DirAnalyze2/frontend/src/file_handles.js
// dav2 progression: keep dav1's FS helpers, but pure ES modules; no backend needed.

export async function chooseDirectory() {
  if (!window.showDirectoryPicker) {
    alert("Your browser does not support the File System Access API.");
    throw new Error("FS Access API not available");
  }
  return await window.showDirectoryPicker();
}

export async function listFilesRecursively(dirHandle, basePath = "") {
  const out = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind === "file") {
      out.push({ path: basePath + entry.name, handle: entry });
    } else if (entry.kind === "directory") {
      const inner = await listFilesRecursively(entry, basePath + entry.name + "/");
      out.push(...inner);
    }
  }
  return out;
}

export async function readText(fileHandle) {
  const file = await fileHandle.getFile();
  return await file.text();
}

export async function writeText(fileHandle, text) {
  const writable = await fileHandle.createWritable();
  await writable.write(text);
  await writable.close();
}
