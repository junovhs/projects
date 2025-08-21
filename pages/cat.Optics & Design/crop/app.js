(() => {
  const { useEffect, useMemo, useRef, useState, useCallback } = React;
  const h = React.createElement;

  // --- Utils ---------------------------------------------------------------
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  const keystoneRatios = [
    { label: "1:3", value: 0.3333 }, { label: "1:2", value: 0.5 },
    { label: "9:16", value: 0.5625 }, { label: "10:16", value: 0.625 },
    { label: "2:3", value: 0.6667 }, { label: "3:4", value: 0.75 },
    { label: "4:5", value: 0.8 }, { label: "1:1", value: 1 },
    { label: "5:4", value: 1.25 }, { label: "4:3", value: 1.3333 },
    { label: "3:2", value: 1.5 }, { label: "16:10", value: 1.6 },
    { label: "16:9", value: 1.7778 }, { label: "968:600", value: 968/600 },
    { label: "2:1", value: 2 }, { label: "3:1", value: 3 }
  ];
  const isCustomAspectRatio = (ar) => !keystoneRatios.some(r => Math.abs(r.value - ar) < 0.001);
  const getZoomColorClass = (z) => z >= 1.3 ? "zoom-red" : (z >= 1.01 ? "zoom-orange" : "");

  // --- Core component ------------------------------------------------------
  function CropTool() {
    // State that affects layout/UI
    const [showControls, setShowControls] = useState(false);
    const [aspectRatio, setAspectRatio] = useState(968/600);
    const [customAspectRatio, setCustomAspectRatio] = useState(null);
    const [exportWidth, setExportWidth] = useState(968);
    const [exportHeight, setExportHeight] = useState(600);
    const [filename, setFilename] = useState("");
    const [isBatchMode, setIsBatchMode] = useState(false);
    const [croppedResults, setCroppedResults] = useState([]);
    const [imgSrc, setImgSrc] = useState(null);

    // Measured container/crop rect
    const [displayTargetWidth, setDTW] = useState(0);
    const [displayTargetHeight, setDTH] = useState(0);

    // Refs for perf-critical values (avoid React re-render on every drag/zoom)
    const previewRef = useRef(null);
    const previewContainerRef = useRef(null);
    const cropAreaRef = useRef(null);
    const imageRef = useRef(null);

    const imgNatural = useRef({ w: 0, h: 0 });
    const coverScaleRef = useRef(1);
    const userZoomRef = useRef(1);
    const hasManualZoomRef = useRef(false);
    const rotationRef = useRef(0);
    const offsetRef = useRef({ x: 0, y: 0 });

    const batchQueueRef = useRef([]);

    // --- Resize observer: compute crop area size with aspect ratio ----------
    useEffect(() => {
      const el = previewContainerRef.current;
      if (!el) return;
      const ro = new ResizeObserver(() => {
        const cw = el.clientWidth;
        const ch = el.clientHeight;
        const maxH = 500;

        const testW1 = cw, testH1 = cw / aspectRatio;
        const testH2 = Math.min(ch, maxH), testW2 = testH2 * aspectRatio;

        let w, h;
        if (testW2 <= cw && testH2 <= ch) { w = testW2; h = testH2; }
        else { w = testW1; h = testH1; if (h > Math.min(ch, maxH)) { h = Math.min(ch, maxH); w = h * aspectRatio; } }
        setDTW(Math.round(Math.min(w, cw)));
        setDTH(Math.round(Math.min(h, ch, maxH)));
        // reset pan/zoom bounds on layout change
        offsetRef.current = { x: 0, y: 0 };
        hasManualZoomRef.current = false;
        applyTransform();
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, [aspectRatio]);

    // --- Helpers ------------------------------------------------------------
    const applyTransform = () => {
      const img = previewRef.current;
      if (!img) return;
      const { x, y } = offsetRef.current;
      const scale = Math.max(userZoomRef.current, coverScaleRef.current);
      img.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale}) rotate(${rotationRef.current}deg)`;
    };

    const computeCoverScale = () => {
      const { w, h } = imgNatural.current;
      if (!w || !h || !displayTargetWidth || !displayTargetHeight) return 1;
      const rad = Math.abs(rotationRef.current * Math.PI / 180);
      const rw = w * Math.cos(rad) + h * Math.sin(rad);
      const rh = w * Math.sin(rad) + h * Math.cos(rad);
      const s = Math.max(displayTargetWidth / rw, displayTargetHeight / rh);
      coverScaleRef.current = s;
      if (!hasManualZoomRef.current) userZoomRef.current = s;
      else userZoomRef.current = Math.max(userZoomRef.current, s);
      // keep UI slider in sync with the effective zoom lower bound
      setUiZoom(Math.max(userZoomRef.current, coverScaleRef.current));
    };

    const constrainOffsets = () => {
      const { w, h } = imgNatural.current;
      if (!w || !h || !displayTargetWidth || !displayTargetHeight) return;
      const scale = Math.max(userZoomRef.current, coverScaleRef.current);
      const W = w * scale, H = h * scale;
      const rad = rotationRef.current * Math.PI / 180;
      const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
      const bbW = W * cos + H * sin;
      const bbH = W * sin + H * cos;
      const minX = (displayTargetWidth - bbW) / 2;
      const maxX = (bbW - displayTargetWidth) / 2;
      const minY = (displayTargetHeight - bbH) / 2;
      const maxY = (bbH - displayTargetHeight) / 2;
      const o = offsetRef.current;
      o.x = Math.min(Math.max(o.x, minX), maxX);
      o.y = Math.min(Math.max(o.y, minY), maxY);
    };

    const updateLayout = () => {
      computeCoverScale();
      constrainOffsets();
      applyTransform();
    };

    // --- Drag to pan (raf throttled) ----------------------------------------
    const isDraggingRef = useRef(false);
    const lastPointRef = useRef({ x: 0, y: 0 });
    const rafRef = useRef(0);

    const onMouseDown = useCallback((e) => {
      if (!imageRef.current) return;
      isDraggingRef.current = true;
      lastPointRef.current = { x: e.clientX, y: e.clientY };
    }, []);

    const onMouseMove = useCallback((e) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - lastPointRef.current.x;
      const dy = e.clientY - lastPointRef.current.y;
      lastPointRef.current = { x: e.clientX, y: e.clientY };
      offsetRef.current.x += dx;
      offsetRef.current.y += dy;
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;
          constrainOffsets();
          applyTransform();
        });
      }
    }, []);

    const onMouseUp = useCallback(() => { isDraggingRef.current = false; }, []);

    useEffect(() => {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.addEventListener("mouseleave", onMouseUp);
      return () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.removeEventListener("mouseleave", onMouseUp);
      };
    }, [onMouseMove, onMouseUp]);

    // --- Wheel zoom (bounded) -----------------------------------------------
    const [uiZoom, setUiZoom] = useState(1); // for UI display only
    const onWheel = useCallback((e) => {
      e.preventDefault();
      const step = 0.05;
      const next = e.deltaY < 0 ? (userZoomRef.current + step) : (userZoomRef.current - step);
      userZoomRef.current = Math.min(Math.max(next, coverScaleRef.current), 2);
      hasManualZoomRef.current = true;
      setUiZoom(userZoomRef.current);
      updateLayout();
    }, []);

    // --- Files: drop & click to open ----------------------------------------
    const fileInputRef = useRef(null);
    const onDrop = useCallback((e) => {
      e.preventDefault();
      const dt = e.dataTransfer;
      const files = [];
      const list = dt.items ? Array.from(dt.items) : Array.from(dt.files);
      for (const item of list) {
        const f = item.kind === "file" ? item.getAsFile?.() : item;
        if (f && f.type && f.type.startsWith("image/")) files.push(f);
      }
      if (files.length) startBatch(files);
    }, []);

    const startBatch = (files) => {
      batchQueueRef.current = files.slice(1);
      setCroppedResults([]);
      setIsBatchMode(files.length > 1);
      loadFile(files[0]);
    };

    const loadFile = (file) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const img = new Image();
        img.onload = () => {
          imageRef.current = img;
          imgNatural.current = { w: img.naturalWidth, h: img.naturalHeight };
          setShowControls(true);
          setImgSrc(img.src);
          offsetRef.current = { x: 0, y: 0 };
          rotationRef.current = 0;
          hasManualZoomRef.current = false;
          userZoomRef.current = 1;
          // recalc scaling (after layout paints)
          setTimeout(updateLayout, 0);
        };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    };

    const onClickDrop = useCallback(() => {
      fileInputRef.current?.click();
    }, []);

    const onFileChange = useCallback((e) => {
      const files = Array.from(e.target.files || []).filter(f => f.type.startsWith("image/"));
      if (files.length) startBatch(files);
      e.target.value = "";
    }, []);

    // Keyboard: Enter to export (image or zip)
    useEffect(() => {
      const key = (e) => {
        if (e.key === "Enter" && imageRef.current) {
          e.preventDefault();
          if (isBatchMode) {
            if (batchQueueRef.current.length > 0) processBatchNext();
            else downloadZip();
          } else {
            downloadCurrent();
          }
        }
      };
      document.addEventListener("keydown", key);
      return () => document.removeEventListener("keydown", key);
    }, [isBatchMode]);

    // Drag-over hover affordance
    const dzRef = useRef(null);
    useEffect(() => {
      const dz = dzRef.current;
      if (!dz) return;
      const add = () => dz.classList.add("drag-over");
      const remove = () => dz.classList.remove("drag-over");
      dz.addEventListener("dragenter", add);
      dz.addEventListener("dragover", add);
      dz.addEventListener("dragleave", remove);
      dz.addEventListener("drop", remove);
      // pulse once on initial load
      dz.classList.add("pulse");
      const t = setTimeout(() => dz.classList.remove("pulse"), 3600);
      return () => { clearTimeout(t); dz.removeEventListener("dragenter", add); dz.removeEventListener("dragover", add); dz.removeEventListener("dragleave", remove); dz.removeEventListener("drop", remove); };
    }, []);

    // --- Aspect Ratio & Export size -----------------------------------------
    const onExportWidth = useCallback((v) => {
      const w = parseInt(v, 10);
      if (!isNaN(w) && w > 0) {
        setExportWidth(w);
        const ar = w / exportHeight;
        setAspectRatio(ar);
        setCustomAspectRatio(ar);
      }
    }, [exportHeight]);

    const onExportHeight = useCallback((v) => {
      const h = parseInt(v, 10);
      if (!isNaN(h) && h > 0) {
        setExportHeight(h);
        const ar = exportWidth / h;
        setAspectRatio(ar);
        setCustomAspectRatio(ar);
      }
    }, [exportWidth]);

    useEffect(() => { updateLayout(); }, [displayTargetWidth, displayTargetHeight]);

    useEffect(() => {
      computeCoverScale();
      constrainOffsets();
      applyTransform();
    }, [aspectRatio, exportWidth, exportHeight]);

    // --- Export helpers -----------------------------------------------------
    const composeCanvas = () => {
      const canvas = document.createElement("canvas");
      canvas.width = exportWidth;
      canvas.height = exportHeight;
      const ctx = canvas.getContext("2d");
      ctx.save();
      ctx.translate(exportWidth/2, exportHeight/2);
      const rx = exportWidth / displayTargetWidth;
      const ry = exportHeight / displayTargetHeight;
      ctx.translate(offsetRef.current.x * rx, offsetRef.current.y * ry);
      ctx.rotate(rotationRef.current * Math.PI / 180);
      const s = Math.max(userZoomRef.current, coverScaleRef.current);
      ctx.scale(s * rx, s * ry);
      ctx.drawImage(imageRef.current, -imgNatural.current.w/2, -imgNatural.current.h/2);
      ctx.restore();
      return canvas;
    };

    const downloadCurrent = () => {
      const canvas = composeCanvas();
      const userWord = (filename || "cropped_image").trim();
      const rnd = Math.floor(1000 + Math.random() * 9000);
      const mime = "image/jpeg";
      const ext = "jpg";
      const link = document.createElement("a");
      link.download = `${userWord}_${rnd}.${ext}`;
      link.href = canvas.toDataURL(mime, 0.9);
      link.click();
    };

    const processBatchNext = () => {
      const canvas = composeCanvas();
      const userWord = (filename || "cropped_image").trim();
      const rnd = Math.floor(1000 + Math.random() * 9000);
      const mime = "image/jpeg";
      const ext = "jpg";
      const dataURL = canvas.toDataURL(mime, 0.9);
      setCroppedResults(prev => [...prev, { filename: `${userWord}_${rnd}.${ext}`, dataURL }]);
      const next = batchQueueRef.current.shift();
      if (next) loadFile(next);
    };

    const downloadZip = () => {
      if (!croppedResults.length) return;
      const zip = new JSZip();
      croppedResults.forEach(item => {
        zip.file(item.filename, item.dataURL.split(",")[1], { base64: true });
      });
      zip.generateAsync({ type: "blob" }).then(content => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(content);
        a.download = "cropped_images.zip";
        a.click();
      });
    };

    // --- UI building blocks -------------------------------------------------
    const HelpText = ({ children }) => h("div", { className: "help-text" }, children);

    const Slider = ({ min, max, step, value, onChange, onDoubleClick }) =>
      h("input", { type: "range", className: "slider", min, max, step, value, onChange, onInput: onChange, onDoubleClick });

    // --- Render --------------------------------------------------------------
    const dropZone = !showControls && h("div",
      {
        ref: dzRef,
        className: "drop-zone",
        onDrop,
        onDragOver: (e) => e.preventDefault(),
        onClick: onClickDrop,
        tabIndex: 0,
        role: "button",
        "aria-label": "Upload images by clicking or dragging"
      },
      h("svg", { className: "drop-icon", viewBox: "0 0 24 24", "aria-hidden": "true" },
        h("path", { d: "M19.35 10.04C18.67 6.59 15.64 4 12 4C9.11 4 6.6 5.64 5.35 8.04C2.34 8.36 0 10.91 0 14C0 17.31 2.69 20 6 20H19C21.76 20 24 17.76 24 15C24 12.36 21.95 10.22 19.35 10.04ZM14 13V17H10V13H7L12 8L17 13H14Z" })
      ),
      h("div", { className: "drop-text" }, "Drop Images Here or Click"),
      h("div", { className: "drop-subtext" }, "Drag from downloads or file explorer")
    );

    const previewPane = showControls && h("div",
      {
        className: "preview-container",
        onDrop, onDragOver: (e) => e.preventDefault(),
        ref: previewContainerRef
      },
      h("div", {
        ref: cropAreaRef,
        className: "crop-area",
        style: { width: `${displayTargetWidth}px`, height: `${displayTargetHeight}px` },
        onMouseDown, onWheel
      },
        h("img", {
          ref: previewRef,
          alt: "Preview",
          src: imgSrc || "",
          style: { cursor: isDraggingRef.current ? "grabbing" : "grab", width: `${imgNatural.current.w}px`, height: `${imgNatural.current.h}px`, left: "50%", top: "50%" }
        })
      )
    );

    const ratios = keystoneRatios.map((ratio, i) =>
      h("button", {
        key: `r${i}`, className: `ratio-btn ${Math.abs(aspectRatio - ratio.value) < 0.001 ? "active" : ""}`,
        onClick: () => {
          setAspectRatio(ratio.value);
          setCustomAspectRatio(null);
          setExportWidth(Math.round(exportHeight * ratio.value));
        }
      }, ratio.label)
    );
    if (customAspectRatio) ratios.push(
      h("button", {
        key: "custom", className: "ratio-btn custom-ratio-btn active",
        onClick: () => {
          setAspectRatio(customAspectRatio);
          setExportWidth(Math.round(exportHeight * customAspectRatio));
        }
      }, "Custom")
    );

    const exportActions = isBatchMode
      ? h("button", { className: "export-btn success", onClick: downloadZip },
          h("span", { className: "btn-icon" }, "📦"),
          h("span", { className: "btn-text" }, "Download ZIP")
        )
      : h("button", { className: "export-btn primary", onClick: downloadCurrent },
          h("span", { className: "btn-icon" }, "⬇"),
          h("span", { className: "btn-text" }, "Download Image")
        );

    // Mounted hidden file input
    const fileInput = h("input", {
      type: "file", accept: "image/*", multiple: true, ref: fileInputRef,
      style: { display: "none" }, onChange: onFileChange
    });

    return h("div", { className: "app-container" },
      fileInput,
      h("div", { className: "header" }, h("h1", { className: "title" }, "ULTIMATE CROP TOOL")),
      h("div", { className: "main-content" },
        h("div", { className: "left-panel" }, dropZone || previewPane),
        showControls && h("div", { className: "right-panel" },
          h("div", { className: "controls" },
            h("div", { className: "control-section" },
              h("div", { className: "section-header" },
                h("div", { className: "section-icon" }, "📐"),
                h("div", { className: "section-title" }, "Dimensions")
              ),
              h("div", { className: "control-group" },
                h("div", { className: "control-label" }, "Export Size"),
                h("div", { className: "dimension-inputs" },
                  h("div", { className: "input-wrapper" },
                    h("input", { type: "number", className: "dimension-input", placeholder: "Width", value: exportWidth, onChange: e => onExportWidth(e.target.value) }),
                    h("span", { className: "input-label" }, "W")
                  ),
                  h("div", { className: "dimension-separator" }, "×"),
                  h("div", { className: "input-wrapper" },
                    h("input", { type: "number", className: "dimension-input", placeholder: "Height", value: exportHeight, onChange: e => onExportHeight(e.target.value) }),
                    h("span", { className: "input-label" }, "H")
                  )
                )
              ),
              h("div", { className: "control-group" },
                h("div", { className: "control-label" }, "Aspect Ratio"),
                h("div", { className: "slider-container" },
                  h(Slider, {
                    min: 0.3333, max: 3, step: 0.01, value: aspectRatio,
                    onChange: (e) => {
                      const v = parseFloat(e.target.value);
                      setAspectRatio(v);
                      setCustomAspectRatio(v);
                      setExportWidth(Math.round(exportHeight * v));
                    },
                    onDoubleClick: () => {
                      const def = 968/600;
                      setAspectRatio(def); setExportWidth(968); setExportHeight(600); setCustomAspectRatio(null);
                    }
                  }),
                  h("div", { className: `value-display ${isCustomAspectRatio(aspectRatio) ? "custom" : ""}` },
                    aspectRatio >= 1 ? `${aspectRatio.toFixed(2)}:1` : `1:${(1/aspectRatio).toFixed(2)}`
                  )
                ),
                h("div", { className: "ratio-grid" }, ratios),
                h(HelpText, null, "Choose preset ratios or drag slider for custom ratios that save automatically.")
              )
            ),
            h("div", { className: "control-section" },
              h("div", { className: "section-header" },
                h("div", { className: "section-icon" }, "🔍"),
                h("div", { className: "section-title" }, "View")
              ),
              h("div", { className: "control-group" },
                h("div", { className: "control-label" }, "Zoom Level"),
                h("div", { className: "slider-container" },
                  h(Slider, {
                    min: 0.3333, max: 2, step: 0.01, value: uiZoom,
                    onChange: (e) => {
                      userZoomRef.current = parseFloat(e.target.value);
                      hasManualZoomRef.current = true;
                      setUiZoom(userZoomRef.current);
                      updateLayout();
                    },
                    onDoubleClick: () => {
                      userZoomRef.current = 1;
                      hasManualZoomRef.current = true;
                      setUiZoom(1);
                      updateLayout();
                    }
                  }),
                  h("div", { className: `value-display ${getZoomColorClass(uiZoom)}` }, `${uiZoom.toFixed(2)}×`)
                ),
                h(HelpText, null, "Scroll wheel over image to zoom. Orange = upscaled, Red = highly upscaled.")
              )
            ),
            h("div", { className: "control-section" },
              h("div", { className: "section-header" },
                h("div", { className: "section-icon" }, "📁"),
                h("div", { className: "section-title" }, "Output")
              ),
              h("div", { className: "control-group" },
                h("div", { className: "control-label" }, "Filename"),
                h("div", { className: "filename-input-wrapper" },
                  h("input", { type: "text", className: "filename-input", placeholder: "Enter filename...", value: filename, onChange: e => setFilename(e.target.value) }),
                  h("div", { className: "filename-extension" }, ".jpg")
                ),
                h(HelpText, null, "Custom filename for exported images. Random suffix added automatically.")
              )
            )
          ),
          h("div", { className: "export-section" },
            h("div", { className: "export-header" },
              h("div", { className: "export-icon" }, "⚡"),
              h("div", { className: "export-title" }, "Export")
            ),
            h("div", { className: "export-actions" }, exportActions),
            h("div", { className: "export-shortcut" }, "Press ", h("kbd", null, "Enter"), " to export")
          )
        )
      )
    );
  }

  // Mount
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(h(CropTool));
})();