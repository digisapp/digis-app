/**
 * Centralized beacon utility for sending analytics during page unload
 * Falls back to sync XHR if sendBeacon is unavailable
 */

export function fireBeacon(url, data) {
  try {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });

    // Try sendBeacon first (preferred - non-blocking, survives page teardown)
    if (navigator.sendBeacon?.(url, blob)) {
      return true;
    }
  } catch (err) {
    console.warn('sendBeacon failed:', err);
  }

  // Fallback to synchronous XHR (best-effort, works in older browsers)
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, false); // sync=false would be async, we need sync here
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify(data));
    return xhr.status >= 200 && xhr.status < 300;
  } catch (err) {
    console.warn('XHR fallback failed:', err);
  }

  // Last resort: keepalive fetch (fire-and-forget, may not complete)
  try {
    fetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'content-type': 'application/json' },
      keepalive: true
    }).catch(() => {});
  } catch (err) {
    console.warn('Fetch fallback failed:', err);
  }

  return false;
}
