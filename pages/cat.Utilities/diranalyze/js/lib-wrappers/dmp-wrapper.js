// --- FILE: js/lib-wrappers/dmp-wrapper.js --- //
// This file assumes diff_match_patch.js has been loaded and DiffMatchPatch is global
// or it exports DiffMatchPatch if it's an IIFE that exposes it.

// Check if it's already defined (e.g. by a <script> tag)
if (typeof diff_match_patch === 'undefined') { // Check for the global lowercase name
    console.error("diff_match_patch global not found. Ensure js/lib/diff_match_patch.js is loaded before modules or is an ES module itself.");
    // Fallback to a dummy object to prevent hard crashes on import
    window.diff_match_patch = function() { // Assign to the global name if not found
        this.diff_main = () => [];
        this.patch_make = () => [];
        this.patch_apply = () => ["", []];
        this.diff_prettyHtml = () => "Diff library not properly loaded.";
    };
}
// Export the global that should exist
export const DMP = window.diff_match_patch; // Export the lowercase global
// --- ENDFILE: js/lib-wrappers/dmp-wrapper.js --- //