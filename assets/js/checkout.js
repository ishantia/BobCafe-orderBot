/* ==========================================================================
   BOBCAFE — Checkout modal, order submission & live status tracking
   ========================================================================== */
(() => {
  "use strict";

  const API_BASE = (window.BOBCAFE_CONFIG && window.BOBCAFE_CONFIG.API_BASE) || "";
  const LAST_ORDER_KEY = "bobcafe:lastOrder";
  const POLL_INTERVAL_MS = 10000;
  const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

  const STATUS_LABELS = {
    pending: "🟡 در انتظار تایید",
    accepted: "🟠 پذیرفته شد",
    preparing: "👨‍🍳 در حال آماده‌سازی",
    ready: "☕ آماده است",
    cancelled: "❌ لغو شد",
  };

  function toPersianDigitsOnly(n) {
    return String(n).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[d]);
  }
  function toPersianPrice(value) {
    const rounded = Math.round(Number(value) || 0);
    const withSeparators = rounded.toLocaleString("en-US");
    const persianized = withSeparators.replace(/[0-9]/g, (d) => PERSIAN_DIGITS[d]).replace(/,/g, "٬");
    return `${persianized} تومان`;
  }
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  let pollTimer = null;
  let currentCartState = null;

  /* ------------------------------------------------------------
   * Modal markup
   * ---------------------------------------------------------- */
  function buildMarkup() {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="modal-overlay" id="checkoutOverlay" hidden>
        <section class="sheet sheet--form" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle">
          <header class="sheet__header">
            <h2 class="sheet__title" id="checkoutTitle">ثبت سفارش</h2>
            <button class="sheet__close" id="checkoutClose" type="button" aria-label="بستن">&times;</button>
          </header>

          <div class="sheet__body" id="checkoutBody">
            <form id="checkoutForm" novalidate>
              <div class="field">
                <label class="field__label" for="customerName">نام مشتری <span aria-hidden="true">*</span></label>
                <input class="field__input" type="text" id="customerName" name="customerName" maxlength="60" required autocomplete="off">
                <p class="field__error" id="customerNameError" hidden></p>
              </div>
              <div class="field">
                <label class="field__label" for="tableNumber">شماره میز <span aria-hidden="true">*</span></label>
                <input class="field__input" type="text" inputmode="numeric" id="tableNumber" name="tableNumber" maxlength="10" required autocomplete="off">
                <p class="field__error" id="tableNumberError" hidden></p>
              </div>
              <div class="field">
                <label class="field__label" for="orderNotes">یادداشت <span class="field__optional">(اختیاری)</span></label>
                <textarea class="field__input field__textarea" id="orderNotes" name="orderNotes" maxlength="300" rows="3" placeholder="مثلاً: شکر کم، بدون خامه…"></textarea>
              </div>

              <div class="checkout-summary" id="checkoutSummary"></div>

              <p class="field__error" id="checkoutFormError" hidden></p>

              <button class="btn btn--primary sheet__submit" id="checkoutSubmit" type="submit">
                <span id="checkoutSubmitLabel">ثبت نهایی سفارش</span>
              </button>
            </form>
          </div>
        </section>
      </div>

      <div class="modal-overlay" id="confirmOverlay" hidden>
        <section class="sheet sheet--confirm" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
          <header class="sheet__header">
            <h2 class="sheet__title" id="confirmTitle">سفارش ثبت شد</h2>
            <button class="sheet__close" id="confirmClose" type="button" aria-label="بستن">&times;</button>
          </header>
          <div class="sheet__body confirm-body">
            <div class="confirm-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="40" height="40"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <p class="confirm-order-number" id="confirmOrderNumber"></p>
            <p class="confirm-status" id="confirmStatus"></p>
            <p class="confirm-hint">سفارش شما به آشپزخانه ارسال شد. وضعیت آن به‌صورت خودکار به‌روزرسانی می‌شود.</p>
          </div>
        </section>
      </div>

      <div class="order-status-bar" id="orderStatusBar" hidden>
        <div class="order-status-bar__main">
          <span class="order-status-bar__number" id="statusBarNumber"></span>
          <span class="order-status-bar__label" id="statusBarLabel"></span>
        </div>
        <p class="order-status-bar__reason" id="statusBarReason" hidden></p>
      </div>

      <div class="ready-overlay" id="readyOverlay" hidden role="alertdialog" aria-live="assertive" aria-labelledby="readyOverlayTitle">
        <div class="ready-overlay__card">
          <div class="ready-overlay__icon" aria-hidden="true">☕</div>
          <h2 class="ready-overlay__title" id="readyOverlayTitle">سفارش شما آماده است!</h2>
          <p class="ready-overlay__order" id="readyOverlayOrder"></p>
          <p class="ready-overlay__hint">لطفاً برای دریافت سفارش به کانتر مراجعه کنید.</p>
          <button class="btn btn--primary ready-overlay__dismiss" id="readyOverlayDismiss" type="button">متوجه شدم</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
  }

  /* ------------------------------------------------------------
   * Checkout modal open/close + summary render
   * ---------------------------------------------------------- */
  function renderSummary(cartState) {
    const el = document.getElementById("checkoutSummary");
    el.innerHTML = `
      <h3 class="checkout-summary__title">خلاصه سفارش</h3>
      <ul class="checkout-summary__list">
        ${cartState.items.map((i) => `
          <li>
            <span>${toPersianDigitsOnly(i.qty)} × ${escapeHtml(i.name)}</span>
            <span>${toPersianPrice(i.subtotal)}</span>
          </li>`).join("")}
      </ul>
      <div class="checkout-summary__total">
        <span>جمع کل</span>
        <strong>${toPersianPrice(cartState.total)}</strong>
      </div>`;
  }

  function openCheckout(cartState) {
    if (!cartState || cartState.items.length === 0) return;
    currentCartState = cartState;
    renderSummary(cartState);
    document.getElementById("checkoutFormError").hidden = true;
    if (window.Cart) window.Cart.closeDrawer();
    document.getElementById("checkoutOverlay").hidden = false;
    document.body.classList.add("no-scroll");
    document.getElementById("customerName").focus();
  }

  function closeCheckout() {
    document.getElementById("checkoutOverlay").hidden = true;
    document.body.classList.remove("no-scroll");
  }

  function closeConfirm() {
    document.getElementById("confirmOverlay").hidden = true;
    document.body.classList.remove("no-scroll");
  }

  /* ------------------------------------------------------------
   * Validation
   * ---------------------------------------------------------- */
  function validateForm() {
    let valid = true;
    const name = document.getElementById("customerName").value.trim();
    const table = document.getElementById("tableNumber").value.trim();

    const nameErr = document.getElementById("customerNameError");
    const tableErr = document.getElementById("tableNumberError");

    if (!name) {
      nameErr.textContent = "لطفاً نام خود را وارد کنید.";
      nameErr.hidden = false;
      valid = false;
    } else {
      nameErr.hidden = true;
    }

    if (!table) {
      tableErr.textContent = "لطفاً شماره میز را وارد کنید.";
      tableErr.hidden = false;
      valid = false;
    } else {
      tableErr.hidden = true;
    }

    return valid;
  }

  /* ------------------------------------------------------------
   * Submit order
   * ---------------------------------------------------------- */
  async function submitOrder(e) {
    e.preventDefault();
    if (!validateForm() || !currentCartState) return;

    const submitBtn = document.getElementById("checkoutSubmit");
    const submitLabel = document.getElementById("checkoutSubmitLabel");
    const formError = document.getElementById("checkoutFormError");
    formError.hidden = true;

    const payload = {
      customerName: document.getElementById("customerName").value.trim(),
      tableNumber: document.getElementById("tableNumber").value.trim(),
      notes: document.getElementById("orderNotes").value.trim(),
      items: currentCartState.items.map((i) => ({
        name: i.name,
        quantity: i.qty,
        unitPrice: i.price,
      })),
    };

    submitBtn.disabled = true;
    submitLabel.textContent = "در حال ارسال…";

    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || !data.orderNumber) {
        throw new Error((data && data.error) || `HTTP ${res.status}`);
      }

      window.Cart.clear();
      closeCheckout();
      showConfirmation(data.orderNumber, data.status || "pending");
      saveLastOrder(data.orderNumber);
      startPolling(data.orderNumber);
      document.getElementById("checkoutForm").reset();
    } catch (err) {
      console.error("[Bobcafe] Order submission failed:", err);
      formError.textContent = "ثبت سفارش با مشکل مواجه شد. لطفاً دوباره تلاش کنید یا سفارش را به میزبان اطلاع دهید.";
      formError.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitLabel.textContent = "ثبت نهایی سفارش";
    }
  }

  function showConfirmation(orderNumber, status) {
    document.getElementById("confirmOrderNumber").textContent = `سفارش #${toPersianDigitsOnly(orderNumber)}`;
    document.getElementById("confirmStatus").textContent = STATUS_LABELS[status] || STATUS_LABELS.pending;
    document.getElementById("confirmOverlay").hidden = false;
    document.body.classList.add("no-scroll");
  }

  /* ------------------------------------------------------------
   * Live status polling + persistent status bar
   * ---------------------------------------------------------- */
  function saveLastOrder(orderNumber) {
    try {
      localStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ orderNumber, savedAt: Date.now() }));
    } catch (e) { /* ignore */ }
  }

  function loadLastOrder() {
    try {
      const raw = JSON.parse(localStorage.getItem(LAST_ORDER_KEY));
      if (!raw || !raw.orderNumber) return null;
      // Stop tracking orders older than 6 hours to avoid stale badges.
      if (Date.now() - raw.savedAt > 6 * 60 * 60 * 1000) return null;
      return raw.orderNumber;
    } catch (e) {
      return null;
    }
  }

  function clearLastOrder() {
    try { localStorage.removeItem(LAST_ORDER_KEY); } catch (e) { /* ignore */ }
  }

  const READY_SHOWN_KEY_PREFIX = "bobcafe:readyShown:";

  function hasShownReadyAlert(orderNumber) {
    try {
      return localStorage.getItem(READY_SHOWN_KEY_PREFIX + orderNumber) === "1";
    } catch (e) {
      return false;
    }
  }
  function markReadyAlertShown(orderNumber) {
    try {
      localStorage.setItem(READY_SHOWN_KEY_PREFIX + orderNumber, "1");
    } catch (e) { /* ignore */ }
  }

  function showReadyCelebration(orderNumber) {
    document.getElementById("readyOverlayOrder").textContent = `سفارش #${toPersianDigitsOnly(orderNumber)}`;
    const overlay = document.getElementById("readyOverlay");
    overlay.hidden = false;
    document.body.classList.add("no-scroll");
    // Best-effort attention nudge — silently ignored where unsupported.
    try { navigator.vibrate?.([160, 80, 160]); } catch (e) { /* ignore */ }
  }

  function closeReadyCelebration() {
    document.getElementById("readyOverlay").hidden = true;
    document.body.classList.remove("no-scroll");
  }

  function updateStatusBar(orderNumber, status, cancelReason) {
    const bar = document.getElementById("orderStatusBar");
    const reasonEl = document.getElementById("statusBarReason");
    document.getElementById("statusBarNumber").textContent = `#${toPersianDigitsOnly(orderNumber)}`;
    document.getElementById("statusBarLabel").textContent = STATUS_LABELS[status] || STATUS_LABELS.pending;
    bar.hidden = false;
    bar.classList.toggle("is-done", status === "ready" || status === "cancelled");
    document.body.classList.add("has-status-bar");

    if (status === "cancelled" && cancelReason) {
      reasonEl.textContent = `دلیل: ${cancelReason}`;
      reasonEl.hidden = false;
    } else {
      reasonEl.hidden = true;
    }
  }

  function hideStatusBar() {
    const bar = document.getElementById("orderStatusBar");
    bar.hidden = true;
    document.body.classList.remove("has-status-bar");
  }

  async function pollOnce(orderNumber) {
    try {
      const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderNumber)}`, { cache: "no-store" });
      if (res.status === 404) {
        stopPolling();
        clearLastOrder();
        hideStatusBar();
        return;
      }
      if (!res.ok) return; // transient network/server error — try again next tick
      const data = await res.json();
      updateStatusBar(orderNumber, data.status, data.cancelReason);

      if (data.status === "ready" && !hasShownReadyAlert(orderNumber)) {
        showReadyCelebration(orderNumber);
        markReadyAlertShown(orderNumber);
      }

      if (data.status === "ready" || data.status === "cancelled") {
        stopPolling();
      }
    } catch (err) {
      console.error("[Bobcafe] Status poll failed:", err);
    }
  }

  function startPolling(orderNumber) {
    stopPolling();
    pollOnce(orderNumber);
    pollTimer = setInterval(() => pollOnce(orderNumber), POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function resumeTrackingIfNeeded() {
    const orderNumber = loadLastOrder();
    if (orderNumber) startPolling(orderNumber);
  }

  /* ------------------------------------------------------------
   * Wiring
   * ---------------------------------------------------------- */
  function initEvents() {
    document.getElementById("checkoutClose").addEventListener("click", closeCheckout);
    document.getElementById("checkoutOverlay").addEventListener("click", (e) => {
      if (e.target.id === "checkoutOverlay") closeCheckout();
    });
    document.getElementById("checkoutForm").addEventListener("submit", submitOrder);

    document.getElementById("confirmClose").addEventListener("click", closeConfirm);
    document.getElementById("confirmOverlay").addEventListener("click", (e) => {
      if (e.target.id === "confirmOverlay") closeConfirm();
    });

    document.getElementById("readyOverlayDismiss").addEventListener("click", closeReadyCelebration);
    document.getElementById("readyOverlay").addEventListener("click", (e) => {
      if (e.target.id === "readyOverlay") closeReadyCelebration();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!document.getElementById("checkoutOverlay").hidden) closeCheckout();
      if (!document.getElementById("confirmOverlay").hidden) closeConfirm();
      if (!document.getElementById("readyOverlay").hidden) closeReadyCelebration();
    });
  }

  function init() {
    buildMarkup();
    initEvents();
    resumeTrackingIfNeeded();
  }

  window.Checkout = { open: openCheckout };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
