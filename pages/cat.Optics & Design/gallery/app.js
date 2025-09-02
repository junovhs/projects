// Main application logic
class ImageAlbumApp {
    constructor() {
        this.images = [];
        this.albums = [];
        this.currentAlbumId = null;
        this.currentImageId = null;
        this.draggedElement = null;
        this.selectedImageIds = new Set();
        this.isMobile = window.innerWidth <= 768;
        this.longPressTimer = null;
        this.touchStartPos = { x: 0, y: 0 };
        this.isDragging = false;
        this.selectionMode = false;
        this.init();
    }

    async init() {
        try {
            await window.imageStorage.init();
            await this.loadAlbums();
            await this.loadImages();
            this.setupEventListeners();
            this.setupMobileUI();
        } catch (error) {
            console.error('Failed to initialize app:', error);
        }
    }

    setupMobileUI() {
        if (this.isMobile) {
            // Add mobile camera button
            const cameraBtn = document.createElement('button');
            cameraBtn.className = 'mobile-camera-btn';
            cameraBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                </svg>
            `;
            cameraBtn.addEventListener('click', () => this.openMobileCamera());
            document.body.appendChild(cameraBtn);

            // Add mobile selection mode UI
            const selectionUI = document.createElement('div');
            selectionUI.className = 'mobile-selection-mode';
            selectionUI.id = 'mobileSelectionMode';
            selectionUI.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span id="selectionCount">0 selected</span>
                    <button id="selectAll" style="background: none; border: none; color: #007acc; font-weight: 600;">Select All</button>
                </div>
                <div class="mobile-selection-actions">
                    <button class="selection-move" id="mobileMove">Move</button>
                    <button class="selection-tag" id="mobileTag">Tag</button>
                    <button class="selection-delete" id="mobileDelete">Delete</button>
                    <button class="selection-cancel" id="mobileCancel">Cancel</button>
                </div>
            `;
            document.body.appendChild(selectionUI);

            // Add mobile drag feedback
            const dragFeedback = document.createElement('div');
            dragFeedback.className = 'mobile-drag-feedback';
            dragFeedback.id = 'mobileDragFeedback';
            document.body.appendChild(dragFeedback);

            this.setupMobileSelectionListeners();
        }

        // Listen for window resize
        window.addEventListener('resize', () => {
            this.isMobile = window.innerWidth <= 768;
        });
    }

    setupMobileSelectionListeners() {
        document.getElementById('selectAll').addEventListener('click', () => {
            this.selectAllImages();
        });

        document.getElementById('mobileMove').addEventListener('click', () => {
            this.showMobileMoveOptions();
        });

        document.getElementById('mobileTag').addEventListener('click', () => {
            this.showMobileTagOptions();
        });

        document.getElementById('mobileDelete').addEventListener('click', () => {
            this.deleteMobileSelection();
        });

        document.getElementById('mobileCancel').addEventListener('click', () => {
            this.exitSelectionMode();
        });
    }

