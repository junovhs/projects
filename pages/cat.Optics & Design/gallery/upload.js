import { upload } from "@vercel/blob/client";

class UploadManager {
  constructor() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    const uploadArea = document.getElementById("uploadArea");
    const fileInput = document.getElementById("fileInput");

    // Click to browse
    uploadArea.addEventListener("click", () => fileInput.click());

    // File input change
    fileInput.addEventListener("change", (e) => {
      this.handleFiles(e.target.files);
    });

    // Drag and drop
    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.classList.add("dragover");
    });

    uploadArea.addEventListener("dragleave", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("dragover");
    });

    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("dragover");
      this.handleFiles(e.dataTransfer.files);
    });
  }

  async handleFiles(files) {
    for (let file of files) {
      if (file.type.startsWith("image/")) {
        await this.processImage(file);
      }
    }

    // Refresh grid
    if (window.app) {
      await window.app.loadImages();
      window.app.renderImages();
    }
  }

  async processImage(file) {
    try {
      const result = await upload(`uploads/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/images", // our API issues the token & handles metadata
      });

      // Add to current album
      if (window.app && window.app.currentAlbumId) {
        await window.app.addImageToCurrentAlbum(result.pathname);
      }
    } catch (err) {
      console.error("Error uploading image:", err);
    }
  }
}

window.uploadManager = new UploadManager();
