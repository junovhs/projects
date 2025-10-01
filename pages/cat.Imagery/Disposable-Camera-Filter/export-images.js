// STREAMING export with smart compression

const YIELD_EVERY = 3;
const WEBP_QUALITY = 0.95; // Lossy but visually lossless (much smaller)

export function buildTar(entries) {
  console.log(`[TAR] Building archive with ${entries.length} entries`);
  const blocks = [];
  
  function padOctal(n, len) {
    const s = n.toString(8);
    return ('000000000000'.slice(s.length) + s).slice(-len) + '\0';
  }
  
  function putString(buf, off, str) {
    for (let i = 0; i < str.length; i++) {
      buf[off + i] = str.charCodeAt(i) & 0xFF;
    }
  }
  
  function headerFor(name, size) {
    const buf = new Uint8Array(512);
    const prefix = name.length > 100 ? name.slice(0, name.lastIndexOf('/')) : '';
    
    putString(buf, 0, name.slice(0, 100));
    putString(buf, 100, '0000777\0');
    putString(buf, 108, '0000000\0');
    putString(buf, 116, '0000000\0');
    putString(buf, 124, padOctal(size, 11));
    putString(buf, 136, padOctal(Math.floor(Date.now() / 1000), 11));
    putString(buf, 156, '0');
    putString(buf, 257, 'ustar\0');
    putString(buf, 263, '00');
    putString(buf, 265, 'user');
    putString(buf, 297, 'user');
    if (prefix) putString(buf, 345, prefix.slice(0, 155));
    
    for (let i = 148; i < 156; i++) buf[i] = 0x20;
    
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += buf[i];
    
    const chk = (sum.toString(8).padStart(6, '0')).slice(-6) + '\0 ';
    putString(buf, 148, chk);
    
    return buf;
  }
  
  function padBlock(n) {
    return (512 - (n % 512)) % 512;
  }
  
  for (const { name, data } of entries) {
    const size = data.byteLength;
    blocks.push(headerFor(name, size));
    blocks.push(new Uint8Array(data));
    const pad = padBlock(size);
    if (pad) blocks.push(new Uint8Array(pad));
  }
  
  blocks.push(new Uint8Array(512));
  blocks.push(new Uint8Array(512));
  
  const total = blocks.reduce((a, b) => a + b.length, 0);
  console.log(`[TAR] Total archive size: ${(total / 1024 / 1024).toFixed(2)}MB`);
  const out = new Uint8Array(total);
  let off = 0;
  
  for (const b of blocks) {
    out.set(b, off);
    off += b.length;
  }
  
  return new Blob([out], { type: 'application/x-tar' });
}

async function captureAndEncodeFrame(canvas, index) {
  const t0 = performance.now();
  
  // Create minimal temp canvas
  const temp = document.createElement('canvas');
  temp.width = canvas.width;
  temp.height = canvas.height;
  const ctx = temp.getContext('2d', { alpha: false, desynchronized: true });
  ctx.drawImage(canvas, 0, 0);
  
  const t1 = performance.now();
  
  // Use LOSSY WebP for massive size reduction with minimal quality loss
  const blob = await new Promise(r => temp.toBlob(r, 'image/webp', WEBP_QUALITY));
  const t2 = performance.now();
  
  const ab = await blob.arrayBuffer();
  
  // Cleanup
  temp.width = temp.height = 0;
  
  if (index % 10 === 0) {
    console.log(`[FRAME ${index}] Capture: ${(t1 - t0).toFixed(1)}ms, Encode: ${(t2 - t1).toFixed(1)}ms, Size: ${(blob.size / 1024).toFixed(1)}KB`);
  }
  
  return {
    name: `frame_${String(index).padStart(6, '0')}.webp`,
    data: ab
  };
}

