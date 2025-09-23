// utils.js
// Phase 1.5 Helpers – Notifs, debounce, logging/tracing. Crucial for debug.

export function showNotification(msg, type = 'info') {
  console.log(`[NOTIF ${type.toUpperCase()}] ${msg}`);
  const notif = document.getElementById('notification');
  if (!notif) return;
  notif.textContent = msg;
  notif.style.borderLeftColor =
    type === 'error' ? 'var(--error-color)' : 'var(--accent-color)';
  notif.classList.add('show');
  setTimeout(() => notif.classList.remove('show'), 3000);
}

export function debounce(func, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

export function escapeHtml(unsafe) {
  console.log(`[UTILS] Escaping HTML for: ${unsafe.substring(0, 50)}...`);
  const div = document.createElement('div');
  div.textContent = unsafe;
  return div.innerHTML;
}

export function logEvent(msg, data = null) {
  console.log(`[EVENT] ${msg}`, data || '');
}

export function traceError(msg, err = null) {
  console.trace(`[ERROR] ${msg}`, err || '');
  showNotification(msg, 'error');
}

// Phase 3 Stubs with Logs (still handy for debugging)
export function buildTreeString(nodes, indent = '') {
  console.log(`[UTILS] Building tree string for ${nodes.length} nodes`);
  let str = '';
  nodes.forEach(node => {
    str += `${indent}- ${node.name}${
      node.isFolder ? ' (Folder)' : ` (${(node.size / 1024).toFixed(2)} KB)`
    }\n`;
    if (node.children.length)
      str += buildTreeString(node.children, indent + '  ');
  });
  return str;
}

// ---------------------------------------------------------------------------
// Phase 2 helpers: text/binary classification + stable sorter
// ---------------------------------------------------------------------------
(function () {
  if (!window.mimeLooksTextual) {
    window.mimeLooksTextual = mime => {
      if (!mime) return false;
      if (mime.startsWith('text/')) return true;
      return new Set([
        'application/json',
        'application/x-ndjson',
        'application/javascript',
        'application/xml',
        'application/x-sh',
        'application/sql',
        'application/x-toml',
        'application/x-yaml',
        'text/yaml',
        'application/x-www-form-urlencoded'
      ]).has(mime);
    };
  }

  if (!window.extLooksTextual) {
    const ALLOW = new Set([
      // general text
      'txt', 'log', 'md', 'markdown', 'rst', 'adoc', 'textile', 'license', 'changelog',
      // data
      'csv','tsv','ndjson','json','jsonc','yaml','yml','toml','ini','cfg','conf','properties','props','env','dotenv',
      // markup
      'html','htm','xhtml','xml',
      // scripts
      'sh','bash','zsh','ksh','fish','ps1','psm1','bat','cmd',
      // programming
      'js','mjs','cjs','ts','jsx','tsx','py','rb','php','pl','pm','t','java','kt','kts','groovy','scala',
      'go','rs','swift','m','mm','c','cc','cpp','cxx','h','hh','hpp','cs','vb','fs','dart','lua','r','jl',
      // build/tooling
      'makefile','gnumakefile','mk','cmake','gradle','pom','babelrc','prettierrc','editorconfig','npmrc','nvmrc','eslintignore','gitignore','gitattributes',
      // sql
      'sql','psql','mysql','sqlite','hql',
      // notebooks
      'ipynb'
    ]);

    const DENY = new Set([
      // images & graphics
      'png','jpg','jpeg','gif','webp','avif','bmp','tiff','ico','icns','svgz','psd','ai','sketch','fig','svg',
      // archives
      'zip','tar','gz','tgz','bz2','xz','7z','rar','zst','jar','war','ear','nupkg',
      // office docs
      'pdf','doc','docx','ppt','pptx','xls','xlsx','key','pages','numbers',
      // audio/video
      'mp3','aac','wav','flac','ogg','m4a','mp4','mov','mkv','avi','webm','wmv',
      // fonts
      'ttf','otf','woff','woff2','eot',
      // executables & libs
      'exe','msi','dll','so','dylib','bin','o','a','class','wasm'
    ]);

    const DOTS = new Set([
      '.gitignore','.gitattributes','.npmrc','.nvmrc','.env','.env.local',
      '.editorconfig','.prettierrc','.eslintrc','.stylelintrc'
    ]);

    window.extLooksTextual = (ext, filename) => {
      if (!ext) return DOTS.has(filename);
      const e = String(ext).toLowerCase();
      if (DENY.has(e)) return false;
      return ALLOW.has(e);
    };
  }

  if (!window.sortStable) {
    window.sortStable = (arr, selector = x => x) => {
      return arr
        .map((v, i) => [selector(v), i, v])
        .sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1])
        .map(([, , v]) => v);
    };
  }
})();