    openMobileCamera() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment'; // Use back camera
        input.multiple = true;
        input.style.display = 'none';
        
        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                window.uploadManager.handleFiles(e.target.files);
            }
        });
        
        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
    }

    enterSelectionMode() {
        this.selectionMode = true;
        document.body.classList.add('selection-mode');
        const selectionUI = document.getElementById('mobileSelectionMode');
        if (selectionUI) {
            selectionUI.classList.add('show');
        }
        this.updateSelectionCount();
    }

    exitSelectionMode() {
        this.selectionMode = false;
        this.selectedImageIds.clear();
        document.body.classList.remove('selection-mode');
        const selectionUI = document.getElementById('mobileSelectionMode');
        if (selectionUI) {
            selectionUI.classList.remove('show');
        }
        this.renderImages();
    }

    updateSelectionCount() {
        const countElement = document.getElementById('selectionCount');
        if (countElement) {
            countElement.textContent = `${this.selectedImageIds.size} selected`;
        }
    }

    selectAllImages() {
        const visibleImages = this.getVisibleImages();
        visibleImages.forEach(image => this.selectedImageIds.add(image.id));
        this.renderImages();
        this.updateSelectionCount();
    }

    getVisibleImages() {
        if (this.currentAlbumId === 'unsorted' || !this.currentAlbumId) {
            const assignedImageIds = new Set();
            this.albums.forEach(album => {
                album.imageIds.forEach(id => assignedImageIds.add(id));
            });
            return this.images.filter(image => !assignedImageIds.has(image.id));
        } else {
            const currentAlbum = this.albums.find(album => album.id === this.currentAlbumId);
            if (currentAlbum) {
                return currentAlbum.imageIds.map(id => 
                    this.images.find(img => img.id === id)
                ).filter(img => img);
            }
        }
        return [];
    }

    showMobileMoveOptions() {
        const albumOptions = ['Unsorted Images'].concat(this.albums.map(album => album.name));
        const selectedOption = prompt('Move to album:\n' + albumOptions.map((option, i) => `${i + 1}. ${option}`).join('\n'));
        
        if (selectedOption) {
            const index = parseInt(selectedOption) - 1;
            if (index === 0) {
                this.moveImagesToAlbum([...this.selectedImageIds], 'unsorted');
            } else if (index > 0 && index <= this.albums.length) {
                this.moveImagesToAlbum([...this.selectedImageIds], this.albums[index - 1].id);
            }
            this.exitSelectionMode();
        }
    }

    showMobileTagOptions() {
        const tagInput = prompt('Enter tags (comma separated):');
        if (tagInput) {
            const tags = tagInput.split(',').map(tag => tag.trim()).filter(tag => tag);
            this.applyTagsToSelection(tags);
            this.exitSelectionMode();
        }
    }

    async applyTagsToSelection(tags) {
        try {
            for (const imageId of this.selectedImageIds) {
                const image = this.images.find(img => img.id === imageId);
                if (image) {
                    tags.forEach(tag => {
                        if (!image.tags.includes(tag)) {
                            image.tags.push(tag);
                        }
                    });
                    await window.imageStorage.updateImage(image);
                }
            }
            this.renderImages();
            this.renderTagsPanel();
        } catch (error) {
            console.error('Error applying tags:', error);
        }
    }

    async deleteMobileSelection() {
        if (confirm(`Delete ${this.selectedImageIds.size} selected images?`)) {
            try {
                for (const imageId of this.selectedImageIds) {
                    await this.deleteImageById(imageId);
                }
                this.exitSelectionMode();
            } catch (error) {
                console.error('Error deleting images:', error);
            }
        }
    }

    async deleteImageById(imageId) {
        // Remove from all albums
        for (let album of this.albums) {
            const index = album.imageIds.indexOf(imageId);
            if (index > -1) {
                album.imageIds.splice(index, 1);
                await window.imageStorage.updateAlbum(album);
            }
        }

        await window.imageStorage.deleteImage(imageId);
        this.images = this.images.filter(img => img.id !== imageId);
        this.renderImages();
    }

    async loadAlbums() {
        try {
            this.albums = await window.imageStorage.getAllAlbums();
            this.renderAlbumSelect();
        } catch (error) {
            console.error('Failed to load albums:', error);
        }
    }

    async loadImages() {
        try {
            this.images = await window.imageStorage.getAllImages();
            this.renderImages();
            this.renderTagsPanel();
        } catch (error) {
            console.error('Failed to load images:', error);
        }
    }

    renderAlbumSelect() {
        const select = document.getElementById('albumSelect');
        select.innerHTML = '<option value="unsorted">Unsorted Images</option>';
        this.albums.forEach(album => {
            const option = document.createElement('option');
            option.value = album.id;
            option.textContent = album.name;
            select.appendChild(option);
        });
    }

    setupEventListeners() {
        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterImages(e.target.value);
        });

        // Sort
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.sortImages(e.target.value);
        });

        // Modal controls
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('saveTags').addEventListener('click', () => {
            this.saveTags();
        });

        document.getElementById('deleteImage').addEventListener('click', () => {
            this.deleteCurrentImage();
        });

        document.getElementById('downloadImage').addEventListener('click', () => {
            this.downloadCurrentImage();
        });

        // Close modal on outside click
        document.getElementById('imageModal').addEventListener('click', (e) => {
            if (e.target.id === 'imageModal') {
                this.closeModal();
            }
        });

        // Album controls
        document.getElementById('albumSelect').addEventListener('change', (e) => {
            this.currentAlbumId = e.target.value === 'unsorted' ? 'unsorted' : parseInt(e.target.value);
            this.renderImages();
        });

        document.getElementById('newAlbumBtn').addEventListener('click', () => {
            document.getElementById('albumModal').style.display = 'block';
        });

        document.getElementById('deleteAlbumBtn').addEventListener('click', () => {
            this.deleteCurrentAlbum();
        });

        document.getElementById('closeAlbumModal').addEventListener('click', () => {
            document.getElementById('albumModal').style.display = 'none';
        });

        document.getElementById('saveAlbum').addEventListener('click', () => {
            this.createNewAlbum();
        });
    }

    async createNewAlbum() {
        const nameInput = document.getElementById('albumNameInput');
        const name = nameInput.value.trim();
        if (!name) return;
        const album = {
            id: Date.now(),
            name,
            parentId: (this.currentAlbumId && this.currentAlbumId !== 'unsorted') ? this.currentAlbumId : null,
            imageIds: [],
            createdDate: new Date().toISOString()
        };
        try {
            await window.imageStorage.saveAlbum(album);
            this.albums.push(album);
            this.renderAlbumSelect();
            document.getElementById('albumModal').style.display = 'none';
            nameInput.value = '';
            this.renderImages();
        } catch (error) {
            console.error('Error creating album:', error);
        }
    }

    async deleteCurrentAlbum() {
        if (!this.currentAlbumId || this.currentAlbumId === 'unsorted') return;

        if (confirm('Are you sure you want to delete this album? Images will be moved back to unassigned.')) {
            try {
                await window.imageStorage.deleteAlbum(this.currentAlbumId);
                this.albums = this.albums.filter(album => album.id !== this.currentAlbumId);
                this.currentAlbumId = 'unsorted';
                this.renderAlbumSelect();
                document.getElementById('albumSelect').value = 'unsorted';
                this.renderImages();
            } catch (error) {
                console.error('Error deleting album:', error);
            }
        }
    }

    renderImages(imagesToRender = null) {
        const grid = document.getElementById('imageGrid');
        grid.innerHTML = '';
        this.renderAlbumCards(grid);

        let displayImages = [];
        
        if (this.currentAlbumId === 'unsorted' || !this.currentAlbumId) {
            // Show only images that are NOT in any album
            const assignedImageIds = new Set();
            this.albums.forEach(album => {
                album.imageIds.forEach(id => assignedImageIds.add(id));
            });
            
            displayImages = (imagesToRender || this.images).filter(image => 
                !assignedImageIds.has(image.id)
            );
        } else {
            // Show images from specific album
            const currentAlbum = this.albums.find(album => album.id === this.currentAlbumId);
            if (currentAlbum) {
                displayImages = currentAlbum.imageIds.map(id => 
                    this.images.find(img => img.id === id)
                ).filter(img => img);
            }
        }

        displayImages.forEach((image, index) => {
            const imageElement = this.createImageElement(image, index);
            grid.appendChild(imageElement);
        });

        this.updateTagsPanel();
    }

    renderAlbumCards(container) {
        if (this.currentAlbumId && this.currentAlbumId !== 'unsorted') {
            const currentAlbum = this.albums.find(a => a.id === this.currentAlbumId);
            if (currentAlbum) container.appendChild(this.createBackCard(currentAlbum));
            this.albums.filter(a => a.parentId === this.currentAlbumId).forEach(album => {
                container.appendChild(this.createAlbumCard(album));
            });
        } else {
            this.albums.filter(a => !a.parentId).forEach(album => {
                container.appendChild(this.createAlbumCard(album));
            });
        }
    }

    createBackCard(currentAlbum) {
        const div = document.createElement('div');
        div.className = 'album-card back-card';
        div.innerHTML = `
            <div class="album-content">
                <svg class="album-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
            </div>
            <div class="album-info">
                <div class="album-name">Back</div>
                <div class="album-count">to ${currentAlbum.parentId ? 'parent album' : 'Unsorted Images'}</div>
            </div>`;
        
        div.addEventListener('click', () => {
            this.currentAlbumId = currentAlbum.parentId ? currentAlbum.parentId : 'unsorted';
            document.getElementById('albumSelect').value = this.currentAlbumId === 'unsorted' ? 'unsorted' : this.currentAlbumId;
            this.renderImages();
        });
        
        let dragOverTimeout;
        
        div.addEventListener('dragover', (e) => { 
            e.preventDefault(); 
            div.classList.add('drag-over');
            if (dragOverTimeout) clearTimeout(dragOverTimeout);
        });
        
        div.addEventListener('dragleave', () => {
            dragOverTimeout = setTimeout(() => {
                div.classList.remove('drag-over');
            }, 50);
        });
        
        div.addEventListener('drop', (e) => {
            e.preventDefault(); 
            if (dragOverTimeout) clearTimeout(dragOverTimeout);
            div.classList.remove('drag-over');
            
            const target = currentAlbum.parentId ? currentAlbum.parentId : 'unsorted';
            const ids = this.selectedImageIds.size ? [...this.selectedImageIds] : [Number(this.draggedElement?.dataset.imageId)];
            
            if (ids && ids[0]) {
                // Immediate visual feedback
                ids.forEach(id => {
                    const element = document.querySelector(`[data-image-id="${id}"]`);
                    if (element) {
                        element.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
                        element.style.opacity = '0';
                        element.style.transform = 'scale(0.8)';
                    }
                });
                
                this.moveImagesToAlbum(ids, target);
            }
        });
        
        return div;
    }

    createAlbumCard(album) {
        const div = document.createElement('div');
        div.className = 'album-card';
        div.dataset.albumId = album.id;
        
        let dragOverTimeout;
        
        // Allow dropping images onto album cards with improved responsiveness
        div.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            div.classList.add('drag-over');
            
            // Clear any existing timeout
            if (dragOverTimeout) {
                clearTimeout(dragOverTimeout);
            }
        });

        div.addEventListener('dragleave', (e) => {
            // Add small delay to prevent flickering when dragging over child elements
            dragOverTimeout = setTimeout(() => {
                div.classList.remove('drag-over');
            }, 50);
        });

        div.addEventListener('drop', (e) => {
            e.preventDefault();
            if (dragOverTimeout) {
                clearTimeout(dragOverTimeout);
            }
            div.classList.remove('drag-over');
            
            const ids = this.selectedImageIds.size ? [...this.selectedImageIds] : [Number(this.draggedElement?.dataset.imageId)];
            if (ids && ids[0]) {
                // Immediate visual feedback - remove dragged items from view
                ids.forEach(id => {
                    const element = document.querySelector(`[data-image-id="${id}"]`);
                    if (element) {
                        element.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
                        element.style.opacity = '0';
                        element.style.transform = 'scale(0.8)';
                    }
                });
                
                // Move to album
                this.moveImagesToAlbum(ids, album.id);
            }
        });

        div.addEventListener('click', () => {
            this.currentAlbumId = album.id;
            document.getElementById('albumSelect').value = album.id;
            this.renderImages();
        });

        div.innerHTML = `
            <div class="album-content">
                <svg class="album-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2l5 0 2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
            </div>
            <div class="album-info">
                <div class="album-name">${album.name}</div>
                <div class="album-count">${album.imageIds.length} images</div>
            </div>
        `;

        return div;
    }

    createImageElement(image, index) {
        const div = document.createElement('div');
        div.className = 'image-item';
        div.draggable = !this.isMobile; // Disable native drag on mobile
        div.dataset.imageId = image.id;
        div.dataset.index = index;
        
        // Create checkbox
        const checkbox = document.createElement('div');
        checkbox.className = 'image-checkbox';
        if (this.selectedImageIds.has(image.id)) {
            checkbox.classList.add('checked');
            div.classList.add('selected');
        }
        
        checkbox.onclick = (e) => {
            e.stopPropagation();
            this.toggleImageSelection(image.id, div, checkbox);
        };
        
        // Mobile touch events
        if (this.isMobile) {
            let touchStartTime;
            let touchStartPos;
            
            div.addEventListener('touchstart', (e) => {
                touchStartTime = Date.now();
                touchStartPos = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY
                };
                
                // Long press for selection
                this.longPressTimer = setTimeout(() => {
                    this.handleLongPress(image.id, div, checkbox);
                }, 500);
            }, { passive: true });
            
            div.addEventListener('touchmove', (e) => {
                if (this.longPressTimer) {
                    const currentPos = {
                        x: e.touches[0].clientX,
                        y: e.touches[0].clientY
                    };
                    const distance = Math.sqrt(
                        Math.pow(currentPos.x - touchStartPos.x, 2) + 
                        Math.pow(currentPos.y - touchStartPos.y, 2)
                    );
                    
                    if (distance > 10) {
                        clearTimeout(this.longPressTimer);
                        this.longPressTimer = null;
                    }
                }
            }, { passive: true });
            
            div.addEventListener('touchend', (e) => {
                if (this.longPressTimer) {
                    clearTimeout(this.longPressTimer);
                    this.longPressTimer = null;
                }
                
                const touchDuration = Date.now() - touchStartTime;
                if (touchDuration < 300 && !this.selectionMode) {
                    // Quick tap - open modal
                    this.openModal(image);
                } else if (this.selectionMode && touchDuration < 300) {
                    // Quick tap in selection mode - toggle selection
                    this.toggleImageSelection(image.id, div, checkbox);
                }
            }, { passive: true });
        } else {
            div.onclick = (e) => {
                this.openModal(image);
            };

            // Desktop drag and drop handlers
            div.addEventListener('dragstart', (e) => {
                this.draggedElement = div;
                if (!this.selectedImageIds.has(image.id)) { 
                    this.selectedImageIds.clear(); 
                    this.selectedImageIds.add(image.id);
                    // Update visual selection
                    document.querySelectorAll('.image-item').forEach(item => {
                        item.classList.remove('selected');
                        item.querySelector('.image-checkbox').classList.remove('checked');
                    });
                    div.classList.add('selected');
                    checkbox.classList.add('checked');
                }
                div.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            div.addEventListener('dragend', () => {
                div.classList.remove('dragging');
                this.draggedElement = null;
            });

            div.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            div.addEventListener('drop', (e) => {
                e.preventDefault();
                if (this.draggedElement && this.draggedElement !== div) {
                    this.reorderImages(this.draggedElement.dataset.index, div.dataset.index);
                }
            });
        }

        div.innerHTML = `
            <img src="${image.data}" alt="${image.name}">
            <div class="image-info">
                <div class="image-name">${image.name}</div>
                <div class="image-tags">
                    ${image.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            </div>
        `;
        
        // Add checkbox after setting innerHTML
        div.appendChild(checkbox);

        return div;
    }

    toggleImageSelection(imageId, div, checkbox) {
        if (this.selectedImageIds.has(imageId)) {
            this.selectedImageIds.delete(imageId);
            div.classList.remove('selected');
            checkbox.classList.remove('checked');
        } else {
            this.selectedImageIds.add(imageId);
            div.classList.add('selected');
            checkbox.classList.add('checked');
        }
        
        if (this.isMobile) {
            if (this.selectedImageIds.size > 0 && !this.selectionMode) {
                this.enterSelectionMode();
            } else if (this.selectedImageIds.size === 0 && this.selectionMode) {
                this.exitSelectionMode();
            }
            this.updateSelectionCount();
        }
        
        this.updateTagsPanel();
    }

    handleLongPress(imageId, div, checkbox) {
        // Add visual feedback
        const indicator = document.createElement('div');
        indicator.className = 'long-press-indicator';
        div.appendChild(indicator);
        
        setTimeout(() => {
            if (div.contains(indicator)) {
                div.removeChild(indicator);
            }
        }, 1000);
        
        // Haptic feedback if available
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
        
        // Enter selection mode and select this image
        if (!this.selectionMode) {
            this.enterSelectionMode();
        }
        
        this.toggleImageSelection(imageId, div, checkbox);
    }

    async reorderImages(fromIndex, toIndex) {
        const fromIdx = parseInt(fromIndex);
        const toIdx = parseInt(toIndex);

        if (fromIdx === toIdx) return;

        if (this.currentAlbumId === 'unsorted' || !this.currentAlbumId) {
            // Reorder in global images array
            const [movedItem] = this.images.splice(fromIdx, 1);
            this.images.splice(toIdx, 0, movedItem);
            
            // Update in storage
            try {
                await window.imageStorage.updateImage(movedItem);
                this.animateReorder([...document.getElementById('imageGrid').querySelectorAll('.image-item')], fromIdx, toIdx);
                setTimeout(() => this.renderImages(), 150);
            } catch (error) {
                console.error('Error reordering images:', error);
            }
        } else {
            // Existing album reordering logic
            const currentAlbum = this.albums.find(album => album.id === this.currentAlbumId);
            if (!currentAlbum) return;

            // Add smooth transition effect
            const grid = document.getElementById('imageGrid');
            const items = [...grid.querySelectorAll('.image-item')];
            
            // Reorder the imageIds array
            const imageIds = [...currentAlbum.imageIds];
            const [movedItem] = imageIds.splice(fromIdx, 1);
            imageIds.splice(toIdx, 0, movedItem);

            currentAlbum.imageIds = imageIds;

            try {
                await window.imageStorage.updateAlbum(currentAlbum);
                
                // Smooth re-render with animation
                this.animateReorder(items, fromIdx, toIdx);
                setTimeout(() => this.renderImages(), 150);
            } catch (error) {
                console.error('Error reordering images:', error);
            }
        }
    }

    animateReorder(items, fromIndex, toIndex) {
        const movingItem = items[fromIndex];
        if (!movingItem) return;

        movingItem.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        
        // Calculate movement
        const direction = fromIndex < toIndex ? 1 : -1;
        const distance = Math.abs(toIndex - fromIndex);
        
        items.forEach((item, index) => {
            if (index >= Math.min(fromIndex, toIndex) && index <= Math.max(fromIndex, toIndex)) {
                if (index === fromIndex) {
                    item.style.transform = `translateX(${direction * distance * 100}%)`;
                } else {
                    item.style.transform = `translateX(${-direction * 100}%)`;
                }
            }
        });
    }

    async moveImagesToAlbum(imageIds, targetAlbumId) {
        try {
            const ids = imageIds.map(Number);
            for (const album of this.albums) {
                const before = album.imageIds.length;
                album.imageIds = album.imageIds.filter(id => !ids.includes(id));
                if (album.imageIds.length !== before) await window.imageStorage.updateAlbum(album);
            }
            if (targetAlbumId !== 'unsorted') {
                const target = this.albums.find(a => a.id === targetAlbumId);
                ids.forEach(id => { if (target && !target.imageIds.includes(id)) target.imageIds.push(id); });
                if (target) await window.imageStorage.updateAlbum(target);
            }
            this.selectedImageIds.clear();
            this.renderImages();
        } catch (e) { console.error('Error moving images:', e); }
    }

    async moveImageToAlbum(imageId, targetAlbumId) {
        try {
            const imgId = Number(imageId);
            // remove from any album first
            let changed = false;
            for (const album of this.albums) {
                const idx = album.imageIds.indexOf(imgId);
                if (idx > -1) {
                    album.imageIds.splice(idx, 1);
                    await window.imageStorage.updateAlbum(album);
                    changed = true;
                }
            }
            const targetAlbum = this.albums.find(a => a.id === targetAlbumId);
            if (targetAlbum && !targetAlbum.imageIds.includes(imgId)) {
                targetAlbum.imageIds.push(imgId);
                await window.imageStorage.updateAlbum(targetAlbum);
            }
            this.renderImages();
        } catch (error) {
            console.error('Error moving image to album:', error);
        }
    }

    async addImageToCurrentAlbum(imageId) {
        if (!this.currentAlbumId || this.currentAlbumId === 'unsorted') return;

        const currentAlbum = this.albums.find(album => album.id === this.currentAlbumId);
        if (currentAlbum && !currentAlbum.imageIds.includes(imageId)) {
            currentAlbum.imageIds.push(imageId);
            
            try {
                await window.imageStorage.updateAlbum(currentAlbum);
            } catch (error) {
                console.error('Error adding image to album:', error);
            }
        }
    }

    openModal(image) {
        this.currentImageId = image.id;
        document.getElementById('modalImage').src = image.data;
        document.getElementById('modalTags').value = image.tags.join(', ');
        const modal = document.getElementById('imageModal');
        modal.style.display = 'block';
        
        // Add swipe down to close on mobile
        if (this.isMobile) {
            let startY = 0;
            let currentY = 0;
            let isDragging = false;
            
            const modalContent = modal.querySelector('.modal-content');
            
            modalContent.addEventListener('touchstart', (e) => {
                startY = e.touches[0].clientY;
                isDragging = true;
            }, { passive: true });
            
            modalContent.addEventListener('touchmove', (e) => {
                if (!isDragging) return;
                
                currentY = e.touches[0].clientY;
                const diff = currentY - startY;
                
                if (diff > 0) {
                    modalContent.style.transform = `translateY(${diff}px)`;
                }
            }, { passive: true });
            
            modalContent.addEventListener('touchend', () => {
                if (!isDragging) return;
                
                const diff = currentY - startY;
                if (diff > 100) {
                    this.closeModal();
                } else {
                    modalContent.style.transform = '';
                }
                isDragging = false;
            }, { passive: true });
        }
    }

    closeModal() {
        document.getElementById('imageModal').style.display = 'none';
        this.currentImageId = null;
    }

    async saveTags() {
        if (!this.currentImageId) return;

        const tagInput = document.getElementById('modalTags').value;
        const tags = tagInput.split(',').map(tag => tag.trim()).filter(tag => tag);

        const image = this.images.find(img => img.id === this.currentImageId);
        if (image) {
            image.tags = tags;
            
            try {
                await window.imageStorage.updateImage(image);
                this.renderImages();
                this.renderTagsPanel();
                this.closeModal();
            } catch (error) {
                console.error('Error updating tags:', error);
            }
        }
    }

    async deleteCurrentImage() {
        if (!this.currentImageId) return;

        if (confirm('Are you sure you want to delete this image?')) {
            try {
                // Remove from all albums
                for (let album of this.albums) {
                    const index = album.imageIds.indexOf(this.currentImageId);
                    if (index > -1) {
                        album.imageIds.splice(index, 1);
                        await window.imageStorage.updateAlbum(album);
                    }
                }

                await window.imageStorage.deleteImage(this.currentImageId);
                this.images = this.images.filter(img => img.id !== this.currentImageId);
                this.renderImages();
                this.closeModal();
            } catch (error) {
                console.error('Error deleting image:', error);
            }
        }
    }

    async downloadCurrentImage() {
        if (!this.currentImageId) return;

        const image = this.images.find(img => img.id === this.currentImageId);
        if (!image) return;

        try {
            // Create a canvas to strip metadata and ensure clean export
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                
                // Draw image to canvas (this strips all metadata)
                ctx.drawImage(img, 0, 0);
                
                // Convert to blob and download
                canvas.toBlob((blob) => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = image.name || 'image.jpg';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 'image/jpeg', 0.95); // High quality JPEG
            };
            
            img.src = image.data;
        } catch (error) {
            console.error('Error downloading image:', error);
        }
    }

    filterImages(searchTerm) {
        const filtered = this.images.filter(image => {
            const tagMatch = image.tags.some(tag => 
                tag.toLowerCase().includes(searchTerm.toLowerCase())
            );
            const nameMatch = image.name.toLowerCase().includes(searchTerm.toLowerCase());
            return tagMatch || nameMatch;
        });
        
        this.renderImages(filtered);
    }

    sortImages(sortType) {
        let sorted = [...this.images];
        
        switch(sortType) {
            case 'date-desc':
                sorted.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
                break;
            case 'date-asc':
                sorted.sort((a, b) => new Date(a.uploadDate) - new Date(b.uploadDate));
                break;
            case 'name-asc':
                sorted.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'name-desc':
                sorted.sort((a, b) => b.name.localeCompare(a.name));
                break;
        }
        
        this.renderImages(sorted);
    }

    renderTagsPanel() {
        const container = document.getElementById('tagsContainer');
        const allTags = this.getAllUniqueTags();
        
        if (allTags.length === 0) {
            container.innerHTML = '<div class="empty-tags">No tags yet. Add tags to images to see them here.</div>';
            return;
        }

        container.innerHTML = allTags.map(tag => `
            <button class="tag-button" data-tag="${tag}">
                <span>${tag}</span>
                <button class="tag-delete" data-tag="${tag}" title="Delete tag">&times;</button>
            </button>
        `).join('');

        // Add event listeners
        container.querySelectorAll('.tag-button').forEach(button => {
            button.addEventListener('click', (e) => {
                if (!e.target.classList.contains('tag-delete')) {
                    this.applyTagToSelected(button.dataset.tag);
                }
            });
        });

        container.querySelectorAll('.tag-delete').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteTag(button.dataset.tag);
            });
        });
    }

    updateTagsPanel() {
        const selectedTags = this.getSelectedImagesTags();
        document.querySelectorAll('.tag-button').forEach(button => {
            const tag = button.dataset.tag;
            button.classList.toggle('applied', selectedTags.has(tag));
        });
    }

    getAllUniqueTags() {
        const allTags = new Set();
        this.images.forEach(image => {
            image.tags.forEach(tag => allTags.add(tag));
        });
        return Array.from(allTags).sort();
    }

    getSelectedImagesTags() {
        if (this.selectedImageIds.size === 0) return new Set();
        
        const commonTags = new Set();
        let first = true;
        
        for (const imageId of this.selectedImageIds) {
            const image = this.images.find(img => img.id === imageId);
            if (image) {
                if (first) {
                    image.tags.forEach(tag => commonTags.add(tag));
                    first = false;
                } else {
                    // Keep only tags that exist in all selected images
                    const imageTags = new Set(image.tags);
                    for (const tag of commonTags) {
                        if (!imageTags.has(tag)) {
                            commonTags.delete(tag);
                        }
                    }
                }
            }
        }
        
        return commonTags;
    }

    async applyTagToSelected(tag) {
        if (this.selectedImageIds.size === 0) {
            alert('Please select one or more images first');
            return;
        }

        try {
            for (const imageId of this.selectedImageIds) {
                const image = this.images.find(img => img.id === imageId);
                if (image && !image.tags.includes(tag)) {
                    image.tags.push(tag);
                    await window.imageStorage.updateImage(image);
                }
            }
            this.renderImages();
        } catch (error) {
            console.error('Error applying tag:', error);
        }
    }

    async deleteTag(tag) {
        if (!confirm(`Are you sure you want to delete the tag "${tag}" from all images?`)) {
            return;
        }

        try {
            for (const image of this.images) {
                const tagIndex = image.tags.indexOf(tag);
                if (tagIndex > -1) {
                    image.tags.splice(tagIndex, 1);
                    await window.imageStorage.updateImage(image);
                }
            }
            this.renderImages();
            this.renderTagsPanel();
        } catch (error) {
            console.error('Error deleting tag:', error);
        }
    }
}

// Initialize app
window.app = new ImageAlbumApp();