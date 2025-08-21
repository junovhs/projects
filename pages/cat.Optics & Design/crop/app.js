(() => {
  const { useEffect, useRef, useState, useCallback } = React;
  const h = React.createElement;

  // -------------------- utils
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const ratios = [
    { label: "1:3", value: 1/3 }, { label: "1:2", value: 1/2 },
    { label: "9:16", value: 9/16 }, { label: "10:16", value: 10/16 },
    { label: "2:3", value: 2/3 }, { label: "3:4", value: 3/4 },
    { label: "4:5", value: 4/5 }, { label: "1:1", value: 1 },
    { label: "5:4", value: 5/4 }, { label: "4:3", value: 4/3 },
    { label: "3:2", value: 3/2 }, { label: "16:10", value: 16/10 },
    { label: "16:9", value: 16/9 }, { label: "968:600", value: 968/600 },
    { label: "2:1", value: 2 }, { label: "3:1", value: 3 },
  ];
  const isCustomAR = (ar) => !ratios.some(r => Math.abs(r.value - ar) < 0.001);
  const zoomColorClass = (z) => z >= 1.3 ? "zoom-red" : z >= 1.01 ? "zoom-orange" : "";

  function CropTool() {
    // ------------- UI state
    const [showControls, setShowControls] = useState(false);
    const [aspectRatio, setAspectRatio] = useState(968/600);
    const [customAR, setCustomAR] = useState(null);
    const [exportW, setExportW] = useState(968);
    const [exportH, setExportH] = useState(600);
    const [filename, setFilename] = useState("");
    const [uiZoom, setUiZoom] = useState(1);
    const [imgSrc, setImgSrc] = useState(null);

    // ------------- DOM refs
    const previewContainerRef = useRef(null);
    const cropAreaRef = useRef(null);
    const previewImgRef = useRef(null);

    // ------------- image + transform refs (perf)
    const imgElRef = useRef(null);             // off-DOM Image()
    const natural = useRef({ w: 0, h: 0 });
    const coverScaleRef = useRef(1);           // min scale so image covers crop area
    const userScaleRef = useRef(1);            // user scale request
    const rotationRef = useRef(0);             // rotation (kept for parity)
    const offsetRef = useRef({ x: 0, y: 0 });  // pan offset
    const hasManualZoomRef = useRef(false);

    // ------------- crop area size (in px within preview container)
    const [tW, setTW] = useState(0);
    const [tH, setTH] = useState(0);

    // Responsively compute crop size given container & aspect ratio
    useEffect(() => {
      const el = previewContainerRef.current;
      if (!el) return;
      const ro = new ResizeObserver(() => {
        const cw = el.clientWidth;
        const ch = el.clientHeight;
        const maxH = 520;

        const candidateH = Math.min(ch, maxH);
        const candidateW = candidateH * aspectRatio;

        let w, h;
        if (candidateW <= cw) { w = candidateW; h = candidateH; }
        else { w = cw; h = cw / aspectRatio; }

        setTW(Math.round(w));
        setTH(Math.round(h));
        // reset pan when size changes; cover recomputed below
        offsetRef.current = { x: 0, y: 0 };
        hasManualZoomRef.current = false;
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, [aspectRatio]);

    // ---- helpers: transforms & constraints
    const applyTransform = () => {
      const el = previewImgRef.current;
      if (!el) return;
      const { x, y } = offsetRef.current;
      const s = Math.max(userScaleRef.current, coverScaleRef.current);
      el.style.transform =
        `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${s}) rotate(${rotationRef.current}deg)`;
    };

    const computeCoverScale = () => {
      const { w, h } = natural.current;
      if (!w || !h || !tW || !tH) return 1;
      const rad = Math.abs(rotationRef.current * Math.PI / 180);
      // rotated bounding box of the original (unscaled) image
      const rw = w * Math.cos(rad) + h * Math.sin(rad);
      const rh = w * Math.sin(rad) + h * Math.cos(rad);
      const s = Math.max(tW / rw, tH / rh);
      coverScaleRef.current = s;
      // enforce cover: user scale can never be below cover
      if (!hasManualZoomRef.current || userScaleRef.current < s) {
        userScaleRef.current = s;
      }
      setUiZoom(Math.max(userScaleRef.current, s));
      return s;
    };

    const constrainOffsets = () => {
      const { w, h } = natural.current;
      if (!w || !h || !tW || !tH) return;
      const s = Math.max(userScaleRef.current, coverScaleRef.current);
      const W = w * s, H = h * s;

      const rad = rotationRef.current * Math.PI / 180;
      const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
      // bounding box after scale + rotation
      const bbW = W * cos + H * sin;
      const bbH = W * sin + H * cos;

      // To avoid any black, image bb must cover crop area.
      // Clamp panning so bb edges never cross crop edges.
      const minX = (tW - bbW) / 2;
      const maxX = (bbW - tW) / 2;
      const minY = (tH - bbH) / 2;
      const maxY = (bbH - tH) / 2;

      const o = offsetRef.current;
      o.x = clamp(o.x, minX, maxX);
      o.y = clamp(o.y, minY, maxY);
    };

    const updateLayout = () => {
      computeCoverScale();
      constrainOffsets();
      applyTransform();
    };

    // ---- Drag/pan (only inside crop area)
    const draggingRef = useRef(false);
    const lastPtRef = useRef({ x: 0, y: 0 });
    const rafRef = useRef(0);

    const onMouseDown = useCallback((e) => {
      draggingRef.current = true;
      lastPtRef.current = { x: e.clientX, y: e.clientY };
    }, []);
    const onMouseMove = useCallback((e) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - lastPtRef.current.x;
      const dy = e.clientY - lastPtRef.current.y;
      lastPtRef.current = { x: e.clientX, y: e.clientY };
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
    const endDrag = useCallback(() => { draggingRef.current = false; }, []);
    useEffect(() => {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", endDrag);
      document.addEventListener("mouseleave", endDrag);
      return () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", endDrag);
        document.removeEventListener("mouseleave", endDrag);
      };
    }, [onMouseMove, endDrag]);

    // ---- Wheel zoom (clamped to cover)
    const onWheel = useCallback((e) => {
      e.preventDefault();
      const step = 0.05;
      const next = e.deltaY < 0 ? (userScaleRef.current + step) : (userScaleRef.current - step);
      userScaleRef.current = clamp(next, coverScaleRef.current || 0, 2);
      hasManualZoomRef.current = true;
      setUiZoom(userScaleRef.current);
      updateLayout();
    }, []);

    // ---- Files: click or drop
    const fileInputRef = useRef(null);
    const onDrop = useCallback((e) => {
      e.preventDefault();
      const list = e.dataTransfer.items ? Array.from(e.dataTransfer.items) : Array.from(e.dataTransfer.files);
      const files = [];
      for (const it of list) {
        const f = it.kind === "file" ? it.getAsFile?.() : it;
        if (f && f.type && f.type.startsWith("image/")) files.push(f);
      }
      if (files.length) loadFile(files[0]); // (batch omitted for brevity; keep single-export UX fast)
    }, []);
    const onClickDrop = useCallback(() => fileInputRef.current?.click(), []);
    const onFileChange = useCallback((e) => {
      const f = (e.target.files || [])[0];
      if (f && f.type.startsWith("image/")) loadFile(f);
      e.target.value = "";
    }, []);

    const loadFile = (file) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const img = new Image();
        img.onload = () => {
          imgElRef.current = img;
          natural.current = { w: img.naturalWidth, h: img.naturalHeight };
          setImgSrc(img.src);
          setShowControls(true);
          offsetRef.current = { x: 0, y: 0 };
          rotationRef.current = 0;
          hasManualZoomRef.current = false;
          userScaleRef.current = 1;
          // wait for the preview <img> to mount/paint inside iframe, then layout
          setTimeout(updateLayout, 0);
          setTimeout(updateLayout, 30);
        };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    };

    // ---- dimension changes keep cover
    useEffect(() => { updateLayout(); }, [tW, tH]);
    useEffect(() => { updateLayout(); }, [aspectRatio, exportW, exportH]);

    // ---- export
    const composeCanvas = () => {
      const canvas = document.createElement("canvas");
      canvas.width = exportW;
      canvas.height = exportH;
      const ctx = canvas.getContext("2d");
      ctx.save();
      ctx.translate(exportW/2, exportH/2);

      // map crop-space to export-space
      const rx = exportW / tW;
      const ry = exportH / tH;

      ctx.translate(offsetRef.current.x * rx, offsetRef.current.y * ry);
      ctx.rotate(rotationRef.current * Math.PI / 180);
      const s = Math.max(userScaleRef.current, coverScaleRef.current);
      ctx.scale(s * rx, s * ry);
      ctx.drawImage(imgElRef.current, -natural.current.w/2, -natural.current.h/2);
      ctx.restore();
      return canvas;
    };

    const download = () => {
      if (!imgElRef.current) return;
      const canvas = composeCanvas();
      const name = (filename || "cropped_image").trim();
      const ext = "jpg";
      const a = document.createElement("a");
      a.download = `${name}_${Math.floor(1000 + Math.random()*9000)}.${ext}`;
      a.href = canvas.toDataURL("image/jpeg", 0.92);
      a.click();
    };

    // ---- UI bits
    const Slider = ({ min, max, step, value, onChange, onDoubleClick }) =>
      h("input", {
        type: "range", className: "slider",
        min, max, step, value,
        onChange, onInput: onChange, onDoubleClick
      });

    const ratioButtons = ratios.map((r, i) =>
      h("button", {
        key: i, className: `ratio-btn ${Math.abs(aspectRatio - r.value) < 0.001 ? "active" : ""}`,
        onClick: () => {
          setAspectRatio(r.value);
          setCustomAR(null);
          setExportW(Math.round(exportH * r.value));
        }
      }, r.label)
    );
    if (customAR) {
      ratioButtons.push(
        h("button", {
          key: "custom", className: "ratio-btn custom-ratio-btn active",
          onClick: () => {
            setAspectRatio(customAR);
            setExportW(Math.round(exportH * customAR));
          }
        }, "Custom")
      );
    }

    const dropZone = !showControls && h("div",
      {
        className: "drop-zone", onDrop, onDragOver: e => e.preventDefault(),
        onClick: onClickDrop, tabIndex: 0, role: "button", ref: (n) => {
          if (n) { n.classList.add("pulse"); setTimeout(() => n.classList.remove("pulse"), 3600); }
        },
        "aria-label": "Upload images by clicking or dragging"
      },
      h("svg", { className: "drop-icon", viewBox: "0 0 24 24", "aria-hidden": "true" },
        h("path", { d: "M19.35 10.04C18.67 6.59 15.64 4 12 4C9.11 4 6.6 5.64 5.35 8.04C2.34 8.36 0 10.91 0 14C0 17.31 2.69 20 6 20H19C21.76 20 24 17.76 24 15C24 12.36 21.95 10.22 19.35 10.04ZM14 13V17H10V13H7L12 8L17 13H14Z" })
      ),
      h("div", { className: "drop-text" }, "Drop images here or click"),
      h("div", { className: "drop-subtext" }, "Drag from downloads or your file explorer")
    );

    const preview = showControls && h("div",
      { className: "preview-container", onDrop, onDragOver: e => e.preventDefault(), ref: previewContainerRef },
      h("div", {
        className: "crop-area",
        ref: cropAreaRef,
        style: { width: `${tW}px`, height: `${tH}px` },
        onMouseDown, onWheel
      },
        h("img", {
          ref: previewImgRef,
          alt: "Preview",
          src: imgSrc || "",
          style: {
            width: `${natural.current.w}px`,
            height: `${natural.current.h}px`,
            cursor: draggingRef.current ? "grabbing" : "grab"
          }
        })
      )
    );

    // hidden file input
    const fileInput = h("input", {
      type: "file", accept: "image/*", style: { display: "none" },
      ref: fileInputRef, onChange: onFileChange, multiple: false
    });

    return h("div", { className: "app-container" },
      fileInput,
      h("div", { className: "header" }, h("h1", { className: "title" }, "ULTIMATE CROP TOOL")),
      h("div", { className: "main-content" },
        h("div", { className: "left-panel" }, dropZone || preview),
        showControls && h("div", { className: "right-panel" },
          h("div", { className: "controls" },
            // Dimensions
            h("div", { className: "control-section" },
              h("div", { className: "section-header" }, h("div", { className: "section-title" }, "Dimensions")),
              h("div", { className: "control-group" },
                h("div", { className: "control-label" }, "Export Size"),
                h("div", { className: "dimension-inputs" },
                  h("div", { className: "input-wrapper" },
                    h("input", {
                      type: "number", className: "dimension-input", placeholder: "Width",
                      value: exportW, onChange: e => {
                        const w = Math.max(1, parseInt(e.target.value || "0", 10));
                        setExportW(w);
                        const ar = w / exportH;
                        setAspectRatio(ar); setCustomAR(ar);
                      }
                    }),
                    h("span", { className: "input-label" }, "W")
                  ),
                  h("div", { className: "dimension-separator" }, "×"),
                  h("div", { className: "input-wrapper" },
                    h("input", {
                      type: "number", className: "dimension-input", placeholder: "Height",
                      value: exportH, onChange: e => {
                        const hVal = Math.max(1, parseInt(e.target.value || "0", 10));
                        setExportH(hVal);
                        const ar = exportW / hVal;
                        setAspectRatio(ar); setCustomAR(ar);
                      }
                    }),
                    h("span", { className: "input-label" }, "H")
                  )
                )
              ),
              h("div", { className: "control-group" },
                h("div", { className: "control-label" }, "Aspect Ratio"),
                h("div", { className: "slider-container" },
                  h(Slider, {
                    min: 1/3, max: 3, step: 0.01, value: aspectRatio,
                    onChange: (e) => {
                      const v = parseFloat(e.target.value);
                      setAspectRatio(v); setCustomAR(v);
                      setExportW(Math.round(exportH * v));
                    },
                    onDoubleClick: () => {
                      const def = 968/600;
                      setAspectRatio(def); setExportW(968); setExportH(600); setCustomAR(null);
                    }
                  }),
                  h("div", { className: `value-display ${isCustomAR(aspectRatio) ? "custom" : ""}` },
                    aspectRatio >= 1 ? `${aspectRatio.toFixed(2)}:1` : `1:${(1/aspectRatio).toFixed(2)}`
                  )
                ),
                h("div", { className: "ratio-grid" }, ratioButtons),
                h("div", { className: "help-text" }, "Use presets or drag the slider for a custom ratio.")
              )
            ),

            // View
            h("div", { className: "control-section" },
              h("div", { className: "section-header" }, h("div", { className: "section-title" }, "View")),
              h("div", { className: "control-group" },
                h("div", { className: "control-label" }, "Zoom Level"),
                h("div", { className: "slider-container" },
                  h(Slider, {
                    min: Math.max(coverScaleRef.current || 0.1, 0.1),
                    max: 2,
                    step: 0.01,
                    value: uiZoom,
                    onChange: (e) => {
                      const val = parseFloat(e.target.value);
                      userScaleRef.current = Math.max(val, coverScaleRef.current || 0);
                      hasManualZoomRef.current = true;
                      setUiZoom(userScaleRef.current);
                      updateLayout();
                    },
                    onDoubleClick: () => {
                      hasManualZoomRef.current = true;
                      userScaleRef.current = coverScaleRef.current || 1;
                      setUiZoom(userScaleRef.current);
                      updateLayout();
                    }
                  }),
                  h("div", { className: `value-display ${zoomColorClass(uiZoom)}` }, `${uiZoom.toFixed(2)}×`)
                ),
                h("div", { className: "help-text" }, "Scroll over the image to zoom. You can’t zoom below ‘cover’.")
              )
            ),

            // Output
            h("div", { className: "control-section" },
              h("div", { className: "section-header" }, h("div", { className: "section-title" }, "Output")),
              h("div", { className: "control-group" },
                h("div", { className: "control-label" }, "Filename"),
                h("div", { className: "filename-input-wrapper" },
                  h("input", {
                    type: "text", className: "filename-input", placeholder: "Enter filename...",
                    value: filename, onChange: e => setFilename(e.target.value)
                  }),
                  h("div", { className: "filename-extension" }, ".jpg")
                )
              )
            )
          ),

          // Export
          h("div", { className: "export-section" },
            h("div", { className: "export-actions" },
              h("button", { className: "export-btn primary", onClick: download },
                h("span", null, "⬇"), h("span", null, "Download Image")
              )
            ),
            h("div", { className: "help-text" }, "Press Enter to export.")
          )
        )
      )
    );
  }

  // mount
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(h(CropTool));
})();
