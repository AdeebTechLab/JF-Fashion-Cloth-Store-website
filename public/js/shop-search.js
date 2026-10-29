/* Live product search for the shop toolbar (.js-shop-search).
   Replaces the old "Filter" / "Search" slide-down panels: typing here
   instantly re-orders each .isotope-grid so name matches float to the
   top, and hides anything that doesn't match at all. Works with both
   the dynamically-rendered grid (js/products-render.js) and any static
   fallback markup, since it reads product names straight from
   .js-name-b2 in the DOM rather than needing its own data source. */
(function () {
  'use strict';

  function normalize(s) {
    return (s || '').toLowerCase().trim();
  }

  function itemName(item) {
    var el = item.querySelector('.js-name-b2');
    return normalize(el ? el.textContent : '');
  }

  // Higher score = more relevant. -1 means "hide this item".
  function scoreItem(name, term) {
    if (!term) return 0;
    if (name === term) return 3;
    if (name.indexOf(term) === 0) return 2;
    if (name.indexOf(term) !== -1) return 1;
    return -1;
  }

  function ensureEmptyState(grid) {
    var empty = grid.parentElement.querySelector(':scope > .shop-search-empty');
    if (!empty) {
      empty = document.createElement('div');
      empty.className = 'shop-search-empty dis-none';
      empty.textContent = "No products match your search.";
      grid.insertAdjacentElement('afterend', empty);
    }
    return empty;
  }

  function applySearch(grid, term) {
    var items = Array.prototype.slice.call(grid.querySelectorAll('.isotope-item'));
    if (!items.length) return;

    var scored = items.map(function (it) {
      return { it: it, score: scoreItem(itemName(it), term) };
    });

    // Array#sort is stable in all current browsers, so ties keep their
    // original relative order — matches float up without the rest of
    // the grid appearing shuffled.
    scored.sort(function (a, b) { return b.score - a.score; });
    scored.forEach(function (row) { grid.appendChild(row.it); });
    scored.forEach(function (row) {
      row.it.style.display = row.score >= 0 ? '' : 'none';
    });

    var visibleCount = scored.filter(function (row) { return row.score >= 0; }).length;
    var empty = ensureEmptyState(grid);
    empty.classList.toggle('dis-none', visibleCount > 0);
    grid.classList.toggle('dis-none', visibleCount === 0);

    if (window.jQuery && jQuery.fn.isotope && jQuery(grid).data('isotope')) {
      jQuery(grid)
        .isotope('reloadItems')
        .isotope({
          // Isotope's default 0.4s move animation looks fine for a single
          // filter click, but live-as-you-type search re-triggers this on
          // every keystroke — with the animation on, cards (and their
          // photos) are constantly mid-slide, which reads as jittery
          // movement over the images. Instant repositioning while
          // searching removes that without touching the normal
          // click-a-category filter behavior in js/main.js /
          // js/category-labels.js, which don't set this option.
          transitionDuration: 0,
          filter: term
            ? function () { return scoreItem(itemName(this), term) >= 0; }
            : '*',
        })
        .isotope('layout');
    }
  }

  var currentTerm = '';

  function runSearch() {
    document.querySelectorAll('.isotope-grid').forEach(function (grid) {
      applySearch(grid, currentTerm);
    });
  }

  // products-render.js appends cards asynchronously (initial fetch, plus
  // every "Load More" click) — re-apply whatever search is active so
  // newly-added cards get sorted/filtered too, instead of only the
  // items that happened to exist when the user first typed.
  document.addEventListener('zaz:products-rendered', runSearch);

  function init() {
    var inputs = document.querySelectorAll('.js-shop-search');
    if (!inputs.length) return;

    var debounceTimer;

    inputs.forEach(function (input) {
      input.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        var value = input.value;
        debounceTimer = setTimeout(function () {
          currentTerm = normalize(value);
          runSearch();
        }, 120);
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && input.value) {
          input.value = '';
          currentTerm = '';
          runSearch();
        }
      });
    });

    document.querySelectorAll('.js-shop-search-clear').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var wrap = btn.closest('.shop-search-wrap');
        var input = wrap ? wrap.querySelector('.js-shop-search') : null;
        if (input) {
          input.value = '';
          input.focus();
        }
        currentTerm = '';
        runSearch();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
