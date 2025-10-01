// Export UI controls - optimized for WebP frames

const $ = s => document.querySelector(s);

export function initExport(api) {
  setupExportButton(api);
}

function setupExportButton(api) {
  const btn = $('#export-btn');
  
  btn.onclick = async () => {
    const isVideo = api.getState('isVideo');
    
    try {
      if (isVideo) {
        // Export TAR of WebP sequence (much faster than PNG)
        const tarBlob = await api.exportPNGSequence();
        api.download(tarBlob, 'frames.tar');
        api.toast('Frame sequence exported');
      } else {
        // Export single WebP
        const blob = await api.exportPNG();
        api.download(blob, 'image_processed.webp');
        api.toast('Image exported');
      }
    } catch (err) {
      api.toast(err.message, 'err');
    }
  };
  
  // Update button text based on media type
  const updateButtonText = () => {
    const isVideo = api.getState('isVideo');
    btn.textContent = isVideo ? 'Export Frames (TAR)' : 'Export WebP';
  };
  
  // Initial update
  updateButtonText();
  
  // Update when media changes (called from media.js after loading)
  window.updateExportButton = updateButtonText;
}