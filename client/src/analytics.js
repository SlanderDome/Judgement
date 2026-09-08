export function trackEvent(eventName, parameters = {}) {
  try {
    if (typeof window === "undefined" || typeof window.gtag !== "function") {
      return;
    }

    window.gtag("event", eventName, parameters);
  } catch (_error) {
    // Analytics must never interrupt gameplay.
  }
}
