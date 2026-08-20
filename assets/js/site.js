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
    // Autoplay failed, so the video needs to be tappable. The class restores
    // pointer events that the touch-scroll fix removes.
    var showControls = function () {
      vid.controls = true;
      vid.classList.add('has-controls');
    };
    var tryPlay = function () {
      var p = vid.play();
      if (p && p.catch) p.catch(function () { showControls(); });
    };
    tryPlay();
    vid.addEventListener('canplay', tryPlay, { once: true });
    vid.addEventListener('error', showControls, { once: true });
  }

  /* ── Quote form ──────────────────────────────────────────────────────────
     Photos are resized in the browser before upload: it keeps the request
     small enough for the Worker and the mailbox at the other end, and means
     someone standing in their backyard on mobile data isn't uploading 25 MB
     of full-resolution phone photos. The Worker re-checks every limit. */

  var MAX_PHOTOS = 5;
  var MAX_EDGE = 1600;          // px, long edge
  var JPEG_QUALITY = 0.82;
  var MAX_TOTAL_BYTES = 8 * 1024 * 1024;
  var COOLDOWN_MS = 15 * 60 * 1000;
  var COOLDOWN_KEY = 'tc-quote-sent';
  var ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  var ALLOWED_LABEL = 'JPEG, PNG or WebP';

  var form = q('form');
  var drop = q('drop');
  var dropLabel = q('droplabel');
  var fileInput = drop && drop.querySelector('input[type="file"]');

  var stamp = q('rendered');
  if (stamp) stamp.value = String(Date.now());

  // Say exactly what is wrong and what would be accepted, at the moment the
  // file is chosen — not after a round trip to the server.
  function fileProblem(files) {
    if (files.length > MAX_PHOTOS) {
      return 'That is ' + files.length + ' photos — please choose ' + MAX_PHOTOS + ' or fewer.';
    }

    var bad = [];
    var heic = false;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (ALLOWED_TYPES.indexOf(f.type) !== -1) continue;
      bad.push(f.name);
      if (/heic|heif/i.test(f.type) || /\.hei[cf]$/i.test(f.name)) heic = true;
    }

    if (bad.length) {
      var which = bad.length === 1 ? '“' + bad[0] + '” is not' : bad.length + ' of those files are not';
      if (heic) {
        return which + ' a format browsers can read. iPhone HEIC photos need converting — ' +
          'in Settings › Camera › Formats choose “Most Compatible”, or text them to 0418 126 371 instead.';
      }
      return which + ' a supported image. Please attach ' + ALLOWED_LABEL + ' files.';
    }

    return null;
  }

  if (fileInput && dropLabel) {
    fileInput.addEventListener('change', function () {
      var files = fileInput.files ? Array.prototype.slice.call(fileInput.files) : [];
      var problem = fileProblem(files);

      if (problem) {
        setStatus(problem, true);
        fileInput.value = '';
        dropLabel.textContent = 'Attach photos of the area';
        return;
      }

      setStatus('');
      dropLabel.textContent = files.length === 0
        ? 'Attach photos of the area'
        : files.length + (files.length === 1 ? ' photo attached' : ' photos attached');
    });
  }

  function setStatus(msg, isError) {
    var status = q('status');
    if (!status) return;
    status.textContent = msg || '';
    status.classList.toggle('is-error', !!isError);
  }

  // Draw the image to a canvas at a capped size and re-encode as JPEG.
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        if (scale === 1 && file.size < 600 * 1024) { URL.revokeObjectURL(url); return resolve(file); }
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          if (!blob) return resolve(file);
          resolve(new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', JPEG_QUALITY);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('“' + file.name + '” could not be read. Please attach ' + ALLOWED_LABEL + ' files.'));
      };
      img.src = url;
    });
  }

  if (form) {
    var submit = q('submit');
    var defaultLabel = submit ? submit.textContent : '';

    form.addEventListener('input', function (e) {
      if (e.target.classList) e.target.classList.remove('is-invalid');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submit && submit.disabled) return;

      // Client-side cooldown. Easily bypassed, which is why the Worker keeps
      // its own per-IP limit — this is here to stop honest double-sends.
      var last = Number(localStorage.getItem(COOLDOWN_KEY) || 0);
      if (last && Date.now() - last < COOLDOWN_MS) {
        var mins = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 60000);
        setStatus('You have just sent an enquiry. Try again in ' + mins + ' minute' + (mins === 1 ? '' : 's') + ', or call 0418 126 371.', true);
        return;
      }

      var firstBad = null;
      Array.prototype.forEach.call(form.querySelectorAll('[required]'), function (field) {
        var ok = field.value.trim() !== '';
        field.classList.toggle('is-invalid', !ok);
        if (!ok && !firstBad) firstBad = field;
      });
      var emailField = form.querySelector('input[name="email"]');
      if (emailField && emailField.value.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailField.value.trim())) {
        emailField.classList.add('is-invalid');
        if (!firstBad) firstBad = emailField;
      }
      if (firstBad) {
        setStatus('Add your name and phone number so Amir can call you back.', true);
        firstBad.focus();
        return;
      }

      var endpoint = form.getAttribute('data-endpoint');
      if (!endpoint || endpoint.indexOf('REPLACE-ME') !== -1) {
        setStatus('The form is not connected yet. Please call 0418 126 371.', true);
        return;
      }

      if (submit) { submit.disabled = true; submit.textContent = 'Sending…'; }
      setStatus('');

      var files = fileInput && fileInput.files ? Array.prototype.slice.call(fileInput.files) : [];
      var problem = fileProblem(files);
      if (problem) {
        if (submit) { submit.disabled = false; submit.textContent = defaultLabel; }
        setStatus(problem, true);
        return;
      }

      Promise.all(files.map(shrink)).then(function (shrunk) {
        var total = shrunk.reduce(function (n, f) { return n + f.size; }, 0);
        if (total > MAX_TOTAL_BYTES) {
          throw new Error('Those photos are still too large to send. Please attach fewer of them.');
        }

        var data = new FormData(form);
        data.delete('photos');
        shrunk.forEach(function (f) { data.append('photos', f, f.name); });

        return fetch(endpoint, { method: 'POST', body: data });
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok || !body.ok) throw new Error(body.error || 'We could not send that just now. Please call 0418 126 371.');
          return body;
        });
      }).then(function () {
        localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
        if (submit) submit.textContent = 'Thanks — Amir will call you back';
        setStatus('Enquiry sent. Amir usually calls back the same day.');
        form.reset();
        if (dropLabel) dropLabel.textContent = 'Attach photos of the area';
      }).catch(function (err) {
        if (submit) { submit.disabled = false; submit.textContent = defaultLabel; }
        setStatus(err.message || 'Something went wrong. Please call 0418 126 371.', true);
        if (window.turnstile) window.turnstile.reset();
      });
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
