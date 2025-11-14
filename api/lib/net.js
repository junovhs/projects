// projects/api/_lib/net.js

/**
 * Fetches a resource as a Uint8Array with strict timeouts and size limits.
 *
 * @param {string | URL} url - The URL to fetch.
 * @param {object} [options={}] - Configuration options.
 * @param {number} [options.timeoutMs=10000] - Timeout in milliseconds.
 * @param {number} [options.maxBytes=5000000] - Maximum allowed bytes (5MB default).
 * @param {RequestInit} [options.init={}] - Additional options for the fetch call.
 * @returns {Promise<Uint8Array>} The fetched data as a byte array.
 * @throws {Error} If the fetch times out, the resource is too large, or the request fails.
 */
export async function fetchBinaryWithBudget(url, options = {}) {
  const {
    timeoutMs = 10_000,
    maxBytes = 5_000_000, // 5MB default
    init = {}
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      redirect: 'follow',
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > maxBytes) {
      throw new Error(`Resource too large (${contentLength} bytes > ${maxBytes} bytes)`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) {
      throw new Error(`Downloaded resource too large (${arrayBuffer.byteLength} bytes > ${maxBytes} bytes)`);
    }

    return new Uint8Array(arrayBuffer);
  } finally {
    clearTimeout(timeoutId);
  }
}