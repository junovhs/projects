// Export UI controls

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
        const result = await api.exportPNGSequence();
        
        // If result is null, file was saved via File System Access API
        if (result === null) {
          api.toast('Frames exported successfully');
        } else {
          // Fallback: download blob then immediately clear reference
          api.download(result, 'frames.tar');
          api.toast('Frames exported');
        }
      } else {
        const blob = await api.exportPNG();
        api.download(blob, 'image_processed.webp');
        api.toast('Image exported');
      }
    } catch (err) {
      if (err.message !== 'Export cancelled') {
        api.toast(err.message, 'err');
      }
    }
  };
  
  const updateButtonText = () => {
    const isVideo = api.getState('isVideo');
    btn.textContent = isVideo ? 'Export Frames (TAR)' : 'Export WebP';
  };
  
  updateButtonText();
  window.updateExportButton = updateButtonText;
}