export async function exportPNGSequence(canvas, mediaTexture, videoElement, isVideo, renderFunc, overlayElement, textElement) {
  console.log('[EXPORT] Starting export process');
  console.log(`[EXPORT] Canvas size: ${canvas.width}x${canvas.height}`);
  const entries = [];
  
  overlayElement.classList.remove('hidden');
  textElement.textContent = 'Exporting frames… 0%';
  
  if (!isVideo) {
    console.log('[EXPORT] Single image mode');
    await renderFunc();
    await new Promise(r => requestAnimationFrame(r));
    const result = await captureAndEncodeFrame(canvas, 0);
    entries.push(result);
  } else {
    console.log('[EXPORT] Video mode - starting frame capture');
    const startTime = performance.now();
    
    const dur = Math.max(0.01, videoElement.duration || 1);
    console.log(`[EXPORT] Video duration: ${dur.toFixed(2)}s`);
    console.log(`[EXPORT] Video dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
    
    const wasLoop = videoElement.loop;
    const wasPaused = videoElement.paused;
    const wasRate = videoElement.playbackRate;
    
    videoElement.loop = false;
    videoElement.playbackRate = 1.0;
    videoElement.pause();
    videoElement.currentTime = 0;
    
    await new Promise(resolve => {
      videoElement.addEventListener('seeked', resolve, { once: true });
    });
    
    let frameIndex = 0;
    let lastTime = -1;
    
    await new Promise((resolve, reject) => {
      let vfcb;
      
      const cleanup = () => {
        if (videoElement.cancelVideoFrameCallback && vfcb) {
          try {
            videoElement.cancelVideoFrameCallback(vfcb);
          } catch (e) {}
        }
      };
      
      const onFrame = async (now, metadata) => {
        try {
          videoElement.pause();
          
          // Log frame timing to debug
          if (frameIndex < 5 || frameIndex % 30 === 0) {
            console.log(`[FRAME ${frameIndex}] Video time: ${videoElement.currentTime.toFixed(3)}s, metadata time: ${metadata.mediaTime.toFixed(3)}s`);
          }
          
          // Render frame
          await renderFunc();
          
          // Capture and encode IMMEDIATELY
          const encoded = await captureAndEncodeFrame(canvas, frameIndex);
          entries.push(encoded);
          
          frameIndex++;
          lastTime = videoElement.currentTime;
          
          const progress = Math.round((videoElement.currentTime / dur) * 100);
          const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
          const fps = (frameIndex / (performance.now() - startTime) * 1000).toFixed(1);
          
          textElement.textContent = `Frame ${frameIndex} (${progress}%) • ${fps} fps • ${elapsed}s`;
          
          // Yield to browser every N frames
          if (frameIndex % YIELD_EVERY === 0) {
            await new Promise(r => setTimeout(r, 0));
          }
          
          if (videoElement.ended || videoElement.currentTime >= dur - 1e-4) {
            const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
            const avgFps = (frameIndex / (performance.now() - startTime) * 1000).toFixed(1);
            console.log(`[EXPORT] Complete - ${frameIndex} frames in ${totalTime}s (${avgFps} fps avg)`);
            console.log(`[EXPORT] Expected frames at 25fps: ${Math.round(dur * 25)}, actual: ${frameIndex}`);
            cleanup();
            resolve();
            return;
          }
          
          vfcb = videoElement.requestVideoFrameCallback(onFrame);
          videoElement.play().catch(() => {});
          
        } catch (err) {
          console.error('[EXPORT] Error in frame processing:', err);
          cleanup();
          reject(err);
        }
      };
      
      vfcb = videoElement.requestVideoFrameCallback(onFrame);
      videoElement.addEventListener('ended', () => {
        cleanup();
        resolve();
      }, { once: true });
      
      videoElement.play().catch(err => {
        console.error('[EXPORT] Failed to start video:', err);
        reject(err);
      });
    });
    
    videoElement.loop = wasLoop;
    videoElement.playbackRate = wasRate;
    if (wasPaused) videoElement.pause();
  }
  
  textElement.textContent = 'Building archive...';
  console.log('[EXPORT] Starting TAR construction');
  const tarBlob = buildTar(entries);
  console.log('[EXPORT] Export complete');
  
  overlayElement.classList.add('hidden');
  
  return tarBlob;
}