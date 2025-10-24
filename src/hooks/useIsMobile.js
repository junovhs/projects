// projects/src/hooks/useIsMobile.js
import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 900;

function getIsMobile() {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(getIsMobile);

  useEffect(() => {
    function handleResize() {
      setIsMobile(getIsMobile());
      // CSS variable for 100vh fix on mobile browsers
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    }

    // Initial call
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}