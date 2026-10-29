/* Drives the "Deal Of The Week" countdown circles on index.html.
   Deadline is set once per browser (persisted in sessionStorage) so the
   clock doesn't reset back to 2 days / 23 hours every time the page
   reloads within the same session — it just keeps counting down. */
(function () {
  'use strict';

  function getDeadline() {
    var key = 'zaz-deal-week-deadline';
    var stored = sessionStorage.getItem(key);
    if (stored) return new Date(stored);

    // Starting point matches the reference design: 2 days, 23 hours,
    // 57 minutes, 21 seconds from first page load.
    var deadline = new Date();
    deadline.setTime(
      deadline.getTime() +
      (2 * 24 * 60 * 60 + 23 * 60 * 60 + 57 * 60 + 21) * 1000
    );
    sessionStorage.setItem(key, deadline.toISOString());
    return deadline;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function tick(deadline, els) {
    var t = deadline.getTime() - Date.now();
    if (t < 0) t = 0;

    var days = Math.floor(t / (1000 * 60 * 60 * 24));
    var hours = Math.floor((t / (1000 * 60 * 60)) % 24);
    var mins = Math.floor((t / (1000 * 60)) % 60);
    var secs = Math.floor((t / 1000) % 60);

    if (els.days) els.days.textContent = days;
    if (els.hours) els.hours.textContent = pad(hours);
    if (els.mins) els.mins.textContent = pad(mins);
    if (els.secs) els.secs.textContent = pad(secs);

    return t;
  }

  function init() {
    var wrap = document.querySelector('[data-deal-countdown]');
    if (!wrap) return;

    var els = {
      days: wrap.querySelector('[data-dw-days]'),
      hours: wrap.querySelector('[data-dw-hours]'),
      mins: wrap.querySelector('[data-dw-mins]'),
      secs: wrap.querySelector('[data-dw-secs]'),
    };

    var deadline = getDeadline();
    var remaining = tick(deadline, els);
    if (remaining <= 0) return;

    var interval = setInterval(function () {
      var left = tick(deadline, els);
      if (left <= 0) clearInterval(interval);
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
