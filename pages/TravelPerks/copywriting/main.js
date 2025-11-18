// Confetti Logic for Visual Reward
const confetti = window.confetti || null;

function triggerSpecialConfetti() {
    if (!confetti) {
        console.warn("Confetti library not loaded.");
        return;
    }
    
    // A quick, snappy burst of confetti
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#10b981', '#8b5cf6', '#f97316'],
        zIndex: 2000,
        disableForReducedMotion: true
    });
}

// Expose to window for React to access
window.triggerSpecialConfetti = triggerSpecialConfetti;