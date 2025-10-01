// Export UI controls - pure callback-based

const $ = s => document.querySelector(s);

export function initExport(api) {
  setupSavePNG(api);
  setupExportPNGs(api);
  setupExportMP4(api);
}

function setupSavePNG(api) {
  $('#save-png').onclick = async () => {
    try {
      const blob = await api.exportPNG();
      const filename = api.getState('isVideo') ? 'frame_current.png' : 'image_processed.png';
      api.download(blob, filename);
    } catch (err) {
      api.toast(err.message, 'err');
    }
  };
}

function setupExportPNGs(api) {
  $('#export-pngs').onclick = async () => {
    try {
      const tarBlob = await api.exportPNGSequence();
      const filename = api.getState('isVideo') ? 'frames.tar' : 'image.tar';
      api.download(tarBlob, filename);
      api.toast('PNG sequence exported');
    } catch (err) {
      api.toast(err.message, 'err');
    }
  };
}

function setupExportMP4(api) {
  $('#export-mp4').onclick = async () => {
    try {
      const { blob, filename } = await api.exportMP4();
      api.download(blob, filename);
      api.toast('Video exported successfully');
    } catch (err) {
      api.toast('Export failed: ' + err.message, 'err');
    }
  };
}