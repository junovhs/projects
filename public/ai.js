// ===== START OF FILE: public/ai.js =====
// Shared client. Prompts for password, attaches Authorization, retries once on 401.
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
      // Wrong/expired password: clear and prompt again once
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

  window.AI = {
    call,
    setPassword: (p) => sessionStorage.setItem(KEY, p),
    ensurePassword, // exposed so app code can force prompt
  };
})();
 // ===== END OF FILE: public/ai.js =====
