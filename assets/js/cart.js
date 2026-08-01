/* ==========================================================================
   BOBCAFE — Shopping cart (state + drawer UI)
   Cart state lives in localStorage so it survives a refresh while the
   customer keeps browsing the menu at the table.
   ========================================================================== */
(() => {
  "use strict";

  const STORAGE_KEY = "bobcafe:cart";
  const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

  function toPersianDigitsOnly(n) {
    return String(n).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[d]);
  }
  function toPersianPrice(value) {
    const rounded = Math.round(Number(value) || 0);
    const withSeparators = rounded.toLocaleString("en-US");
    const persianized = withSeparators
      .replace(/[0-9]/g, (d) => PERSIAN_DIGITS[d])
      .replace(/,/g, "٬");
    return `${persianized} تومان`;
  }
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  /* ------------------------------------------------------------
   * Cart state (module-private, exposed via window.Cart API)
   * ---------------------------------------------------------- */
  let items = {}; // key -> { name, category, price, qty }
  const listeners = [];

  function loadFromStorage() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      items = raw && typeof raw === "object" ? raw : {};
    } catch (e) {
      items = {};
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      // Storage unavailable — cart still works for this page view.
    }
  }

  function notify() {
    persist();
    listeners.forEach((fn) => {
      try {
        fn(getState());
      } catch (e) {
        console.error("[Bobcafe] cart listener error:", e);
      }
    });
  }

  function keyFor(name, category) {
    return `${category || ""}__${name || ""}`.trim();
  }

  function getState() {
    const list = Object.entries(items).map(([key, v]) => ({
      key,
      name: v.name,
      category: v.category,
      price: v.price,
      qty: v.qty,
      subtotal: Math.round(v.price * v.qty),
    }));
    const total = list.reduce((sum, i) => sum + i.subtotal, 0);
    const count = list.reduce((sum, i) => sum + i.qty, 0);
    return { items: list, total, count };
  }

  function add(key, name, price, category) {
    if (!key || price === null || price === undefined) return;
    if (!items[key])
      items[key] = { name, category: category || "", price, qty: 0 };
    items[key].qty += 1;
    notify();
  }

  function increase(key) {
    if (!items[key]) return;
    items[key].qty += 1;
    notify();
  }

  function decrease(key) {
    if (!items[key]) return;
    items[key].qty -= 1;
    if (items[key].qty <= 0) delete items[key];
    notify();
  }

  function removeItem(key) {
    delete items[key];
    notify();
  }

  function clear() {
    items = {};
    notify();
  }

  function getQty(key) {
    return items[key] ? items[key].qty : 0;
  }

  function subscribe(fn) {
    listeners.push(fn);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }

  loadFromStorage();

  window.Cart = {
    add,
    increase,
    decrease,
    remove: removeItem,
    clear,
    getQty,
    getState,
    subscribe,
    keyFor,
  };

  /* ------------------------------------------------------------
   * Cart drawer UI — built once DOM is ready
   * ---------------------------------------------------------- */
  function buildDrawerMarkup() {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <button class="fab fab--cart" id="cartFab" type="button" aria-label="مشاهده سبد سفارش" hidden>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 4h2l2.4 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="20.5" r="1.4"/><circle cx="17" cy="20.5" r="1.4"/></svg>
        <span class="fab__badge" id="cartFabCount">۰</span>
      </button>

      <div class="modal-overlay" id="cartOverlay" hidden>
        <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="cartTitle">
          <header class="sheet__header">
            <h2 class="sheet__title" id="cartTitle">سبد سفارش</h2>
            <button class="sheet__close" id="cartClose" type="button" aria-label="بستن سبد">&times;</button>
          </header>
          <div class="sheet__body" id="cartBody"></div>
          <p class="cart-ordering-notice" id="cartOrderingNotice" hidden>
            سفارش آنلاین موقتاً غیرفعال است. سبد شما نگه داشته می‌شود تا وقتی دوباره فعال شود.
          </p>
          <footer class="sheet__footer" id="cartFooter" hidden>
            <div class="sheet__total">
              <span>جمع کل</span>
              <strong id="cartTotal">۰ تومان</strong>
            </div>
            <button class="btn btn--primary sheet__submit" id="cartSubmit" type="button">ثبت سفارش</button>
          </footer>
        </section>
      </div>`;
    document.body.appendChild(wrap);
  }

  function renderCartBody() {
    const state = getState();
    const body = document.getElementById("cartBody");
    const footer = document.getElementById("cartFooter");
    const fab = document.getElementById("cartFab");
    const fabCount = document.getElementById("cartFabCount");
    const total = document.getElementById("cartTotal");
    const orderingNotice = document.getElementById("cartOrderingNotice");
    const submitBtn = document.getElementById("cartSubmit");
    const orderingEnabled =
      !window.OrderingStatus || window.OrderingStatus.isEnabled();

    fab.hidden = state.count === 0;
    fabCount.textContent = toPersianDigitsOnly(state.count);

    orderingNotice.hidden = orderingEnabled;
    submitBtn.disabled = !orderingEnabled;
    submitBtn.textContent = orderingEnabled
      ? "ثبت سفارش"
      : "سفارش آنلاین غیرفعال است";

    if (state.items.length === 0) {
      footer.hidden = true;
      body.innerHTML = `
        <div class="cart-empty">
          <p>سبد سفارش شما خالی است</p>
        </div>`;
      return;
    }

    footer.hidden = false;
    total.textContent = toPersianPrice(state.total);

    body.innerHTML = state.items
      .map(
        (item) => `
      <div class="cart-item" data-key="${escapeHtml(item.key)}">
        <div class="cart-item__info">
          <span class="cart-item__name">${escapeHtml(item.name)}</span>
          <span class="cart-item__price">${toPersianPrice(item.price)}</span>
        </div>
        <div class="cart-item__controls">
          <div class="qty-stepper" role="group" aria-label="تعداد ${escapeHtml(item.name)}">
            <button type="button" class="qty-stepper__btn" data-action="dec" aria-label="کم کردن" ${orderingEnabled ? "" : "disabled"}>−</button>
            <span class="qty-stepper__count">${toPersianDigitsOnly(item.qty)}</span>
            <button type="button" class="qty-stepper__btn" data-action="inc" aria-label="زیاد کردن" ${orderingEnabled ? "" : "disabled"}>+</button>
          </div>
          <span class="cart-item__subtotal">${toPersianPrice(item.subtotal)}</span>
          <button type="button" class="cart-item__remove" data-action="remove" aria-label="حذف ${escapeHtml(item.name)}">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>`,
      )
      .join("");
  }

  function openCart() {
    document.getElementById("cartOverlay").hidden = false;
    document.body.classList.add("no-scroll");
  }
  function closeCart() {
    document.getElementById("cartOverlay").hidden = true;
    document.body.classList.remove("no-scroll");
  }

  function initDrawerEvents() {
    document.getElementById("cartFab").addEventListener("click", openCart);
    document.getElementById("cartClose").addEventListener("click", closeCart);
    document.getElementById("cartOverlay").addEventListener("click", (e) => {
      if (e.target.id === "cartOverlay") closeCart();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !document.getElementById("cartOverlay").hidden)
        closeCart();
    });

    document.getElementById("cartBody").addEventListener("click", (e) => {
      const itemEl = e.target.closest(".cart-item");
      if (!itemEl) return;
      const key = itemEl.dataset.key;
      const action = e.target.closest("[data-action]")?.dataset.action;
      if (action === "inc") increase(key);
      else if (action === "dec") decrease(key);
      else if (action === "remove") removeItem(key);
    });

    document.getElementById("cartSubmit").addEventListener("click", () => {
      if (window.Checkout) window.Checkout.open(getState());
    });
  }

  function init() {
    buildDrawerMarkup();
    renderCartBody();
    subscribe(renderCartBody);
    if (window.OrderingStatus) window.OrderingStatus.subscribe(renderCartBody);
    initDrawerEvents();
  }

  window.Cart.openDrawer = openCart;
  window.Cart.closeDrawer = closeCart;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
