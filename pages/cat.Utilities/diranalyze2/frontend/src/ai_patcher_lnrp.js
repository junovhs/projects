// DirAnalyze2/frontend/src/ai_patcher_lnrp.js
// dav2 patcher (progression from dav1):
// - Canonical LNRP format (line ranges, multi-file).
// - Preserve whitespace as-is.
// - Strip accidental "123: " prefixes in replacement lines (AI echo).
// - Optional naive guards for context drift (prefix/suffix contains checks).

export async function applyLNRP(jsonText, getHandleByPath, readFileText, writeFileText, logFn) {
  let spec;
  try { spec = JSON.parse(jsonText); }
  catch (e) { throw new Error("Patch JSON is invalid."); }

  if (!spec || !Array.isArray(spec.files)) throw new Error("Patch JSON missing 'files' array.");

  for (const f of spec.files) {
    if (!f.path) throw new Error("Each file entry needs a 'path'.");
    const handle = await getHandleByPath(f.path);
    if (!handle) throw new Error("Path not found: " + f.path);

    let text = await readFileText(handle);
    let lines = text.split(/\r?\n/);

    // Marker-based patches (optional)
    if (Array.isArray(f.markers)) {
      for (const m of f.markers) {
        const [startMark, endMark] = m.between || [];
        const startIdx = lines.findIndex(l => l.includes(startMark));
        const endIdx = lines.findIndex(l => l.includes(endMark));
        if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
          throw new Error("Marker range not found for " + f.path + ": " + startMark + ".." + endMark);
        }
        const replacement = stripPossibleLineNumbers(m.replace || []);
        lines.splice(startIdx + 1, (endIdx - startIdx - 1), ...replacement);
        logFn && logFn("• Markers applied in " + f.path + ": " + startMark + ".." + endMark);
      }
    }

    // Line-range patches
    if (Array.isArray(f.patches)) {
      for (const p of f.patches) {
        const r = p.range || [];
        const start1 = r[0];
        const end1 = r[1];
        if (!Number.isInteger(start1) || !Number.isInteger(end1) || start1 < 1 || end1 < start1) {
          throw new Error("Invalid range for " + f.path + ": " + JSON.stringify(p.range));
        }

        // Optional naive guards
        if (p.guards && typeof p.guards.context_prefix === "string") {
          if (!text.includes(p.guards.context_prefix)) {
            throw new Error("Guard failed (context_prefix) in " + f.path);
          }
        }
        if (p.guards && typeof p.guards.context_suffix === "string") {
          if (!text.includes(p.guards.context_suffix)) {
            throw new Error("Guard failed (context_suffix) in " + f.path);
          }
        }

        const zeroStart = start1 - 1;
        const count = end1 - start1 + 1;
        const replacement = stripPossibleLineNumbers(p.replace || []);
        lines.splice(zeroStart, count, ...replacement);
        logFn && logFn("• Replaced lines " + start1 + "-" + end1 + " in " + f.path);
      }
    }

    const newText = lines.join("\n");
    if (newText !== text) {
      await writeFileText(handle, newText);
      logFn && logFn("✔ Wrote " + f.path);
    } else {
      logFn && logFn("• No change in " + f.path);
    }
  }
}

function stripPossibleLineNumbers(arr) {
  const re = /^\s*\d+:\s?/;
  return arr.map(line => line.replace(re, ""));
}
