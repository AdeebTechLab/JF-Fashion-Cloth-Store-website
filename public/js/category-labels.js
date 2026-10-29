// Rebuilds each page's category filter tabs (".filter-tope-group") from the
// live, admin-editable category list at /api/categories, instead of just
// relabeling a fixed set of buttons. Categories can now be renamed, added,
// or deleted from the admin panel, so the storefront's filter tabs need to
// reflect whatever the current set is — not a hardcoded summer-wear/
// winter-wear/ethnic-wear/casual-wear/party-wear list baked into each
// page's HTML.
(function () {
  // A single flaky/slow request (common on mobile data) used to permanently
  // fall back to the default hardcoded category tabs, even though a retry a
  // moment later would have succeeded. Retry with a short backoff first.
  async function fetchJsonWithRetry(url, attempts = 3, delayMs = 700) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('bad response: ' + res.status);
        return await res.json();
      } catch (err) {
        lastErr = err;
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      }
    }
    throw lastErr;
  }

  async function fetchCategories() {
    try {
      const data = await fetchJsonWithRetry('/api/categories');
      if (data && typeof data === 'object' && Object.keys(data).length) return data;
      return null;
    } catch {
      return null;
    }
  }

  function buildButton(filterValue, label, active) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stext-106 cl6 hov1 bor3 trans-04 m-r-32 m-tb-5' + (active ? ' how-active1' : '');
    btn.setAttribute('data-filter', filterValue);
    btn.textContent = label;
    return btn;
  }

  // Handles both the isotope filtering and the active-tab highlighting
  // itself (instead of leaning on main.js's binding), since these buttons
  // are rebuilt fresh here and main.js binds to whatever buttons existed at
  // page load — which, by the time this async fetch resolves, are gone.
  function wireGroup(group) {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-filter]');
      if (!btn || !group.contains(btn)) return;
      group.querySelectorAll('button').forEach((b) => b.classList.remove('how-active1'));
      btn.classList.add('how-active1');
      const filterValue = btn.getAttribute('data-filter');
      if (window.jQuery && window.jQuery.fn.isotope) {
        window.jQuery('.isotope-grid').isotope({ filter: filterValue });
      }
    });
  }

  // Reads ?category=<key> from the URL (e.g. a footer link to
  // "product.html?category=women") so a category link can land the visitor
  // straight on that filtered view instead of just "All Products".
  function getUrlCategory() {
    const cat = new URLSearchParams(location.search).get('category');
    return cat ? cat.trim() : null;
  }

  // Highlights the matching tab and applies the isotope filter. Safe to call
  // more than once (e.g. before AND after the product grid finishes
  // rendering) since it's idempotent.
  function applyUrlCategoryFilter(labels) {
    const cat = getUrlCategory();
    if (!cat || !labels[cat]) return; // no ?category=, or not a real category — leave "All Products" active

    document.querySelectorAll('.filter-tope-group').forEach((group) => {
      const targetBtn = group.querySelector('button[data-filter=".' + cat + '"]');
      if (!targetBtn) return;
      group.querySelectorAll('button').forEach((b) => b.classList.remove('how-active1'));
      targetBtn.classList.add('how-active1');
    });

    if (window.jQuery && window.jQuery.fn.isotope) {
      window.jQuery('.isotope-grid').isotope({ filter: '.' + cat });
    }
  }

  async function applyDynamicFilters() {
    const groups = document.querySelectorAll('.filter-tope-group');
    if (!groups.length) return;

    const labels = await fetchCategories();
    if (!labels) return; // API unavailable — leave the page's static fallback tabs as-is.

    groups.forEach((group) => {
      group.innerHTML = '';
      group.appendChild(buildButton('*', 'All Products', true));
      Object.keys(labels).forEach((key) => {
        group.appendChild(buildButton('.' + key, labels[key], false));
      });
      wireGroup(group);
    });

    // Apply it now (in case the product grid is already initialized) and
    // again once products-render.js finishes building/laying out the grid
    // (isotope has to exist and be initialized before `.isotope({filter})`
    // does anything) — whichever of the two finishes last is the one that
    // actually sticks, so we cover both orders.
    applyUrlCategoryFilter(labels);
    document.addEventListener('zaz:products-rendered', () => applyUrlCategoryFilter(labels));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyDynamicFilters);
  } else {
    applyDynamicFilters();
  }
})();
