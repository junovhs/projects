// Server-backed storage using Vercel Blob via /api/* routes.
// Exposes the same API your app already uses.

class ImageStorageRemote {
  async init() {
    // no-op, but keeps your app's init() happy
    return;
  }

  // ------- Images -------
  async saveImage(imageData) {
    // imageData: { id, name, data: dataURL, uploadDate, tags[], size }
    const res = await fetch('/api/images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(imageData)
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()).id;
  }

  async getAllImages() {
    const res = await fetch('/api/images');
    if (!res.ok) throw new Error(await res.text());
    const list = await res.json();

    // Server returns { id, name, url, uploadDate, tags, size, pathname }.
    // Your app expects image.data to be the src, so map url -> data.
    return list.map(it => ({
      id: it.id,
      name: it.name,
      data: it.url,             // <— important
      uploadDate: it.uploadDate,
      tags: it.tags || [],
      size: it.size, pathname: it.pathname
    }));
  }

  async updateImage(imageData) {
    const res = await fetch('/api/images', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: imageData.id,
        name: imageData.name,
        tags: imageData.tags
      })
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  }

  async deleteImage(id) {
    const res = await fetch(`/api/images?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  }

  // ------- Albums -------
  async saveAlbum(albumData) {
    const res = await fetch('/api/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(albumData)
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()).id;
  }

  async getAllAlbums() {
    const res = await fetch('/api/albums');
    if (!res.ok) throw new Error(await res.text());
    return await res.json(); // array of albums
  }

  async updateAlbum(albumData) {
    const res = await fetch('/api/albums', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(albumData)
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  }

  async deleteAlbum(id) {
    const res = await fetch(`/api/albums?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  }
}

window.imageStorage = new ImageStorageRemote();
