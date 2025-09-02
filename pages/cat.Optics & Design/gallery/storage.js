// IndexedDB wrapper for image storage
class ImageStorage {
    constructor() {
        this.dbName = 'ImageAlbum';
        this.dbVersion = 2; // Increment version for album support
        this.imageStoreName = 'images';
        this.albumStoreName = 'albums';
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create images store
                if (!db.objectStoreNames.contains(this.imageStoreName)) {
                    const imageStore = db.createObjectStore(this.imageStoreName, { keyPath: 'id' });
                    imageStore.createIndex('name', 'name', { unique: false });
                    imageStore.createIndex('uploadDate', 'uploadDate', { unique: false });
                }
                
                // Create albums store
                if (!db.objectStoreNames.contains(this.albumStoreName)) {
                    const albumStore = db.createObjectStore(this.albumStoreName, { keyPath: 'id' });
                    albumStore.createIndex('name', 'name', { unique: false });
                    albumStore.createIndex('createdDate', 'createdDate', { unique: false });
                }
            };
        });
    }

    async saveImage(imageData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.imageStoreName], 'readwrite');
            const store = transaction.objectStore(this.imageStoreName);
            
            const request = store.add(imageData);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllImages() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.imageStoreName], 'readonly');
            const store = transaction.objectStore(this.imageStoreName);
            
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateImage(imageData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.imageStoreName], 'readwrite');
            const store = transaction.objectStore(this.imageStoreName);
            
            const request = store.put(imageData);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteImage(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.imageStoreName], 'readwrite');
            const store = transaction.objectStore(this.imageStoreName);
            
            const request = store.delete(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Album methods
    async saveAlbum(albumData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.albumStoreName], 'readwrite');
            const store = transaction.objectStore(this.albumStoreName);
            
            const request = store.add(albumData);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllAlbums() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.albumStoreName], 'readonly');
            const store = transaction.objectStore(this.albumStoreName);
            
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateAlbum(albumData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.albumStoreName], 'readwrite');
            const store = transaction.objectStore(this.albumStoreName);
            
            const request = store.put(albumData);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteAlbum(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.albumStoreName], 'readwrite');
            const store = transaction.objectStore(this.albumStoreName);
            
            const request = store.delete(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

// Export for use in other modules
window.imageStorage = new ImageStorage();