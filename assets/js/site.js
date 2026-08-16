/* ==========================================================================
   Truecraft Property Services — site behaviour
   Ported from the DCLogic component in "Truecraft Website.dc.html":
   sticky-nav state, hero parallax + logo fade, marquee, scroll reveal,
   years counter, mobile menu, video autoplay fallback and the quote form.
   ========================================================================== */

(function () {
  'use strict';

  var q = function (name) { return document.querySelector('[data-tc="' + name + '"]'); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Mobile menu ─────────────────────────────────────────────────────── */

  var menuBtn = q('menubtn');
  var menuPanel = q('menupanel');

  function setMenu(open) {
    if (!menuPanel || !menuBtn) return;
    menuPanel.hidden = !open;
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  if (menuBtn && menuPanel) {
    menuBtn.addEventListener('click', function () {
      setMenu(menuPanel.hidden);
    });
    menuPanel.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenu(false);
    });
    setMenu(false);
  }

  var desktop = window.matchMedia('(min-width: 860px)');
  var onBreak = function (e) { if (e.matches) setMenu(false); };
  if (desktop.addEventListener) desktop.addEventListener('change', onBreak);
  else if (desktop.addListener) desktop.addListener(onBreak);

  /* ── Marquee ─────────────────────────────────────────────────────────── */

  var ticker = q('ticker');
  var track = q('track');
  var tickerAnim = null;

  function runTicker() {
    if (!ticker || !track || reduce || !ticker.animate) return;
    var w = track.clientWidth;
    var t = ticker.firstElementChild.offsetWidth;
    if (!w || !t) return;
    var gap = Math.max(64, w - t);
    var step = t + gap;
    ticker.style.gap = gap + 'px';
    if (tickerAnim) tickerAnim.cancel();
    tickerAnim = ticker.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(' + -step + 'px)' }],
      { duration: (step / 60) * 1000, iterations: Infinity, easing: 'linear' }
    );
  }

  runTicker();
  window.addEventListener('resize', debounce(runTicker, 150));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(runTicker);

  /* ── Scroll reveal ───────────────────────────────────────────────────── */

  var pending = [];

  if (!reduce) {
    document.documentElement.classList.add('tc-reveal-ready');
    pending = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    pending.forEach(function (el) {
      var sibs = Array.prototype.filter.call(el.parentElement.children, function (c) {
        return c.hasAttribute('data-reveal');
      });
      var i = Math.max(0, sibs.indexOf(el));
      el.style.transitionDelay = Math.min(i * 70, 420) + 'ms';
    });
  }

  function show(el) { el.classList.add('is-in'); }

  // Fail open: if nothing has ticked within a second, just show everything.
  var ticked = false;
  var failOpen = setTimeout(function () {
    if (ticked) return;
    pending.forEach(show);
    pending = [];
  }, 1000);

  /* ── Years counter ───────────────────────────────────────────────────── */

  var counter = q('counter');
  var counted = false;

  function countUp() {
    counted = true;
    var t0 = performance.now();
    var tick = function (now) {
      var p = Math.min(1, (now - t0) / 1100);
      counter.textContent = String(Math.round((1 - Math.pow(1 - p, 3)) * 30));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ── Nav state, hero parallax, reveal driver ─────────────────────────── */

  var navBar = q('navbar');
  var heroLogo = q('herologo');
  var heroWrap = q('herowrap');
  var solidNow = null;

  function measure() {
    ticked = true;
    var vh = window.innerHeight;
    var y = window.scrollY || window.pageYOffset || 0;

    if (pending.length) {
      var still = [];
      for (var i = 0; i < pending.length; i++) {
        var el = pending[i];
        if (el.getBoundingClientRect().top < vh * 0.92) show(el);
        else still.push(el);
      }
      pending = still;
    }

    if (counter && !counted && !reduce && counter.getBoundingClientRect().top < vh * 0.85) countUp();

    var solid = y > 120;
    if (solid !== solidNow) {
      solidNow = solid;
      if (navBar) navBar.classList.toggle('is-solid', solid);
    }

    if (heroLogo) heroLogo.style.opacity = String(Math.max(0, 1 - y / 340));
    if (heroWrap && !reduce) heroWrap.style.transform = 'translate3d(0,' + y * 0.18 + 'px,0)';
  }

  // Scroll events fire even when rAF is throttled; rAF keeps the parallax smooth.
  var frame = function () { measure(); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  window.addEventListener('scroll', measure, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  measure();

  window.addEventListener('load', function () {
    clearTimeout(failOpen);
    measure();
    runTicker();
  });

  /* ── Past-work video ─────────────────────────────────────────────────── */

  var vid = q('shedvideo');
  if (vid) {
    vid.muted = true;
    vid.setAttribute('muted', '');
    var tryPlay = function () {
      var p = vid.play();
      if (p && p.catch) p.catch(function () { vid.controls = true; });
    };
    tryPlay();
    vid.addEventListener('canplay', tryPlay, { once: true });
    vid.addEventListener('error', function () { vid.controls = true; }, { once: true });
  }

  /* ── Quote form ──────────────────────────────────────────────────────── */

  var form = q('form');
  var drop = q('drop');
  var dropLabel = q('droplabel');

  if (drop && dropLabel) {
    var fileInput = drop.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        var n = fileInput.files ? fileInput.files.length : 0;
        dropLabel.textContent = n === 0
          ? 'Attach photos of the area'
          : n + (n === 1 ? ' photo attached' : ' photos attached');
      });
    }
  }

  if (form) {
    var submit = q('submit');
    var status = q('status');

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Nothing is posted anywhere yet — swap this block for a real fetch()
      // (or set action/method on the form) once an endpoint exists.
      var required = form.querySelectorAll('[required]');
      var firstBad = null;
      Array.prototype.forEach.call(required, function (field) {
        var ok = field.value.trim() !== '';
        field.classList.toggle('is-invalid', !ok);
        if (!ok && !firstBad) firstBad = field;
      });

      if (firstBad) {
        if (status) status.textContent = 'Add your name and phone number so Amir can call you back.';
        firstBad.focus();
        return;
      }

      if (submit) {
        submit.textContent = 'Thanks — Amir will call you back';
        submit.disabled = true;
      }
      if (status) status.textContent = 'Details captured on this page only — the form is not connected to email yet.';
    });

    form.addEventListener('input', function (e) {
      if (e.target.classList) e.target.classList.remove('is-invalid');
    });
  }

  /* ── Utils ───────────────────────────────────────────────────────────── */

  function debounce(fn, wait) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, wait);
    };
  }
})();
