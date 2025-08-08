// --- FILE: js/sidebarResizer.js --- //

export function initResizer(sidebarElement, resizerElement, mainElement) {
    if (!sidebarElement || !resizerElement || !mainElement) {
        console.warn("Sidebar, resizer, or main element not found. Resizer not initialized.");
        return;
    }

    let isResizing = false;
    let startX, startWidth;

    // Load saved width if available
    const savedWidth = localStorage.getItem('sidebarWidth');
    if (savedWidth) {
        sidebarElement.style.width = savedWidth;
    } else {
        // Ensure initial width from CSS is applied if no saved width
        const initialWidth = getComputedStyle(sidebarElement).getPropertyValue('--initial-left-sidebar-width');
        sidebarElement.style.width = initialWidth;
    }


    resizerElement.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = parseInt(document.defaultView.getComputedStyle(sidebarElement).width, 10);
        document.body.style.cursor = 'col-resize'; // Indicate resizing globally
        document.body.style.userSelect = 'none'; // Prevent text selection during drag

        // Attach listeners to document to capture mouse events outside the resizer/sidebar
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    });

    function handleMouseMove(e) {
        if (!isResizing) return;

        const diffX = e.clientX - startX;
        let newWidth = startWidth + diffX;

        // Apply constraints
        const minWidth = parseInt(getComputedStyle(sidebarElement).minWidth, 10) || 150;
        const maxWidthPercentage = parseFloat(getComputedStyle(sidebarElement).maxWidth) || 50; // e.g. 50 for 50%
        const Vpw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
        const maxWidth = (Vpw * maxWidthPercentage)/100;


        if (newWidth < minWidth) {
            newWidth = minWidth;
        } else if (newWidth > maxWidth) {
            newWidth = maxWidth;
        }

        sidebarElement.style.width = `${newWidth}px`;
        // mainElement.style.marginLeft = `${newWidth + parseInt(getComputedStyle(resizerElement).width, 10)}px`; // If main isn't flex-grow
    }

    function handleMouseUp() {
        if (!isResizing) return;
        isResizing = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);

        // Save the new width
        localStorage.setItem('sidebarWidth', sidebarElement.style.width);

        // Dispatch a custom event if other components need to know about the resize
        // For example, CodeMirror instances might need to refresh.
        window.dispatchEvent(new CustomEvent('sidebarResized', { detail: { newWidth: sidebarElement.style.width } }));
    }
}
// --- ENDFILE: js/sidebarResizer.js --- //