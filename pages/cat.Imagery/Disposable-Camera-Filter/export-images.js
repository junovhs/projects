// PNG sequence export with TAR packaging

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

export async function exportPNGSequence(canvas, mediaTexture, videoElement, isVideo, renderFunc, overlayElement, textElement) {
  const entries = [];
  
  const raf2 = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const savePNG = () => new Promise(r => canvas.toBlob(r, 'image/png'));
  
  overlayElement.classList.remove('hidden');
  textElement.textContent = 'Exporting PNGs… 0%';
  
  if (!isVideo) {
    // Single image
    await raf2();
    const blob = await savePNG();
    const ab = await blob.arrayBuffer();
    entries.push({ name: 'frame_000000.png', data: ab });
  } else {
    // Video sequence
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
        await raf2();
        
        const blob = await savePNG();
        const ab = await blob.arrayBuffer();
        const name = `frame_${String(i).padStart(6, '0')}.png`;
        entries.push({ name, data: ab });
        i++;
        
        textElement.textContent = `Exporting PNGs… ${Math.round((videoElement.currentTime / dur) * 100)}%`;
        
        if (videoElement.ended || videoElement.currentTime >= dur - 1e-4) {
          cleanup();
          resolve();
          return;
        }
        
        vfcb = videoElement.requestVideoFrameCallback(onFrame);
        videoElement.play().catch(() => {});
      };
      
      vfcb = videoElement.requestVideoFrameCallback(onFrame);
      videoElement.addEventListener('ended', () => {
        cleanup();
        resolve();
      }, { once: true });
      
      videoElement.play().catch(() => {});
    });
    
    videoElement.loop = wasLoop;
    if (wasPaused) videoElement.pause();
  }
  
  const tarBlob = buildTar(entries);
  overlayElement.classList.add('hidden');
  
  return tarBlob;
}