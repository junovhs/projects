// utils.js: Phase 2 Helpers – Notifs, debounce, escape. Reusable.
export function showNotification(msg, type = 'info') {
    const notif = document.getElementById('notification');
    notif.textContent = msg;
    notif.style.borderLeftColor = type === 'error' ? 'var(--error-color)' : 'var(--accent-color)';
    notif.classList.add('show');
    // Auto-hide after 3s
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
    const div = document.createElement('div');
    div.textContent = unsafe;
    return div.innerHTML;
}

// Phase 3 Stubs
export function buildTreeString(nodes, indent = '') {
    let str = '';
    nodes.forEach(node => {
        str += `${indent}- ${node.name}${node.isFolder ? ' (Folder)' : ` (${(node.size / 1024).toFixed(2)} KB)`}\n`;
        if (node.children.length) str += buildTreeString(node.children, indent + '  ');
    });
    return str;
}