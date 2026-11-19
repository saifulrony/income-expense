/**
 * Lightweight tactile haptic feedback for Android PWA & Capacitor WebView.
 * Gracefully no-ops on unsupported browsers (iOS Safari / Desktop).
 */
export function triggerHaptic(type: 'light' | 'medium' | 'success' | 'warning' = 'light') {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate !== 'function') return;

  try {
    switch (type) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(18);
        break;
      case 'success':
        navigator.vibrate([12, 35, 18]);
        break;
      case 'warning':
        navigator.vibrate([25, 30, 25]);
        break;
    }
  } catch {
    // Ignore if blocked by browser autoplay/gesture policy
  }
}
