// PNG sequence export with TAR packaging - OPTIMIZED VERSION

const BATCH_SIZE = 6; // Encode 6 frames in parallel

export function buildTar(entries) {
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
  const out = new Uint8Array(total);
  let off = 0;
  
  for (const b of blocks) {
    out.set(b, off);
    off += b.length;
  }
  
  return new Blob([out], { type: 'application/x-tar' });
}

// Fast ImageBitmap to WebP conversion
async function captureFrame(canvas) {
  try {
    // Try ImageBitmap path (fastest)
    if (typeof createImageBitmap !== 'undefined') {
      const bitmap = await createImageBitmap(canvas);
      const offscreen = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = offscreen.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      
      // WebP lossless is 5-10x faster than PNG
      const blob = await offscreen.convertToBlob({ 
        type: 'image/webp',
        quality: 1.0 
      });
      return await blob.arrayBuffer();
    }
  } catch (e) {
    // Fallback for browsers without OffscreenCanvas
  }
  
  // Fallback: standard canvas toBlob
  const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 1.0));
  return await blob.arrayBuffer();
}

// Batch encode frames in parallel
async function encodeBatch(frameBatch, entries, onProgress) {
  const promises = frameBatch.map(async ({ index, imageData, width, height }) => {
    let canvas;
    
    try {
      // Try OffscreenCanvas (faster, doesn't block main thread)
      canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      ctx.putImageData(imageData, 0, 0);
      
      const blob = await canvas.convertToBlob({ 
        type: 'image/webp',
        quality: 1.0 
      });
      const ab = await blob.arrayBuffer();
      
      if (onProgress) onProgress();
      
      return { 
        name: `frame_${String(index).padStart(6, '0')}.webp`, 
        data: ab 
      };
    } catch (e) {
      // Fallback: use temporary regular canvas
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.putImageData(imageData, 0, 0);
      
      const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 1.0));
      const ab = await blob.arrayBuffer();
      
      if (onProgress) onProgress();
      
      return { 
        name: `frame_${String(index).padStart(6, '0')}.webp`, 
        data: ab 
      };
    }
  });
  
  const encoded = await Promise.all(promises);
  entries.push(...encoded);
}

export async function exportPNGSequence(canvas, mediaTexture, videoElement, isVideo, renderFunc, overlayElement, textElement, fastMode = false) {
  const entries = [];
  
  // Single RAF is enough
  const raf = () => new Promise(r => requestAnimationFrame(r));
  
  overlayElement.classList.remove('hidden');
  textElement.textContent = 'Exporting framesâ€¦ 0%';
  
  if (!isVideo) {
    // Single image
    await renderFunc();
    await raf();
    const ab = await captureFrame(canvas);
    entries.push({ name: 'frame_000000.webp', data: ab });
  } else {
    // Video sequence with batched encoding
    const dur = Math.max(0.01, videoElement.duration || 1);
    const wasLoop = videoElement.loop;
    const wasPaused = videoElement.paused;
    
    videoElement.loop = false;
    videoElement.pause();
    videoElement.currentTime = 0;
    
    await new Promise(resolve => {
      videoElement.addEventListener('seeked', resolve, { once: true });
    });
    
    let i = 0;
    let totalFrames = 0;
    let encodedFrames = 0;
    const frameBatch = [];
    
    // Get 2D context once for capturing
    const captureCtx = canvas.getContext('2d', { willReadFrequently: true });
    
    const updateProgress = () => {
      encodedFrames++;
      const pct = Math.round((encodedFrames / totalFrames) * 100);
      textElement.textContent = `Exporting framesâ€¦ ${pct}%`;
    };
    
    await new Promise(resolve => {
      let vfcb;
      
      const cleanup = () => {
        if (videoElement.cancelVideoFrameCallback && vfcb) {
          try {
            videoElement.cancelVideoFrameCallback(vfcb);
          } catch (e) {}
        }
      };
      
      const onFrame = async () => {
        videoElement.pause();
        
        // Render this frame
        await renderFunc();
        
        // Capture raw ImageData (much faster than toBlob per frame)
        const imageData = captureCtx.getImageData(0, 0, canvas.width, canvas.height);
        
        frameBatch.push({ 
          index: i, 
          imageData, 
          width: canvas.width, 
          height: canvas.height 
        });
        i++;
        totalFrames++;
        
        // Encode batch when full
        if (frameBatch.length >= BATCH_SIZE) {
          textElement.textContent = `Capturing framesâ€¦ ${Math.round((videoElement.currentTime / dur) * 100)}%`;
          await encodeBatch(frameBatch, entries, updateProgress);
          frameBatch.length = 0;
        }
        
        if (videoElement.ended || videoElement.currentTime >= dur - 1e-4) {
          // Encode remaining frames
          if (frameBatch.length > 0) {
            textElement.textContent = 'Encoding final framesâ€¦';
            await encodeBatch(frameBatch, entries, updateProgress);
          }
          cleanup();
          resolve();
          return;
        }
        
        vfcb = videoElement.requestVideoFrameCallback(onFrame);
        videoElement.play().catch(() => {});
      };
      
      vfcb = videoElement.requestVideoFrameCallback(onFrame);
      videoElement.addEventListener('ended', async () => {
        if (frameBatch.length > 0) {
          textElement.textContent = 'Encoding final framesâ€¦';
          await encodeBatch(frameBatch, entries, updateProgress);
        }
        cleanup();
        resolve();
      }, { once: true });
      
      videoElement.play().catch(() => {});
    });
    
    videoElement.loop = wasLoop;
    if (wasPaused) videoElement.pause();
  }
  
  textElement.textContent = 'Building archive...';
  const tarBlob = buildTar(entries);
  overlayElement.classList.add('hidden');
  
  return tarBlob;
}