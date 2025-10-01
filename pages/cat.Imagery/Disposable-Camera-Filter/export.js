// Export UI controls - simplified to PNG and TAR only

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
        // Export TAR of PNG sequence
        const tarBlob = await api.exportPNGSequence();
        api.download(tarBlob, 'frames.tar');
        api.toast('PNG sequence exported');
      } else {
        // Export single PNG
        const blob = await api.exportPNG();
        api.download(blob, 'image_processed.png');
        api.toast('PNG exported');
      }
    } catch (err) {
      api.toast(err.message, 'err');
    }
  };
  
  // Update button text based on media type
  const updateButtonText = () => {
    const isVideo = api.getState('isVideo');
    btn.textContent = isVideo ? 'Export Frames (TAR)' : 'Export PNG';
  };
  
  // Initial update
  updateButtonText();
  
  // Update when media changes (called from media.js after loading)
  window.updateExportButton = updateButtonText;
}