// Export functions coordination
import { exportPNGSequence } from './export-images.js';
import { exportMP4 } from './export-video.js';
import { download, toast } from './utils.js';

const $ = s => document.querySelector(s);

export function setupExportButtons(state, canvas, gl, video, render, ensureRenderTargets) {
  setupSavePNG(state, canvas, gl, video, render, ensureRenderTargets);
  setupExportPNGs(state, canvas, gl, video, render, ensureRenderTargets);
  setupExportMP4(state, canvas, gl, video, render, ensureRenderTargets);
}

function setupSavePNG(state, canvas, gl, video, render, ensureRenderTargets) {
  $('#save-png').onclick = async () => {
    if (!state.tex) {
      toast('Load media first', 'err');
      return;
    }
    
    const { prevCssW, prevCssH, prevW, prevH } = resizeCanvasToMedia(state, canvas, gl, ensureRenderTargets);
    
    if (state.isVideo) {
      gl.bindTexture(gl.TEXTURE_2D, state.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      state.frameSeed = (state.frameSeed + 1) | 0;
      state.needsRender = true;
    }
    
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    download(blob, state.isVideo ? 'frame_current.png' : 'image_processed.png');
    
    restoreCanvasSize(canvas, gl, prevCssW, prevCssH, prevW, prevH, ensureRenderTargets);
  };
}

function setupExportPNGs(state, canvas, gl, video, render, ensureRenderTargets) {
  $('#export-pngs').onclick = async () => {
    if (!state.tex) {
      toast('Load media first', 'err');
      return;
    }
    
    const { prevCssW, prevCssH, prevW, prevH } = resizeCanvasToMedia(state, canvas, gl, ensureRenderTargets);
    
    const renderFunc = async () => {
      if (state.isVideo) {
        gl.bindTexture(gl.TEXTURE_2D, state.tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        state.frameSeed = (state.frameSeed + 1) | 0;
        state.needsRender = true;
      }
      render(performance.now());
    };
    
    const tarBlob = await exportPNGSequence(
      canvas,
      state.tex,
      video,
      state.isVideo,
      renderFunc,
      $('#overlay'),
      $('#overlayText')
    );
    
    download(tarBlob, state.isVideo ? 'frames.tar' : 'image.tar');
    restoreCanvasSize(canvas, gl, prevCssW, prevCssH, prevW, prevH, ensureRenderTargets);
    toast('PNG sequence exported');
  };
}

function setupExportMP4(state, canvas, gl, video, render, ensureRenderTargets) {
  $('#export-mp4').onclick = async () => {
    if (!state.isVideo) {
      toast('Load video first', 'err');
      return;
    }
    
    const { prevCssW, prevCssH, prevW, prevH } = resizeCanvasToMedia(state, canvas, gl, ensureRenderTargets);
    
    const renderFunc = async () => {
      gl.bindTexture(gl.TEXTURE_2D, state.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      state.frameSeed = (state.frameSeed + 1) | 0;
      state.needsRender = true;
      render(performance.now());
    };
    
    try {
      const { blob, filename } = await exportMP4(
        canvas,
        video,
        renderFunc,
        $('#overlay'),
        $('#overlayText')
      );
      download(blob, filename);
      toast('Video exported successfully');
    } catch (err) {
      console.error('Export error:', err);
      toast('Export failed: ' + err.message, 'err');
    }
    
    restoreCanvasSize(canvas, gl, prevCssW, prevCssH, prevW, prevH, ensureRenderTargets);
  };
}

function resizeCanvasToMedia(state, canvas, gl, ensureRenderTargets) {
  const prevCssW = canvas.style.width;
  const prevCssH = canvas.style.height;
  const prevW = canvas.width;
  const prevH = canvas.height;
  
  canvas.style.width = state.mediaW + 'px';
  canvas.style.height = state.mediaH + 'px';
  canvas.width = state.mediaW;
  canvas.height = state.mediaH;
  gl.viewport(0, 0, canvas.width, canvas.height);
  ensureRenderTargets();
  state.needsRender = true;
  
  return { prevCssW, prevCssH, prevW, prevH };
}

function restoreCanvasSize(canvas, gl, prevCssW, prevCssH, prevW, prevH, ensureRenderTargets) {
  canvas.style.width = prevCssW;
  canvas.style.height = prevCssH;
  canvas.width = prevW;
  canvas.height = prevH;
  gl.viewport(0, 0, prevW, prevH);
  ensureRenderTargets();
}