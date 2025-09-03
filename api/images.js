import { put, del, head } from "@vercel/blob";

const META_IMAGES = "meta/images.json";

async function loadJson(path, fallback) {
  try {
    const info = await head(path);
    const res = await fetch(info.downloadUrl, { cache: "no-store" });
    return await res.json();
  } catch {
    return fallback;
  }
}

async function saveJson(path, data) {
  await put(path, JSON.stringify(data, null, 2), {
    access: "public",
    addRandomSuffix: false,
    // @ts-ignore
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");
    if (!file) return new Response("No file uploaded", { status: 400 });

    const blob = await put(`uploads/${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
    });

    const meta = await loadJson(META_IMAGES, { version: 1, items: [] });
    meta.items.push({
      id: blob.pathname,
      name: blob.pathname.split("/").pop(),
      url: blob.url,
      pathname: blob.pathname,
      uploadDate: new Date().toISOString(),
      tags: [],
      size: blob.size,
    });
    await saveJson(META_IMAGES, meta);

    return Response.json(blob);
  } catch (e) {
    console.error(e);
    return new Response(e?.message ?? "Server error", { status: 500 });
  }
}

export async function GET() {
  try {
    const meta = await loadJson(META_IMAGES, { version: 1, items: [] });
    return Response.json(meta.items);
  } catch (e) {
    console.error(e);
    return new Response(e?.message ?? "Server error", { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, name, tags } = await request.json();
    const meta = await loadJson(META_IMAGES, { version: 1, items: [] });
    const idx = meta.items.findIndex((it) => it.id === id);
    if (idx === -1) return new Response("Not found", { status: 404 });
    if (name) meta.items[idx].name = name;
    if (tags) meta.items[idx].tags = Array.from(new Set(tags));
    await saveJson(META_IMAGES, meta);
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return new Response(e?.message ?? "Server error", { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    const meta = await loadJson(META_IMAGES, { version: 1, items: [] });
    const idx = meta.items.findIndex((it) => it.id === id);
    if (idx === -1) return new Response("Not found", { status: 404 });

    // Try deleting blob (ignore if already gone)
    try {
      await del(meta.items[idx].pathname);
    } catch (e) {
      console.warn("Blob already gone:", e.message);
    }

    meta.items.splice(idx, 1);
    await saveJson(META_IMAGES, meta);

    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return new Response(e?.message ?? "Server error", { status: 500 });
  }
}
