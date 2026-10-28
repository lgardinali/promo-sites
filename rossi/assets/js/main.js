/* ==========================================================================
   Aniversário Rossi 51 anos — interações (JS nativo, sem dependências)

   Diretriz de fluidez aplicada:
   1) Camada de GPU ligada pela VISIBILIDADE (.is-live via IntersectionObserver), nunca pelo movimento.
   2) Sempre 3D (translate3d/scale3d) + rotate(0.02deg) em imagens; texto só translate3d.
   3) Entrada suavizada em dois estágios, normalizada pelo tempo do quadro.
   + Um único requestAnimationFrame para a cena; leituras de layout só em resize/observers/input;
     posições sempre em subpixel (.toFixed(3)); loop para ao assentar e volta no próximo input.
   ========================================================================== */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  var mqTablet = window.matchMedia('(min-width: 768px)');
  var mqDesktop = window.matchMedia('(min-width: 1200px)');
  var hasIO = 'IntersectionObserver' in window;
  var scrollDrivenCSS = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: view()'));

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var clamp = function (v, min, max) { return Math.min(max, Math.max(min, v)); };
  var fx = function (n) { return n.toFixed(3); };                       // nunca arredondar para pixel inteiro
  var amplitude = function () { return mqDesktop.matches ? 1 : mqTablet.matches ? 0.82 : 0.5; };
  var smooth = function (k, f) { return 1 - Math.pow(1 - k, f); };      // lerp normalizado pelo tempo
  var easeInOutCubic = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  /* ------------------------------------------------------------------------
     Cena: um único requestAnimationFrame para tudo
     Tarefas retornam false quando assentam; a cena dorme e volta no próximo input.
     ------------------------------------------------------------------------ */
  var Scene = (function () {
    var tasks = [], pending = [], raf = 0, last = 0, lastY = NaN, uiDirty = true;
    var onScrollUI = function () {};
    function frame(now) {
      raf = 0;
      var dt = last ? Math.min(64, now - last) : 16.667;
      last = now;
      var f = dt / 16.667;                                   // 120 Hz → 0,5 · 60 Hz → 1 · 30 Hz → 2
      if (pending.length) { tasks = tasks.concat(pending); pending = []; }
      var keep = [];
      for (var i = 0; i < tasks.length; i++) if (tasks[i](f, now) !== false) keep.push(tasks[i]);
      tasks = keep;
      var y = window.scrollY;                                // depois das tarefas que rolam a página
      if (uiDirty || y !== lastY) { lastY = y; uiDirty = false; onScrollUI(y); }
      if (tasks.length || pending.length) raf = requestAnimationFrame(frame);
      else last = 0;
    }
    function wake(dirty) { if (dirty) uiDirty = true; if (!raf) raf = requestAnimationFrame(frame); }
    function add(task) { if (tasks.indexOf(task) < 0 && pending.indexOf(task) < 0) pending.push(task); wake(); }
    return { add: add, wake: wake, setScrollUI: function (fn) { onScrollUI = fn; } };
  })();

  /* ------------------------------------------------------------------------
     Cache de layout — lido só em resize / ResizeObserver / fontes / load
     ------------------------------------------------------------------------ */
  var header = $('[data-header]');
  var L = { vh: window.innerHeight, max: 0, header: 0, overlap: 0 };
  var measureHooks = [];
  function docTop(el) { var y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; } // ignora transforms
  function measure() {
    L.vh = window.innerHeight;
    L.max = Math.max(0, doc.scrollHeight - L.vh);
    L.header = header ? header.offsetHeight : 0;
    L.overlap = parseFloat(getComputedStyle(doc).getPropertyValue('--sheet-overlap')) || 0;
    for (var i = 0; i < measureHooks.length; i++) measureHooks[i]();
    Scene.wake(true);
  }
  function onMeasure(fn) { measureHooks.push(fn); }

  /* ------------------------------------------------------------------------
     Camada de GPU por visibilidade (.is-live) — liga ao entrar na tela, desliga ao sair
     ------------------------------------------------------------------------ */
  var LIVE_SELECTOR = [
    '.kv-logo__part', '.kv-logo__part img', '.kv-prize', '.kv-prize__in', '.kv-prize img',
    '.kv__title', '.kv__lucky', '.kv__cta', '.kv__legal',
    '[data-parallax]', '[data-parallax] > img', '.balloon img',
    '[data-reveal]', '.traco', '.traco img',
    '.passo__img > img', '.passo__num', '.selo-bonus', '.btn-exemplos',
    '.pz img', '.pc__slide', '.pc__bexiga img',
    '.faq__a p', '.card-regulamento__confete', '.abas__indicator',
    '.btn-primary', '.btn-cta', '.btn-secondary', '.btn-login', '.link-seta img',
    '.ganhadores', '.footer'
  ].join(',');
  var Live = (function () {
    var io = hasIO ? new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) entries[i].target.classList.toggle('is-live', entries[i].isIntersecting);
    }, { rootMargin: '25% 0px 25% 0px' }) : null;
    function observe(els) { els.forEach(function (el) { if (io) io.observe(el); else el.classList.add('is-live'); }); }
    function unobserve(els) { if (io) els.forEach(function (el) { io.unobserve(el); }); }
    if (!reduceMotion.matches) observe($$(LIVE_SELECTOR));
    return { observe: function (els) { if (!reduceMotion.matches) observe(els); }, unobserve: unobserve };
  })();

  /* ------------------------------------------------------------------------
     Rolagem suave da roda do mouse — só quando o navegador NÃO suaviza sozinho.
     Detecção: observamos os primeiros eventos sem interferir; se a posição muda em
     um único quadro ("em degrau") ligamos a suavização; se muda ao longo de vários,
     o navegador já anima e não mexemos. Trackpad/toque: sempre nativo.
     Suavização em dois estágios (alvo → suavizado → exibido), normalizada por tempo.
     ------------------------------------------------------------------------ */
  var Wheel = (function () {
    var W = { enabled: false, decided: false, active: false, t: 0, s: 0, c: 0, written: 0, steps: 0 };
    var watching = false, wheelCount = 0;

    function sync() { W.t = W.s = W.c = window.scrollY; }
    function stop() { W.active = false; }

    function task(f) {
      if (!W.active) return false;
      W.s += (W.t - W.s) * smooth(0.2, f);                  // 1º estágio: alvo suavizado
      W.c += (W.s - W.c) * smooth(0.14, f);                 // 2º estágio: posição exibida
      if (Math.abs(W.t - W.c) < 0.05 && Math.abs(W.t - W.s) < 0.05) { W.s = W.c = W.t; W.active = false; }
      window.scrollTo({ top: W.c, behavior: 'instant' });
      W.written = window.scrollY;
      return W.active;
    }

    function decide(enable) {
      if (W.decided) return;
      W.decided = true;
      window.removeEventListener('wheel', probe);
      if (enable) {
        W.enabled = true;
        window.addEventListener('wheel', onWheel, { passive: false });
      }
    }

    function probe(e) {
      wheelCount++;
      if (W.decided || watching || e.ctrlKey) return;
      var dy = e.deltaY;
      if (e.deltaMode === 0 && (Math.abs(dy) < 40 || dy % 1 !== 0)) { decide(false); return; }
      var y0 = window.scrollY;
      if ((dy < 0 && y0 <= 0) || (dy > 0 && y0 >= L.max - 1)) return;
      var frames = 0, changes = 0, prev = y0, count0 = wheelCount;
      watching = true;
      (function watch() {
        frames++;
        var y = window.scrollY;
        if (Math.abs(y - prev) > 0.5) { changes++; prev = y; }
        if (frames < 14) { requestAnimationFrame(watch); return; }
        watching = false;
        W.steps++;
        if (wheelCount !== count0) { if (W.steps > 8) decide(false); return; }
        if (changes >= 3) decide(false);
        else if (changes >= 1) decide(true);
        else if (W.steps > 4) decide(false);
      })();
    }

    function onWheel(e) {
      if (e.ctrlKey || e.defaultPrevented || doc.classList.contains('is-locked')) return;
      if (e.target instanceof Element && e.target.closest('[data-drawer]')) return;
      if (e.deltaMode === 0 && Math.abs(e.deltaY) < 24 && e.deltaY % 1 !== 0) return; // trackpad
      e.preventDefault();
      var dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 40;
      else if (e.deltaMode === 2) dy *= L.vh;
      Anchor.cancel();
      if (!W.active) sync();
      W.t = clamp(W.t + dy, 0, L.max);
      W.active = true;
      Scene.add(task);
    }

    // Barra de rolagem, teclado etc. interrompem a suavização
    window.addEventListener('scroll', function () {
      if (W.active && Math.abs(window.scrollY - W.written) > 3) { stop(); sync(); }
    }, { passive: true });

    if (!reduceMotion.matches && finePointer.matches) window.addEventListener('wheel', probe, { passive: true });
    return { sync: sync, stop: stop };
  })();

  /* Rolagem animada até um ponto (âncoras) — tarefa da mesma cena */
  var Anchor = (function () {
    var A = { active: false, from: 0, dist: 0, t0: 0, dur: 0 };
    function task(f, now) {
      if (!A.active) return false;
      if (!A.t0) A.t0 = now;
      var p = Math.min(1, (now - A.t0) / A.dur);
      window.scrollTo({ top: A.from + A.dist * easeInOutCubic(p), behavior: 'instant' });
      if (p >= 1) { A.active = false; Wheel.sync(); }
      return A.active;
    }
    function cancel() { if (A.active) { A.active = false; Wheel.sync(); } }
    function to(y) {
      y = clamp(y, 0, L.max);
      Wheel.stop();
      if (reduceMotion.matches) { window.scrollTo({ top: y, behavior: 'instant' }); Wheel.sync(); return; }
      A.from = window.scrollY; A.dist = y - A.from;
      if (Math.abs(A.dist) < 1) return;
      A.dur = clamp(Math.abs(A.dist) * 0.45, 650, 1300); A.t0 = 0; A.active = true;
      Scene.add(task);
    }
    ['touchstart', 'keydown', 'wheel'].forEach(function (ev) { window.addEventListener(ev, cancel, { passive: true }); });
    return { to: to, cancel: cancel };
  })();

  function sectionOffset(el) {
    if (!el || el.id === 'home') return 0;
    return docTop(el) - L.header - L.overlap + 1;
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (!id) { e.preventDefault(); return; } // links "#" ainda sem destino
    var target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    Drawer.close();
    Anchor.to(sectionOffset(target));
    if (history.replaceState) history.replaceState(null, '', '#' + id);
    if (id !== 'conteudo') { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
  });

  /* ------------------------------------------------------------------------
     Menu: indicador ativo, scrollspy e progresso (tudo a partir do cache)
     ------------------------------------------------------------------------ */
  var indicator = $('[data-nav-indicator]');
  var navLinks = $$('[data-spy]');
  var drawerLinks = $$('.drawer__nav a');
  var progress = $('[data-progress]');
  var activeId = 'home';
  var navCenters = {};
  var spy = navLinks.map(function (l) { return { id: l.getAttribute('data-spy'), el: document.getElementById(l.getAttribute('data-spy')), top: 0 }; })
    .filter(function (s) { return s.el; });

  onMeasure(function () {
    spy.forEach(function (s) { s.top = docTop(s.el); });
    navLinks.forEach(function (l) { navCenters[l.getAttribute('data-spy')] = l.offsetLeft + l.offsetWidth / 2; });
    moveIndicator(activeId);
  });

  function moveIndicator(id) {
    if (!indicator || !mqDesktop.matches || navCenters[id] == null) return;
    indicator.style.setProperty('--ix', fx(navCenters[id] - 14) + 'px');
    indicator.style.setProperty('--io', '1');
  }
  function setActive(id) {
    activeId = id;
    navLinks.forEach(function (l) {
      var on = l.getAttribute('data-spy') === id;
      l.classList.toggle('is-active', on);
      if (on) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
    });
    drawerLinks.forEach(function (l) { l.classList.toggle('is-active', l.getAttribute('href') === '#' + id); });
    moveIndicator(id);
  }
  var nav = $('[data-nav]');
  if (nav) {
    nav.addEventListener('mouseover', function (e) { var l = e.target.closest('.nav__link'); if (l) moveIndicator(l.getAttribute('data-spy')); });
    nav.addEventListener('mouseleave', function () { moveIndicator(activeId); });
    nav.addEventListener('focusin', function (e) { var l = e.target.closest('.nav__link'); if (l) moveIndicator(l.getAttribute('data-spy')); });
  }

  /* ------------------------------------------------------------------------
     Parallax de scroll — fallback em JS (onde não há scroll-driven animations no CSS)
     ------------------------------------------------------------------------ */
  var parallaxItems = (scrollDrivenCSS || reduceMotion.matches) ? [] : $$('[data-parallax]').map(function (el) {
    return { el: el, k: parseFloat(el.getAttribute('data-parallax')) || 0, host: el.closest('[data-section]') || el.parentElement, center: 0, rot: '', visible: true };
  });
  if (parallaxItems.length && hasIO) {
    var pxIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.__px.visible = en.isIntersecting; });
    }, { rootMargin: '200px 0px' });
    parallaxItems.forEach(function (it) { it.el.__px = it; pxIO.observe(it.el); });
  }
  onMeasure(function () {
    parallaxItems.forEach(function (it) {
      it.center = docTop(it.host) + it.host.offsetHeight / 2;
      var r = getComputedStyle(it.el).getPropertyValue('--br').trim();
      it.rot = r ? ' rotate(' + r + ')' : ' rotate(0.02deg)';
    });
  });

  // UI ligada à rolagem: roda dentro do quadro da cena, sem ler layout
  Scene.setScrollUI(function (y) {
    if (progress) progress.style.transform = 'scale3d(' + (L.max ? y / L.max : 0).toFixed(4) + ',1,1)';

    var line = y + L.vh * 0.35, current = 'home';
    for (var i = 0; i < spy.length; i++) if (spy[i].top <= line) current = spy[i].id;
    if (y >= L.max - 4 && spy.length) current = spy[spy.length - 1].id;
    if (current !== activeId) setActive(current);

    if (parallaxItems.length) {
      var a = amplitude(), mid = y + L.vh / 2;
      for (var j = 0; j < parallaxItems.length; j++) {
        var it = parallaxItems[j];
        if (!it.visible) continue;
        it.el.style.transform = 'translate3d(0,' + fx((it.center - mid) * it.k * a) + 'px,0)' + it.rot;
      }
    }
  });
  window.addEventListener('scroll', function () { Scene.wake(); }, { passive: true });

  /* ------------------------------------------------------------------------
     Drawer (menu mobile / tablet)
     ------------------------------------------------------------------------ */
  var Drawer = (function () {
    var drawer = $('[data-drawer]');
    var toggle = $('[data-menu-toggle]');
    var openState = false, closeTimer = 0;
    function open() {
      if (!drawer || openState) return;
      openState = true;
      clearTimeout(closeTimer);
      drawer.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Fechar menu');
      doc.classList.add('is-locked');
      requestAnimationFrame(function () { requestAnimationFrame(function () { drawer.classList.add('is-open'); }); });
      var first = drawer.querySelector('a'); if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 250);
    }
    function close() {
      if (!drawer || !openState) return;
      openState = false;
      drawer.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Abrir menu');
      doc.classList.remove('is-locked');
      closeTimer = setTimeout(function () { drawer.hidden = true; }, reduceMotion.matches ? 0 : 600);
    }
    if (toggle) toggle.addEventListener('click', function () { openState ? close() : open(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openState) { close(); toggle.focus(); } });
    mqDesktop.addEventListener('change', function (e) { if (e.matches) close(); });
    return { open: open, close: close };
  })();

  /* ------------------------------------------------------------------------
     Revelação ao rolar (com escalonamento por grupo)
     ------------------------------------------------------------------------ */
  $$('[data-reveal-group]').forEach(function (group) {
    $$('[data-reveal]', group).forEach(function (el, i) { el.style.setProperty('--rd', (i * 110) + 'ms'); });
  });
  var revealEls = $$('[data-reveal]');
  if (reduceMotion.matches || !hasIO) {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); revealIO.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    revealEls.forEach(function (el) { revealIO.observe(el); });
  }

  /* Pausa os loops das seções fora da tela */
  if (hasIO) {
    var pauseIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle('is-paused', !en.isIntersecting); });
    }, { rootMargin: '120px 0px' });
    $$('[data-section]').forEach(function (s) { pauseIO.observe(s); });
  }

  /* ------------------------------------------------------------------------
     "Hover" pelo centro da tela em dispositivos de toque
     ------------------------------------------------------------------------ */
  var CenterHover = (function () {
    var io = null;
    function observe(els) { if (io) els.forEach(function (el) { io.observe(el); }); }
    function unobserve(els) { if (io) els.forEach(function (el) { io.unobserve(el); el.classList.remove('is-center'); }); }
    if (!finePointer.matches && hasIO && !reduceMotion.matches) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { en.target.classList.toggle('is-center', en.isIntersecting); });
      }, { rootMargin: '-44% 0px -44% 0px', threshold: 0 });
      observe($$('[data-center-hover]'));
    }
    return { observe: observe, unobserve: unobserve };
  })();

  /* ------------------------------------------------------------------------
     KV: entrada + parallax pelo mouse (desktop) com suavização em dois estágios
     ------------------------------------------------------------------------ */
  (function () {
    var kv = $('.kv');
    if (!kv) return;

    var critical = $$('.kv-logo img, .kv-prize--carro img, .kv-prize--plataforma img', kv);
    var ready = function () { doc.classList.add('is-ready'); };
    var waits = critical.map(function (img) {
      if (img.complete) return Promise.resolve();
      return new Promise(function (res) { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); });
    });
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([Promise.all(waits.concat([fonts])), new Promise(function (res) { setTimeout(res, 1400); })])
      .then(function () { requestAnimationFrame(ready); });

    if (!finePointer.matches || reduceMotion.matches) return;

    var items = $$('.kv-prize[data-depth]', kv).map(function (el) { return { el: el, d: parseFloat(el.getAttribute('data-depth')) || 0 }; });
    var box = { left: 0, top: 0, w: 1, h: 1 };
    var M = { tx: 0, ty: 0, sx: 0, sy: 0, cx: 0, cy: 0, on: false };
    var RANGE_X = 12, RANGE_Y = 9;                        // px por unidade de profundidade (desktop)

    onMeasure(function () {
      var r = kv.getBoundingClientRect();
      box.left = r.left; box.top = docTop(kv); box.w = kv.offsetWidth || 1; box.h = kv.offsetHeight || 1;
      if (!mqDesktop.matches) {                            // fora do desktop: sem parallax de mouse
        M.tx = M.ty = M.sx = M.sy = M.cx = M.cy = 0;
        items.forEach(function (it) { it.el.style.transform = ''; });
      }
    });

    function task(f) {
      var k1 = smooth(0.14, f), k2 = smooth(0.075, f);
      M.sx += (M.tx - M.sx) * k1; M.sy += (M.ty - M.sy) * k1;   // 1º estágio: alvo suavizado
      M.cx += (M.sx - M.cx) * k2; M.cy += (M.sy - M.cy) * k2;   // 2º estágio: posição exibida
      var a = amplitude();
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        it.el.style.transform = 'translate3d(' + fx(M.cx * it.d * RANGE_X * a) + 'px,' + fx(M.cy * it.d * RANGE_Y * a) + 'px,0) rotate(0.02deg)';
      }
      var settled = Math.abs(M.tx - M.cx) < 0.0005 && Math.abs(M.ty - M.cy) < 0.0005 &&
                    Math.abs(M.tx - M.sx) < 0.0005 && Math.abs(M.ty - M.sy) < 0.0005;
      if (settled) { M.on = false; return false; }        // para o loop — a camada de GPU continua
      return true;
    }
    function run() { if (!M.on) { M.on = true; Scene.add(task); } }

    kv.addEventListener('pointermove', function (e) {
      if (!mqDesktop.matches || e.pointerType !== 'mouse') return;
      M.tx = clamp(((e.clientX - box.left) / box.w - 0.5) * 2, -1, 1);
      M.ty = clamp(((e.pageY - box.top) / box.h - 0.5) * 2, -1, 1);
      run();
    });
    kv.addEventListener('pointerleave', function () { M.tx = 0; M.ty = 0; run(); });
  })();

  /* ------------------------------------------------------------------------
     Prêmios: vitrine automática (destaque em sequência) + hover
     ------------------------------------------------------------------------ */
  (function () {
    var comp = $('[data-prizes]');
    if (!comp) return;
    var prizes = $$('.pz--hover', comp);
    var order = ['carro', 'tv', 'microondas', 'airfryer'].map(function (n) { return $('.pz--' + n, comp); }).filter(Boolean);
    var idx = -1, timer = 0, visible = false, hovering = false;
    function clear() { prizes.forEach(function (p) { p.classList.remove('is-spot'); }); }
    function next() {
      clear();
      idx = (idx + 1) % order.length;
      order[idx].classList.add('is-spot');
      timer = setTimeout(function () { clear(); timer = setTimeout(next, 900); }, 1800);
    }
    function run() { if (!timer && visible && !hovering && !reduceMotion.matches && mqTablet.matches) timer = setTimeout(next, 1200); }
    function halt() { clearTimeout(timer); timer = 0; clear(); }
    prizes.forEach(function (p) {
      p.addEventListener('pointerenter', function () { hovering = true; halt(); });
      p.addEventListener('pointerleave', function () { hovering = false; run(); });
    });
    if (hasIO) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) run(); else halt();
      }, { threshold: 0.35 }).observe(comp);
    }
  })();

  /* ------------------------------------------------------------------------
     Prêmios: carrossel mobile
     ------------------------------------------------------------------------ */
  (function () {
    var root = $('[data-carousel]');
    if (!root) return;
    var slides = $$('.pc__slide', root);
    var stage = $('.premios-carousel__stage', root);
    var index = 0, timer = 0, visible = false;

    function go(i, dir) {
      var n = slides.length;
      i = (i + n) % n;
      if (i === index && slides[i].classList.contains('is-active')) { sync(); return; }
      var prev = slides[index];
      prev.classList.remove('is-active');
      prev.classList.toggle('is-prev', dir > 0);
      slides.forEach(function (s, k) { if (k !== index) s.classList.remove('is-prev'); });
      var cur = slides[i];
      cur.classList.toggle('is-prev', dir < 0);
      void cur.offsetWidth;                                  // leitura de layout só no input
      cur.classList.remove('is-prev');
      cur.classList.add('is-active');
      index = i;
      sync();
    }
    function sync() { slides.forEach(function (s, k) { s.setAttribute('aria-hidden', k === index ? 'false' : 'true'); }); }
    function restart() { clearTimeout(timer); timer = 0; play(); }
    function play() {
      if (timer || !visible || reduceMotion.matches || mqTablet.matches) return;
      timer = setTimeout(function () { timer = 0; go(index + 1, 1); play(); }, 3800);
    }

    $('[data-carousel-prev]', root).addEventListener('click', function () { go(index - 1, -1); restart(); });
    $('[data-carousel-next]', root).addEventListener('click', function () { go(index + 1, 1); restart(); });

    var sx = 0, sy = 0, dragging = false;
    stage.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; dragging = true; sx = e.clientX; sy = e.clientY; });
    stage.addEventListener('pointerup', function (e) {
      if (!dragging) return; dragging = false;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { go(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); restart(); }
    });
    stage.addEventListener('pointercancel', function () { dragging = false; });

    if (hasIO) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) play(); else { clearTimeout(timer); timer = 0; }
      }, { threshold: 0.4 }).observe(root);
    }
    sync();
  })();

  /* ------------------------------------------------------------------------
     Dúvidas frequentes — acordeão com FLIP (só transform; a altura muda de uma vez,
     os elementos abaixo deslizam do lugar antigo para o novo em subpixel e a "pele"
     do item — fundo + sombra — escala da altura antiga para a nova, sem recortes)
     ------------------------------------------------------------------------ */
  (function () {
    var items = $$('[data-faq-item]');
    if (!items.length) return;
    var followers = [$('.card-regulamento--aside'), $('.ganhadores'), $('.footer')].filter(Boolean);
    var EASE = 'var(--ease-slow)', DUR = 600, cleanupTimer = 0;

    function setState(item, open) {
      var btn = item.querySelector('.faq__q');
      var panel = item.querySelector('.faq__a');
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) panel.removeAttribute('inert'); else panel.setAttribute('inert', '');
    }
    function clearInline(el) {
      el.style.transform = ''; el.style.transition = '';
      el.style.removeProperty('--sy'); el.classList.remove('is-snap');
    }

    function toggle(item) {
      var willOpen = !item.classList.contains('is-open');
      if (reduceMotion.matches) {
        items.forEach(function (o) { if (o !== item) setState(o, false); });
        setState(item, willOpen);
        return;
      }
      var targets = items.concat(followers);
      clearTimeout(cleanupTimer);
      var first = targets.map(function (el) { return el.getBoundingClientRect().top; }); // leitura no input
      var h0 = items.map(function (el) { return el.offsetHeight; });
      targets.forEach(function (el) { el.style.transition = 'none'; el.style.transform = ''; el.style.removeProperty('--sy'); });

      items.forEach(function (o) { if (o !== item) setState(o, false); });
      setState(item, willOpen);

      // 1) posição: quem mudou de lugar volta ao lugar antigo (translate3d) …
      var moved = [];
      targets.forEach(function (el, i) {
        var dy = first[i] - el.getBoundingClientRect().top;
        if (Math.abs(dy) > 0.5) { el.style.transform = 'translate3d(0,' + fx(dy) + 'px,0)'; moved.push(el); }
      });
      // 2) altura: a pele de quem abriu/fechou volta à altura antiga (scale3d), com a sombra junto
      var scaled = [];
      items.forEach(function (el, i) {
        var h1 = el.offsetHeight;
        if (h1 > 0 && Math.abs(h1 - h0[i]) > 0.5) {
          el.classList.add('is-snap');
          el.style.setProperty('--sy', (h0[i] / h1).toFixed(4));
          scaled.push(el);
        }
      });
      void doc.offsetHeight;                                 // aplica o estado inicial antes de animar

      // 3) … e tudo anima até o estado final
      moved.forEach(function (el) {
        el.style.transition = 'transform ' + DUR + 'ms ' + EASE;
        el.style.transform = 'translate3d(0,0,0)';
      });
      scaled.forEach(function (el) {
        el.classList.remove('is-snap');
        el.style.setProperty('--sy', '1');
      });
      cleanupTimer = setTimeout(function () { targets.forEach(clearInline); }, DUR + 60);
    }

    items.forEach(function (item) {
      item.querySelector('.faq__q').addEventListener('click', function () { toggle(item); });
    });
  })();

  /* ------------------------------------------------------------------------
     Ganhadores: abas (indicador só com transform), busca e paginação
     ------------------------------------------------------------------------ */
  (function () {
    var root = $('[data-winners]');
    var dataEl = document.getElementById('ganhadores-data');
    if (!root || !dataEl) return;

    var raw = {};
    try { raw = JSON.parse(dataEl.textContent); } catch (err) { return; }
    var data = {};
    Object.keys(raw).forEach(function (k) {
      var v = raw[k];
      if (Array.isArray(v)) data[k] = v;
      else if (v && v.modelo) { data[k] = []; for (var i = 0; i < (v.total || 0); i++) data[k].push(v.modelo); }
      else data[k] = [];
    });

    var tabs = $$('[data-tab]', root);
    var tabList = $('[data-tabs]', root);
    var tabIndicator = $('[data-tabs-indicator]', root);
    var rowsEl = $('[data-rows]', root);
    var emptyEl = $('[data-empty]', root);
    var pagEl = $('[data-pagination]', root);
    var search = $('[data-search]', root);
    var listTop = $('.lista', root);
    var state = { tab: '1', page: 1, query: '' };
    var tabBoxes = [];

    var norm = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); };
    var digits = function (s) { return String(s || '').replace(/\D/g, ''); };
    var initials = function (name) {
      var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
      return ((parts[0] || '')[0] || '').concat((parts[1] || '')[0] || '').toUpperCase();
    };
    var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var pageSize = function () { return mqTablet.matches ? 6 : 4; };

    function filtered() {
      var list = data[state.tab] || [];
      var q = norm(state.query), qd = digits(state.query);
      if (!q) return list;
      return list.filter(function (w) {
        return norm(w.nome).indexOf(q) > -1 || (qd && digits(w.cpf).indexOf(qd) > -1) || norm(w.cpf).indexOf(q) > -1;
      });
    }

    function render(animate) {
      var list = filtered();
      var size = pageSize();
      var pages = Math.max(1, Math.ceil(list.length / size));
      state.page = clamp(state.page, 1, pages);
      var slice = list.slice((state.page - 1) * size, state.page * size);

      var oldRows = $$('.linha', rowsEl);
      CenterHover.unobserve(oldRows); Live.unobserve(oldRows);
      rowsEl.style.setProperty('--rows', Math.max(1, Math.ceil(slice.length / 2)));
      rowsEl.innerHTML = slice.map(function (w, i) {
        return '<li class="linha' + (animate ? ' is-entering' : '') + '" style="--i:' + i + '" data-center-hover>' +
          '<span class="linha__ganhador"><span class="avatar" aria-hidden="true">' + esc(initials(w.nome)) + '</span>' +
          '<span class="linha__nome">' + esc(w.nome) + '</span></span>' +
          '<span class="linha__cpf">' + esc(w.cpf) + '</span>' +
          '<span class="linha__premio"><span class="chip"><img src="assets/icons/estrela.svg" width="14" height="14" alt="">' + esc(w.premio) + '</span></span>' +
          '</li>';
      }).join('');
      var rows = $$('.linha', rowsEl);
      CenterHover.observe(rows); Live.observe(rows);
      emptyEl.hidden = slice.length > 0;
      renderPagination(pages);
    }

    function pageList(total, cur) {
      if (total <= 5) return Array.from({ length: total }, function (_, i) { return i + 1; });
      if (cur <= 3) return [1, 2, 3, '…', total];
      if (cur >= total - 2) return [1, '…', total - 2, total - 1, total];
      return [1, '…', cur, '…', total];
    }

    function renderPagination(total) {
      var cur = state.page;
      var html = '<button class="pag pag--prev" type="button" data-page="' + (cur - 1) + '" aria-label="Página anterior"' + (cur <= 1 ? ' disabled' : '') + '><img src="assets/icons/chevron-esquerda.svg" width="20" height="20" alt=""></button>';
      pageList(total, cur).forEach(function (p) {
        if (p === '…') html += '<span class="pag__gap" aria-hidden="true">…</span>';
        else html += '<button class="pag' + (p === cur ? ' is-active' : '') + '" type="button" data-page="' + p + '"' + (p === cur ? ' aria-current="page"' : '') + ' aria-label="Página ' + p + '">' + p + '</button>';
      });
      html += '<button class="pag pag--next" type="button" data-page="' + (cur + 1) + '" aria-label="Próxima página"' + (cur >= total ? ' disabled' : '') + '><img src="assets/icons/chevron-direita.svg" width="20" height="20" alt=""></button>';
      pagEl.innerHTML = html;
    }

    // Tamanho do indicador só no resize (sem transição); o deslocamento é só transform
    onMeasure(function () {
      tabBoxes = tabs.map(function (t) { return { x: t.offsetLeft, y: t.offsetTop, w: t.offsetWidth, h: t.offsetHeight }; });
      if (!tabIndicator || !tabBoxes.length) return;
      tabIndicator.style.width = tabBoxes[0].w + 'px';
      tabIndicator.style.height = tabBoxes[0].h + 'px';
      placeIndicator(false);
    });
    function placeIndicator(animate) {
      var i = tabs.indexOf($('.aba.is-active', root));
      var b = tabBoxes[i];
      if (!b || !tabIndicator) return;
      if (!animate) tabIndicator.style.transition = 'none';
      tabIndicator.style.transform = 'translate3d(' + fx(b.x) + 'px,' + fx(b.y) + 'px,0) rotate(0.02deg)';
      if (!animate) { void tabIndicator.offsetWidth; tabIndicator.style.transition = ''; }
    }

    function selectTab(btn, focus) {
      tabs.forEach(function (t) {
        var on = t === btn;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      if (focus) btn.focus();
      state.tab = btn.getAttribute('data-tab');
      state.page = 1;
      placeIndicator(true);
      render(true);
    }

    tabs.forEach(function (t) { t.addEventListener('click', function () { if (!t.classList.contains('is-active')) selectTab(t); }); });
    tabList.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var n = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home') n = 0;
      if (e.key === 'End') n = tabs.length - 1;
      if (n !== null) { e.preventDefault(); selectTab(tabs[n], true); }
    });

    pagEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-page]');
      if (!b || b.disabled) return;
      state.page = parseInt(b.getAttribute('data-page'), 10);
      render(true);
      var top = docTop(listTop) - window.scrollY;
      if (top < L.header + 8) Anchor.to(window.scrollY + top - L.header - 120);
    });

    var debounce = 0;
    search.addEventListener('input', function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () { state.query = search.value; state.page = 1; render(true); }, 160);
    });

    var lastSize = pageSize();
    mqTablet.addEventListener('change', function () {
      var s = pageSize();
      if (s !== lastSize) { lastSize = s; render(false); }
    });

    render(false);
  })();

  /* ------------------------------------------------------------------------
     Popup "Ver exemplos" (<dialog> nativo)
     Modal central a partir do tablet; bottom sheet no mobile (arrastar o cabeçalho para baixo fecha).
     Só transform/opacity; o fechamento espera a animação antes do dialog.close().
     ------------------------------------------------------------------------ */
  var Popup = (function () {
    var dialogs = $$('[data-popup]');
    var canModal = typeof HTMLDialogElement === 'function' && typeof HTMLDialogElement.prototype.showModal === 'function';
    var current = null, trigger = null, closeTimer = 0;
    var D = { dlg: null, panel: null, fundo: null, id: -1, y0: 0, dy: 0, lastY: 0, lastT: 0, v: 0, h: 1 };

    function open(dlg, from) {
      if (!dlg || current) return;
      clearTimeout(closeTimer);
      current = dlg; trigger = from || document.activeElement;
      Wheel.stop();
      doc.classList.add('is-locked');
      dlg.classList.remove('is-open', 'is-dragging');
      if (canModal) dlg.showModal(); else dlg.setAttribute('open', '');
      var panel = $('[data-popup-panel]', dlg); if (panel) panel.scrollTop = 0; dlg.scrollTop = 0;
      requestAnimationFrame(function () { requestAnimationFrame(function () { if (current === dlg) dlg.classList.add('is-open'); }); });
    }
    function finish(dlg) {
      if (canModal) { if (dlg.open) dlg.close(); } else dlg.removeAttribute('open');
      doc.classList.remove('is-locked');
      Wheel.sync();
      if (trigger && trigger.focus) trigger.focus({ preventScroll: true });
      trigger = null;
    }
    function close() {
      if (!current) return;
      var dlg = current; current = null;
      endDrag(false);
      dlg.classList.remove('is-open');
      closeTimer = setTimeout(function () { finish(dlg); }, reduceMotion.matches ? 0 : 600);
    }

    // Arrastar para fechar (mobile): manipulação direta 1:1, sem transição durante o gesto
    function dragTask() {
      if (!D.dlg) return false;
      D.panel.style.transform = 'translate3d(0,' + fx(D.dy) + 'px,0)';
      D.fundo.style.opacity = fx(1 - clamp(D.dy / D.h, 0, 1) * 0.8);
      return false;
    }
    function startDrag(e, dlg) {
      if (mqTablet.matches || e.button > 0 || current !== dlg || !dlg.classList.contains('is-open')) return;
      D.dlg = dlg; D.panel = $('[data-popup-panel]', dlg); D.fundo = $('.popup__fundo', dlg);
      D.id = e.pointerId; D.y0 = D.lastY = e.clientY; D.lastT = e.timeStamp; D.dy = 0; D.v = 0;
      D.h = D.panel.offsetHeight || 1;                     // leitura de layout só no pointerdown
      dlg.classList.add('is-dragging');
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* ponteiro sintético */ }
    }
    function moveDrag(e) {
      if (!D.dlg || e.pointerId !== D.id) return;
      var dt = Math.max(1, e.timeStamp - D.lastT);
      D.v = D.v * 0.6 + ((e.clientY - D.lastY) / dt) * 0.4; // px/ms, suavizado
      D.lastY = e.clientY; D.lastT = e.timeStamp;
      D.dy = Math.max(0, e.clientY - D.y0);
      Scene.add(dragTask);
    }
    function endDrag(release) {
      if (!D.dlg) return;
      var dlg = D.dlg, dismiss = release && (D.dy > D.h * 0.25 || (D.v > 0.5 && D.dy > 24));
      D.dlg = null; D.id = -1;
      dlg.classList.remove('is-dragging');
      D.panel.style.transform = ''; D.fundo.style.opacity = '';  // volta (ou segue) pela transição do CSS
      if (dismiss) close();
    }

    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-popup-open]');
      if (t) { e.preventDefault(); open(document.getElementById(t.getAttribute('data-popup-open')), t); return; }
      if (current && e.target.closest('[data-popup-close]')) { e.preventDefault(); close(); }
    });
    if (!canModal) document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && current) close(); });
    dialogs.forEach(function (dlg) {
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(); });   // ESC anima antes de fechar
      dlg.addEventListener('close', function () {                                       // fechamento forçado pelo navegador
        if (current !== dlg) return;
        current = null; endDrag(false); dlg.classList.remove('is-open'); finish(dlg);
      });
      var handle = $('[data-popup-drag]', dlg);
      if (!handle) return;
      handle.addEventListener('pointerdown', function (e) { startDrag(e, dlg); });
      handle.addEventListener('pointermove', moveDrag);
      handle.addEventListener('pointerup', function (e) { if (e.pointerId === D.id) endDrag(true); });
      handle.addEventListener('pointercancel', function (e) { if (e.pointerId === D.id) endDrag(false); });
    });
    mqTablet.addEventListener('change', function () { endDrag(false); });
    return { open: open, close: close };
  })();

  /* ------------------------------------------------------------------------
     Inicialização: medições (resize, mudanças de altura da página, fontes, load)
     ------------------------------------------------------------------------ */
  var measureQueued = false;
  function queueMeasure() {
    if (measureQueued) return;
    measureQueued = true;
    requestAnimationFrame(function () { measureQueued = false; measure(); });
  }
  window.addEventListener('resize', queueMeasure);
  window.addEventListener('load', queueMeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueMeasure);
  if ('ResizeObserver' in window) new ResizeObserver(queueMeasure).observe(document.body);

  measure();
  setActive(activeId);
})();
