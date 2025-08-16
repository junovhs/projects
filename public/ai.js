// Simple shared client for calling your AI APIs with a password.
// Usage: <script src="/ai.js"></script> then window.AI.call('/api/generate', payload)
(function () {
  const KEY = 'ai-pass';

  async function ensurePassword() {
    let pass = sessionStorage.getItem(KEY);
    if (!pass) {
      pass = window.prompt('Enter AI API password');
      if (!pass) throw new Error('No password provided');
      sessionStorage.setItem(KEY, pass);
    }
    return pass;
  }

  async function call(endpoint, payload, fetchOpts = {}) {
    let pass = await ensurePassword();

    async function doFetch() {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pass}`,
          ...(fetchOpts.headers || {})
        },
        body: JSON.stringify(payload),
        ...fetchOpts
      });
      return res;
    }

    let r = await doFetch();

    if (r.status === 401) {
      sessionStorage.removeItem(KEY);
      pass = await ensurePassword();
      r = await doFetch();
    }

    if (!r.ok) {
      let details;
      try { details = await r.json(); } catch { details = { error: await r.text() }; }
      throw new Error(details?.error || 'Request failed');
    }
    return await r.json();
  }

  window.AI = { call, setPassword: (p) => sessionStorage.setItem(KEY, p) };
})();
