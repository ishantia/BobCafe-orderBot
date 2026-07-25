(() => {
  "use strict";

  /* ------------------------------------------------------------
   * Config & state (module-scoped, no globals leak to window)
   * ---------------------------------------------------------- */
  const CONFIG = {
    dataUrl: "assets/menu.json",
    imageBase: "assets/images/",
    fallbackImage: "assets/images/fallback.svg",
    allChipLabel: "همه",
    searchDebounceMs: 220,

    categoryOrder: [
      "اسپرسو بار",
      "شیرقهوه با نسبت شیر کم",
      "شیرقهوه با نسبت شیر متوسط",
      "شیرقهوه با نسبت شیر زیاد",
      "قهوه های دمی",
      "نوشیدنی های گرم",
      "ماچا بار",
      "تی بار",
      "ایس کافی بار",
      "کلاسیک ماکتیل",
      "ماکتیل",
      "شیک",
      "اسموتی",
      "کیک",
      "غذا",
      "صبحانه",
    ],
  };

  const THEME_STORAGE_KEY = "bobcafe:theme";

  const state = {
    items: [],
    categories: [],
    activeCategory: "all",
    searchTerm: "",
    status: "loading", // loading | ready | error
  };

  /* ------------------------------------------------------------
   * Category icons
   * A single consistent stroke-icon set (same visual language as the
   * rest of the interface — 24x24, currentColor, rounded strokes).
   * Icons are assigned automatically from keywords found in the
   * category name; unknown categories fall back to a default glyph.
   * ---------------------------------------------------------- */
  const CATEGORY_ICON_DEFS = [
    { keywords: ["اسپرسو"], icon: "coffee" },
    { keywords: ["شیرقهوه"], icon: "latte" },
    { keywords: ["دمی"], icon: "pourover" },
    { keywords: ["نوشیدنی های گرم", "گرم"], icon: "hot" },
    { keywords: ["ماچا"], icon: "matcha" },
    { keywords: ["تی بار"], icon: "tea" },
    { keywords: ["ایس کافی", "ایس"], icon: "cold" },
    { keywords: ["ماکتیل"], icon: "mocktail" },
    { keywords: ["شیک"], icon: "shake" },
    { keywords: ["اسموتی"], icon: "smoothie" },
    { keywords: ["کیک"], icon: "cake" },
    { keywords: ["غذا"], icon: "food" },
    { keywords: ["صبحانه"], icon: "breakfast" },
  ];

  const ICON_PATHS = {
    all: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/>',
    coffee: '<path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M17 9.5h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 4.2c-1 1-1 1.6 0 2.6M11.5 4.2c-1 1-1 1.6 0 2.6"/>',
    latte: '<path d="M5 9h11v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"/><path d="M16 10h1.6a2.2 2.2 0 0 1 0 4.4H16"/><path d="M10.5 11.4c-1.3-1.3-3.1.4-1.6 1.9.8.8 1.6 1.5 1.6 1.5s.8-.7 1.6-1.5c1.5-1.5-.3-3.2-1.6-1.9Z"/>',
    pourover: '<path d="M6.5 4h11l-2 6h-7l-2-6Z"/><path d="M9 10v2.6a3 3 0 0 0 3 3h0a3 3 0 0 0 3-3V10"/><path d="M4.5 19.6h15"/><path d="M12 15.6v4"/>',
    hot: '<path d="M4.5 10h11v4a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4v-4Z"/><path d="M15.5 11h1.7a2 2 0 0 1 0 4h-1"/><path d="M2.5 20.5h15"/><path d="M8 5.2c-1 1 .9 1.8 0 2.8M11.5 5.2c-1 1 .9 1.8 0 2.8"/>',
    matcha: '<path d="M5 10a7 7 0 0 0 14 0Z"/><path d="M4.5 10h15"/><path d="M12 3v3.4"/><path d="M9.4 4.4l1 1.8M14.6 4.4l-1 1.8"/>',
    tea: '<path d="M4 14a8 5.2 0 0 0 16 0Z"/><path d="M4 14h16"/><path d="M17 12c3.7-.8 4.1 4.2.4 4.5"/><path d="M7.4 9c-2-2.8 2-2.8 0-6"/><circle cx="12" cy="7.6" r="1"/>',
    cold: '<path d="M7 8h10l-1 11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2L7 8Z"/><path d="M9 8l6-4"/><line x1="8" y1="12.2" x2="16" y2="12.2"/>',
    mocktail: '<path d="M5 4h14l-7 8v6"/><path d="M9 20h6"/><path d="M6.7 4.4 12 9"/><circle cx="15.5" cy="6" r="1"/>',
    shake: '<path d="M8 5h8l-1.2 14a2 2 0 0 1-2 1.8h-1.6a2 2 0 0 1-2-1.8L8 5Z"/><path d="M8 9h8"/><path d="M13 2v4"/><circle cx="13" cy="1.6" r="1"/>',
    smoothie: '<path d="M7.5 8h9l-1.2 11a2 2 0 0 1-2 1.8h-2.6a2 2 0 0 1-2-1.8L7.5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="M9.4 12h5.2"/>',
    cake: '<path d="M4 20 12 6l8 14Z"/><path d="M7.2 14h9.6"/><circle cx="12" cy="4" r="1.3"/>',
    default: '<path d="M6 3v6.5a2 2 0 0 0 4 0V3"/><path d="M8 9.5V21"/><path d="M17 3c-1.7 0-3 2-3 5.5S15.3 14 17 14"/><path d="M17 3v18"/>',
  };

  /** Resolve a category name to one of the icon keys above. */
  function resolveCategoryIcon(categoryName) {
    const normalized = normalize(categoryName);
    for (const def of CATEGORY_ICON_DEFS) {
      if (def.keywords.some((kw) => normalized.includes(normalize(kw)))) {
        return def.icon;
      }
    }
    return "default";
  }

  /** Build an inline <svg> markup string for a given icon key. */
  function iconSvg(key) {
    const path = ICON_PATHS[key] || ICON_PATHS.default;
    return `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  }

  /* ------------------------------------------------------------
   * DOM references
   * ---------------------------------------------------------- */
  const dom = {
    skeletonGrid: document.getElementById("skeletonGrid"),
    menuGrid: document.getElementById("menuGrid"),
    errorState: document.getElementById("errorState"),
    errorMessage: document.getElementById("errorMessage"),
    emptyState: document.getElementById("emptyState"),
    retryButton: document.getElementById("retryButton"),
    resetFilters: document.getElementById("resetFilters"),
    resultCount: document.getElementById("resultCount"),
    categoryChips: document.getElementById("categoryChips"),
    searchInput: document.getElementById("searchInput"),
    searchClear: document.getElementById("searchClear"),
    controls: document.getElementById("controls"),
    themeToggle: document.getElementById("themeToggle"),
    backToTop: document.getElementById("backToTop"),
    footerYear: document.getElementById("footerYear"),
  };

  /* ------------------------------------------------------------
   * Utilities
   * ---------------------------------------------------------- */

  const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

  /** Convert a number's digits to Persian numerals with thousands separators. */
  function toPersianPrice(value) {
    const rounded = Math.round(Number(value) || 0);
    const withSeparators = rounded.toLocaleString("en-US"); // "145,000"
    const persianized = withSeparators.replace(/[0-9]/g, (d) => PERSIAN_DIGITS[d]).replace(/,/g, "٬");
    return `${persianized} تومان`;
  }

  /** Escape a string for safe HTML insertion. */
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  /** Wrap the matched search term in <mark> for highlighting. */
  function highlight(text, term) {
    const safe = escapeHtml(text ?? "");
    if (!term) return safe;
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${escapedTerm})`, "ig");
    return safe.replace(re, "<mark>$1</mark>");
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  /** Basic Persian-friendly normalization so ي/ی and ك/ک both match. */
  function normalize(str) {
    return (str ?? "")
      .toString()
      .toLowerCase()
      .replace(/ي/g, "ی")
      .replace(/ك/g, "ک")
      .trim();
  }

  /* ------------------------------------------------------------
   * Data loading
   * ---------------------------------------------------------- */

  // Guards against a race condition where an older, slower request
  // (e.g. from a previous "retry" click) resolves after a newer one and
  // overwrites its result — only the most recent call is allowed to
  // update the UI.
  let requestToken = 0;

  async function loadMenu() {
    const thisRequest = ++requestToken;
    setStatus("loading");

    let items;
    try {
      // --- Fetch + parse: the only phase that may produce the error state ---
      const res = await fetch(CONFIG.dataUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      if (!Array.isArray(raw)) throw new Error("فرمت داده نامعتبر است");
      if (raw.length === 0) throw new Error("EMPTY");

      items = raw
        .filter((item) => item && typeof item === "object")
        .map(normalizeItem)
        .filter(Boolean);

      if (items.length === 0) throw new Error("EMPTY");
    } catch (err) {
      if (thisRequest !== requestToken) return; // a newer request has since started
      console.error("[Bobcafe] Failed to load menu:", err);
      setStatus("error", err && err.message === "EMPTY"
        ? "در حال حاضر موردی در منو ثبت نشده است."
        : "مشکلی در بارگذاری منو پیش آمد. لطفاً اتصال اینترنت را بررسی کرده و دوباره تلاش کنید.");
      return;
    }

    if (thisRequest !== requestToken) return; // a newer request has since started

    // --- Data loaded successfully: the load is done, full stop. ---
    // Anything below is presentation only. A problem here must never
    // be able to flip a genuinely successful load back to the error
    // state — that mismatch (data loaded, error banner shown) was the
    // exact bug being fixed, so rendering failures are handled on
    // their own instead of falling into the fetch/parse catch above.
    state.items = items;
    state.categories = buildCategoryList(state.items);
    setStatus("ready");

    try {
      renderChips();
      renderGrid();
    } catch (renderErr) {
      console.error("[Bobcafe] Menu loaded but failed to render:", renderErr);
    }
  }

  /** Fill in graceful defaults for any missing/malformed fields. */
  function normalizeItem(item) {
    const name = typeof item.name === "string" && item.name.trim() ? item.name.trim() : "بدون نام";
    const description = typeof item.description === "string" ? item.description.trim() : "";
    const category = typeof item.category === "string" && item.category.trim() ? item.category.trim() : "متفرقه";
    const price = Number.isFinite(Number(item.price)) ? Number(item.price) : null;
    const image = typeof item.image === "string" && item.image.trim() ? item.image.trim() : "";

    return { name, description, category, price, image };
  }

  /** Sort category names by their position in CONFIG.categoryOrder.
   *  Unknown categories keep their relative (first-seen) order and are
   *  placed after every known category. */
  function sortByCategoryOrder(names) {
    const rank = (name) => {
      const idx = CONFIG.categoryOrder.indexOf(name);
      return idx === -1 ? CONFIG.categoryOrder.length + names.indexOf(name) : idx;
    };
    return [...names].sort((a, b) => rank(a) - rank(b));
  }

  function buildCategoryList(items) {
    const counts = new Map();
    for (const item of items) {
      counts.set(item.category, (counts.get(item.category) || 0) + 1);
    }
    const orderedNames = sortByCategoryOrder([...counts.keys()]);
    return orderedNames.map((name) => ({ name, count: counts.get(name) }));
  }

  function setStatus(status, message) {
    state.status = status;
    dom.skeletonGrid.hidden = status !== "loading";
    dom.skeletonGrid.style.display = status === "loading" ? "" : "none";
    dom.errorState.hidden = status !== "error";
    dom.menuGrid.hidden = status !== "ready";
    if (status === "error") {
      dom.errorMessage.textContent = message || dom.errorMessage.textContent;
    }
  }

  /* ------------------------------------------------------------
   * Rendering: skeleton
   * ---------------------------------------------------------- */

  function renderSkeleton(count = 8) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const card = document.createElement("div");
      card.className = "skel-card";
      card.innerHTML = `
        <div class="skel-media"></div>
        <div class="skel-body">
          <div class="skel-line w60"></div>
          <div class="skel-line w90"></div>
          <div class="skel-line w40"></div>
        </div>`;
      frag.appendChild(card);
    }
    dom.skeletonGrid.appendChild(frag);
  }

  /* ------------------------------------------------------------
   * Rendering: category chips
   * ---------------------------------------------------------- */

  function renderChips() {
    const frag = document.createDocumentFragment();

    const allChip = createChip(CONFIG.allChipLabel, "all", state.items.length);
    frag.appendChild(allChip);

    for (const cat of state.categories) {
      frag.appendChild(createChip(cat.name, cat.name, cat.count));
    }

    dom.categoryChips.innerHTML = "";
    dom.categoryChips.appendChild(frag);
  }

  function createChip(label, value, count) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.setAttribute("role", "tab");
    chip.dataset.value = value;
    chip.setAttribute("aria-selected", String(value === state.activeCategory));
    const iconKey = value === "all" ? "all" : resolveCategoryIcon(label);
    chip.innerHTML = `<span class="chip__icon">${iconSvg(iconKey)}</span><span>${escapeHtml(label)}</span><span class="chip__count">${toPersianDigitsOnly(count)}</span>`;
    return chip;
  }

  function toPersianDigitsOnly(n) {
    return String(n).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[d]);
  }

  /* ------------------------------------------------------------
   * Rendering: menu grid (with search + category filtering)
   * ---------------------------------------------------------- */

  function getFilteredItems() {
    const term = normalize(state.searchTerm);
    return state.items.filter((item) => {
      const matchesCategory = state.activeCategory === "all" || item.category === state.activeCategory;
      if (!matchesCategory) return false;
      if (!term) return true;
      const haystack = normalize(`${item.name} ${item.description} ${item.category}`);
      return haystack.includes(term);
    });
  }

  function renderGrid() {
    const filtered = getFilteredItems();
    dom.menuGrid.innerHTML = "";

    if (filtered.length === 0) {
      dom.emptyState.hidden = false;
      dom.menuGrid.hidden = true;
      dom.resultCount.textContent = "";
      return;
    }
    dom.emptyState.hidden = true;
    dom.menuGrid.hidden = false;

    const term = state.searchTerm.trim();
    const frag = document.createDocumentFragment();

    if (state.activeCategory === "all" && !term) {
      // Grouped view by category, preserving first-seen order
      const grouped = groupByCategory(filtered);
      let cardIndex = 0;
      for (const [categoryName, items] of grouped) {
        const heading = document.createElement("div");
        heading.className = "category-heading";
        heading.innerHTML = `
          <h2 class="category-heading__title">${escapeHtml(categoryName)}</h2>
          <span class="category-heading__count">${toPersianDigitsOnly(items.length)} مورد</span>`;
        frag.appendChild(heading);
        for (const item of items) {
          frag.appendChild(createCard(item, term, cardIndex++));
        }
      }
    } else {
      filtered.forEach((item, i) => frag.appendChild(createCard(item, term, i)));
    }

    dom.menuGrid.appendChild(frag);
    dom.resultCount.textContent = `${toPersianDigitsOnly(filtered.length)} مورد نمایش داده شد`;
  }

  function groupByCategory(items) {
    const map = new Map();
    for (const item of items) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category).push(item);
    }
    const orderedNames = sortByCategoryOrder([...map.keys()]);
    return orderedNames.map((name) => [name, map.get(name)]);
  }

  function createCard(item, searchTerm, index) {
    const card = document.createElement("article");
    card.className = "card";
    card.style.setProperty("--i", String(index % 12));

    const imgSrc = item.image ? `${CONFIG.imageBase}${item.image}` : CONFIG.fallbackImage;
    const priceMarkup = item.price !== null
      ? `<span class="card__price">${toPersianPrice(item.price)}</span>`
      : `<span class="card__price"><small>قیمت نامشخص</small></span>`;

    // Stable cart key derived from the item's own data (name+category),
    // independent of list position so it survives search/filter re-renders.
    const cartKey = window.Cart ? window.Cart.keyFor(item.name, item.category) : "";
    const canAddToCart = item.price !== null;

    card.innerHTML = `
      <div class="card__media">
        <img
          src="${escapeHtml(imgSrc)}"
          alt="${escapeHtml(item.name)}"
          loading="lazy"
          decoding="async"
          width="236" height="236">
        <span class="card__badge">${escapeHtml(item.category)}</span>
      </div>
      <div class="card__body">
        <h3 class="card__name">${highlight(item.name, searchTerm)}</h3>
        ${item.description ? `<p class="card__desc">${highlight(item.description, searchTerm)}</p>` : ""}
        <div class="card__footer">
          ${priceMarkup}
          <div class="card__qty" data-key="${escapeHtml(cartKey)}"></div>
        </div>
      </div>`;

    // Graceful image fallback if the file is missing or fails to load
    const img = card.querySelector("img");
    img.addEventListener("error", () => {
      if (img.src.indexOf(CONFIG.fallbackImage) === -1) {
        img.src = CONFIG.fallbackImage;
      }
    }, { once: true });

    if (canAddToCart && window.Cart) {
      const qtyHost = card.querySelector(".card__qty");
      renderQtyControl(qtyHost, cartKey, item);
      window.Cart.subscribe(() => renderQtyControl(qtyHost, cartKey, item));
    }

    return card;
  }

  /** Render either a round "+" add button, or a −/count/+ stepper,
   *  inside the given host element — matching the existing .card__mark
   *  pill styling so no new visual language is introduced. */
  function renderQtyControl(host, cartKey, item) {
    if (!host || !host.isConnected) return;
    const qty = window.Cart.getQty(cartKey);

    if (qty <= 0) {
      host.innerHTML = `
        <button type="button" class="card__mark card__mark--add" aria-label="افزودن ${escapeHtml(item.name)} به سبد">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>`;
      host.querySelector("button").addEventListener("click", () => {
        window.Cart.add(cartKey, item.name, item.price);
      });
      return;
    }

    host.innerHTML = `
      <div class="qty-stepper" role="group" aria-label="تعداد ${escapeHtml(item.name)}">
        <button type="button" class="qty-stepper__btn" data-action="dec" aria-label="کم کردن">−</button>
        <span class="qty-stepper__count">${toPersianDigitsOnly(qty)}</span>
        <button type="button" class="qty-stepper__btn" data-action="inc" aria-label="زیاد کردن">+</button>
      </div>`;
    host.querySelector('[data-action="dec"]').addEventListener("click", () => window.Cart.decrease(cartKey));
    host.querySelector('[data-action="inc"]').addEventListener("click", () => window.Cart.add(cartKey, item.name, item.price));
  }

  /* ------------------------------------------------------------
   * Event wiring
   * ---------------------------------------------------------- */

  function initSearch() {
    const handleInput = debounce((value) => {
      state.searchTerm = value;
      dom.searchClear.hidden = value.length === 0;
      renderGrid();
    }, CONFIG.searchDebounceMs);

    dom.searchInput.addEventListener("input", (e) => handleInput(e.target.value));

    dom.searchClear.addEventListener("click", () => {
      dom.searchInput.value = "";
      state.searchTerm = "";
      dom.searchClear.hidden = true;
      dom.searchInput.focus();
      renderGrid();
    });
  }

  function initChips() {
    // Event delegation — one listener handles all current and future chips
    dom.categoryChips.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      state.activeCategory = chip.dataset.value;
      [...dom.categoryChips.children].forEach((c) => {
        c.setAttribute("aria-selected", String(c === chip));
      });
      renderGrid();
    });
  }

  function initStates() {
    dom.retryButton.addEventListener("click", loadMenu);
    dom.resetFilters.addEventListener("click", () => {
      state.searchTerm = "";
      state.activeCategory = "all";
      dom.searchInput.value = "";
      dom.searchClear.hidden = true;
      [...dom.categoryChips.children].forEach((c) => {
        c.setAttribute("aria-selected", String(c.dataset.value === "all"));
      });
      renderGrid();
    });
  }

  function initStickyShadow() {
    const sentinel = document.getElementById("top");
    if (!("IntersectionObserver" in window) || !sentinel) return;
    const io = new IntersectionObserver(
      ([entry]) => dom.controls.classList.toggle("is-stuck", !entry.isIntersecting),
      { threshold: 0, rootMargin: "-1px 0px 0px 0px" }
    );
    io.observe(sentinel);
  }

  function initBackToTop() {
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        dom.backToTop.hidden = false;
        dom.backToTop.classList.toggle("is-visible", window.scrollY > 640);
        ticking = false;
      });
    }, { passive: true });

    dom.backToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function initTheme() {
    // The inline boot script in <head> already applied the correct
    // theme before first paint (saved preference, or Light Mode by
    // default). This just keeps the toggle button in sync and saves
    // any manual change so it persists across future visits.
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    dom.themeToggle.setAttribute("aria-pressed", String(isDark));

    dom.themeToggle.addEventListener("click", () => {
      const currentlyDark = document.documentElement.getAttribute("data-theme") === "dark";
      const next = currentlyDark ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      dom.themeToggle.setAttribute("aria-pressed", String(next === "dark"));
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch (e) {
        // Storage unavailable (private browsing, quota, etc.) — the
        // toggle still works for the current session, it just won't persist.
      }
    });
  }

  function initFooterYear() {
    dom.footerYear.textContent = toPersianDigitsOnly(new Date().getFullYear());
  }

  /* ------------------------------------------------------------
   * Boot
   * ---------------------------------------------------------- */

  function init() {
    renderSkeleton();
    initSearch();
    initChips();
    initStates();
    initStickyShadow();
    initBackToTop();
    initTheme();
    initFooterYear();
    loadMenu();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();