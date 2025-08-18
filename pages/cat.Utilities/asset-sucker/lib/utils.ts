export function isHttpUrl(u: string): boolean {
  try { 
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch { return false; }
}

export function extCategory(url: string): {ext: string, category: string} {
  const path = new URL(url).pathname.toLowerCase();
  const match = /\.([a-z0-9]+)$/.exec(path);
  const ext = match ? match[1] : "";
  let category = "others";
  if (["png","jpg","jpeg","webp","avif"].includes(ext)) category = "images";
  else if (["gif"].includes(ext)) category = "gifs";
  else if (["svg"].includes(ext)) category = "svgs";
  else if (["ico","icns"].includes(ext)) category = "icons";
  return { ext, category };
}

export function looksLikeImageUrl(s: string): boolean {
  if (!s) return false;
  if (s.startsWith("data:")) return false;
  if (s.startsWith("blob:")) return false;
  if (s.startsWith("about:")) return false;
  return /(\.)(png|jpe?g|gif|svg|webp|avif|ico)(\?|$)/i.test(s);
}

export function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function cleanFileName(name: string) {
  return name.replace(/[^a-z0-9._-]/gi, "_");
}
