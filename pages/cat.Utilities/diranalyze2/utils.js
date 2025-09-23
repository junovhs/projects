// utils.js: Phase 1.5 Helpers – Notifs, debounce, logging/tracing. Crucial for debug.
export function showNotification(msg, type = 'info') {
    console.log(`[NOTIF ${type.toUpperCase()}] ${msg}`);
    const notif = document.getElementById('notification');
    notif.textContent = msg;
    notif.style.borderLeftColor = type === 'error' ? 'var(--error-color)' : 'var(--accent-color)';
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

// Phase 3 Stubs with Logs
export function buildTreeString(nodes, indent = '') {
    console.log(`[UTILS] Building tree string for ${nodes.length} nodes`);
    let str = '';
    nodes.forEach(node => {
        str += `${indent}- ${node.name}${node.isFolder ? ' (Folder)' : ` (${(node.size / 1024).toFixed(2)} KB)`}\n`;
        if (node.children.length) str += buildTreeString(node.children, indent + '  ');
    });
    return str;
}