// File upload handling
class UploadManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        // Click to browse
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });
    }

    async handleFiles(files) {
        for (let file of files) {
            if (file.type.startsWith('image/')) {
                await this.processImage(file);
            }
        }
        
        // Refresh the image grid
        if (window.app) {
            await window.app.loadImages();
            window.app.renderImages();
        }
    }

    async processImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const imageData = {
                    id: Date.now() + Math.random(), // Simple unique ID
                    name: file.name,
                    data: e.target.result,
                    uploadDate: new Date().toISOString(),
                    tags: [],
                    size: file.size
                };

                try {
                    await window.imageStorage.saveImage(imageData);
                    
                    // Add to current album
                    if (window.app && window.app.currentAlbumId) {
                        await window.app.addImageToCurrentAlbum(imageData.id);
                    }
                    
                    resolve();
                } catch (error) {
                    console.error('Error saving image:', error);
                    resolve();
                }
            };
            reader.readAsDataURL(file);
        });
    }
}

// Initialize upload manager
window.uploadManager = new UploadManager();