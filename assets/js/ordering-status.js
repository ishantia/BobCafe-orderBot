/* ==========================================================================
   BOBCAFE — online ordering on/off switch (checked from the Worker)
   Menu browsing always works; this only gates "add to cart" / checkout.
   ========================================================================== */
(() => {
  "use strict";

  const API_BASE =
    (window.BOBCAFE_CONFIG && window.BOBCAFE_CONFIG.API_BASE) || "";
  const POLL_INTERVAL_MS = 30000;

  // Optimistic default: assume ordering is on until the first check comes
  // back, so the site doesn't flash a disabled state on every load.
  let enabled = true;
  const listeners = [];

  function notify() {
    listeners.forEach((fn) => {
      try {
        fn(enabled);
      } catch (e) {
        console.error("[Bobcafe] ordering-status listener error:", e);
      }
    });
  }

  async function refresh() {
    try {
      const res = await fetch(`${API_BASE}/api/ordering-status`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      const next = data.enabled !== false;
      if (next !== enabled) {
        enabled = next;
        notify();
      }
    } catch (err) {
      // Network hiccup — keep the last known state rather than guessing.
    }
  }

  function isEnabled() {
    return enabled;
  }

  function subscribe(fn) {
    listeners.push(fn);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }

  refresh();
  setInterval(refresh, POLL_INTERVAL_MS);

  window.OrderingStatus = { isEnabled, subscribe };
})();
