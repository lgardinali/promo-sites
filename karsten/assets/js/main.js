/* ==========================================================================
   Natal Karsten 2026 — interações e movimento
   JS nativo, zero dependências.

   Regras de fluidez aplicadas:
   · camada de GPU ligada pela visibilidade (.is-live via IntersectionObserver)
   · translate3d/scale3d + rotate(0.02deg) em movimento (exceto texto e caixas que recortam
     uma foto de borda a borda: girada, a borda vira um fio entre as seções; em repouso, transform: none)
   · suavização do ponteiro em dois estágios normalizada pelo tempo
   · um único requestAnimationFrame para a cena; leituras de layout só em resize/load
   · transition para estados (hover, abrir/fechar), rAF para movimento contínuo
   ========================================================================== */
(() => {
  'use strict';

  const doc = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const kf = (base, dt) => 1 - Math.pow(1 - base, dt / 16.667); // fator normalizado por frame

  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqHover = matchMedia('(hover: hover) and (pointer: fine)');
  const mqTouch = matchMedia('(hover: none)');
  const mqFine = matchMedia('(pointer: fine)');
  const mqDesktopNav = matchMedia('(min-width: 1200px)');

  let reduced = mqReduce.matches;
  const ampFor = w => (w >= 1024 ? 1 : w >= 768 ? 0.82 : 0.5);
  const state = { vw: innerWidth, vh: innerHeight, y: scrollY, amp: ampFor(innerWidth) };

  /* ------------------------------------------------------------------------
     Cena: um único rAF que roda enquanto houver movimento
     ------------------------------------------------------------------------ */
  const Scene = (() => {
    const jobs = [];
    let raf = 0;
    let last = 0;
    const tick = now => {
      const dt = clamp(now - last, 1, 100);
      last = now;
      let busy = false;
      for (let i = 0; i < jobs.length; i++) if (jobs[i](dt, now)) busy = true;
      raf = busy ? requestAnimationFrame(tick) : 0;
    };
    return {
      add(fn) { jobs.push(fn); },
      kick() {
        if (raf) return;
        last = performance.now();
        raf = requestAnimationFrame(tick);
      },
    };
  })();

  /* ------------------------------------------------------------------------
     Scroll suave
     · Detecta se o navegador JÁ suaviza a roda do mouse: no 1º giro deixamos
       o scroll nativo acontecer e contamos em quantos frames a posição muda.
       Mais atualizações que eventos de roda = suavização nativa → mantém nativo.
     · Touch, trackpad (deltas pequenos/inerciais) e movimento reduzido: nativo.
     · html { scroll-behavior: auto } + scrollTo({behavior:'instant'}) evitam
       que um smooth do CSS brigue com o loop.
     ------------------------------------------------------------------------ */
  const Scroll = (() => {
    let mode = 'detect';
    let probing = false;
    let probeWheels = 0;
    let target = scrollY;
    let current = scrollY;
    let wheeling = false;
    let tween = null;
    let max = 0;
    let locked = false;

    const enabled = () => !reduced && mqFine.matches;
    const measure = () => { max = Math.max(0, doc.scrollHeight - innerHeight); };
    const write = y => {
      window.scrollTo({ top: y, left: 0, behavior: 'instant' });
      state.y = y;
    };
    const delta = e => {
      if (e.deltaMode === 1) return e.deltaY * 40;
      if (e.deltaMode === 2) return e.deltaY * innerHeight * 0.9;
      return e.deltaY;
    };
    const looksLikeTrackpad = e =>
      e.deltaMode === 0 && (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.5 || Math.abs(e.deltaY) < 40);

    const probe = () => {
      probeWheels++;
      if (probing) return;
      probing = true;
      let frames = 0;
      let changes = 0;
      let lastY = scrollY;
      const step = () => {
        const y = scrollY;
        if (y !== lastY) { changes++; lastY = y; }
        if (++frames < 16) { requestAnimationFrame(step); return; }
        probing = false;
        if (changes > 0) {
          mode = changes > probeWheels ? 'native' : 'smooth';
          doc.dataset.scroll = mode;
        }
        probeWheels = 0;
      };
      requestAnimationFrame(step);
    };

    const stop = () => {
      tween = null;
      wheeling = false;
      current = target = scrollY;
    };

    addEventListener('wheel', e => {
      if (!enabled() || e.ctrlKey || locked || e.defaultPrevented) return;
      tween = null;
      if (mode === 'native') return;
      if (e.target.closest && e.target.closest('[data-menu]')) return;
      const trackpad = looksLikeTrackpad(e);
      if (mode === 'detect') {
        if (!trackpad) probe();
        return;
      }
      if (trackpad && !wheeling) return;
      e.preventDefault();
      if (!wheeling) current = target = scrollY;
      target = clamp(target + delta(e), 0, max);
      wheeling = true;
      Scene.kick();
    }, { passive: false });

    addEventListener('keydown', e => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) stop();
    }, { passive: true });
    addEventListener('pointerdown', stop, { passive: true });
    addEventListener('touchstart', stop, { passive: true });

    Scene.add((dt, now) => {
      if (tween) {
        const p = Math.min(1, (now - tween.t0) / tween.dur);
        const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p); // ease-out expo
        const y = tween.from + (tween.to - tween.from) * e;
        write(y);
        if (p === 1) { tween = null; current = target = y; return false; }
        return true;
      }
      if (!wheeling) return false;
      current += (target - current) * kf(0.1, dt);
      if (Math.abs(target - current) < 0.35) { current = target; wheeling = false; }
      write(current);
      return wheeling;
    });

    return {
      measure,
      stop,
      lock(v) { locked = v; if (v) stop(); },
      sync() { if (!wheeling && !tween) current = target = scrollY; },
      to(y) {
        y = clamp(y, 0, max || Math.max(0, doc.scrollHeight - innerHeight));
        if (reduced) { write(y); return; }
        wheeling = false;
        const from = scrollY;
        const dist = Math.abs(y - from);
        if (dist < 1) return;
        tween = { from, to: y, t0: performance.now(), dur: clamp(dist * 0.42, 650, 1500) };
        Scene.kick();
      },
    };
  })();

  /* ------------------------------------------------------------------------
     Visibilidade → camada de GPU (.is-live) e pausa de loops fora da tela
     ------------------------------------------------------------------------ */
  const dustAnims = [];
  const liveIO = new IntersectionObserver(entries => {
    for (const e of entries) {
      e.target.classList.toggle('is-live', e.isIntersecting);
      if (e.target.classList.contains('kv')) dustAnims.forEach(a => (e.isIntersecting ? a.play() : a.pause()));
      if (e.isIntersecting) Scene.kick();
    }
  }, { rootMargin: '20% 0px 20% 0px' });
  $$('[data-live]').forEach(el => liveIO.observe(el));

  /* ------------------------------------------------------------------------
     Intro do KV + menu
     ------------------------------------------------------------------------ */
  const kvImg = $('.kv__img');
  let isReady = false;
  const ready = () => {
    if (isReady) return;
    isReady = true;
    requestAnimationFrame(() => requestAnimationFrame(() => doc.classList.add('is-ready')));
  };
  if (!kvImg || reduced || (kvImg.complete && kvImg.naturalWidth)) ready();
  else {
    kvImg.addEventListener('load', ready, { once: true });
    kvImg.addEventListener('error', ready, { once: true });
  }
  setTimeout(ready, 2200);

  /* Poeira dourada do KV: Web Animations com valores literais por partícula
     (transform/opacity no compositor, sem var() nos keyframes) */
  const dustLayer = $('[data-kv-dust]');
  if (dustLayer && !reduced && 'animate' in Element.prototype) {
    const n = state.vw >= 1024 ? 26 : state.vw >= 768 ? 18 : 12;
    const frag = document.createDocumentFragment();
    const r = Math.random;
    const specs = [];
    for (let i = 0; i < n; i++) {
      const d = document.createElement('span');
      d.className = 'dust';
      d.style.cssText = `--x:${(6 + r() * 88).toFixed(2)}%;--y:${(4 + r() * 60).toFixed(2)}%;--s:${(2 + r() * 3.2).toFixed(2)}px`;
      frag.appendChild(d);
      specs.push({ d, o: 0.25 + r() * 0.45, dx: (r() - 0.5) * 50, dy: -30 - r() * 60, t: 7000 + r() * 7000, delay: r() * 14000 });
    }
    dustLayer.appendChild(frag);
    const at = (s, p) => `translate3d(${(s.dx * p).toFixed(3)}px,${(s.dy * p).toFixed(3)}px,0) scale3d(${0.5 + 0.5 * p},${0.5 + 0.5 * p},1) rotate(0.02deg)`;
    specs.forEach(s => {
      dustAnims.push(s.d.animate([
        { offset: 0, opacity: 0, transform: at(s, 0), easing: 'ease-in-out' },
        { offset: 0.25, opacity: s.o, transform: at(s, 0.25), easing: 'ease-in-out' },
        { offset: 0.7, opacity: s.o, transform: at(s, 0.7), easing: 'ease-in-out' },
        { offset: 1, opacity: 0, transform: at(s, 1) },
      ], { duration: s.t, delay: -s.delay, iterations: Infinity }));
    });
  }

  /* ------------------------------------------------------------------------
     Revelação no scroll (transition por estado, disparada uma vez)
     ------------------------------------------------------------------------ */
  $$('[data-stagger]').forEach(group => {
    const step = parseFloat(group.dataset.stagger) || 80;
    $$('[data-reveal]', group).forEach((el, i) => {
      if (!el.style.getPropertyValue('--rd')) el.style.setProperty('--rd', `${i * step}ms`);
    });
  });
  const revealEls = $$('[data-reveal]');
  if (reduced || !('IntersectionObserver' in window)) {
    revealEls.forEach(el => el.classList.add('is-in'));
  } else {
    // Alvos totalmente recortados por clip-path ("mask") não intersectam: observa o pai
    const triggers = new Map();
    revealEls.forEach(el => {
      const t = el.dataset.reveal === 'mask' ? el.parentElement : el;
      if (!triggers.has(t)) triggers.set(t, []);
      triggers.get(t).push(el);
    });
    const revealIO = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        triggers.get(e.target).forEach(el => el.classList.add('is-in'));
        revealIO.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    triggers.forEach((_, t) => revealIO.observe(t));
  }

  /* ------------------------------------------------------------------------
     Movimento contínuo: parallax do KV + ponteiro (2 estágios)
     ------------------------------------------------------------------------ */
  const kv = $('.kv');
  const kvMedia = $('[data-kv-media]');
  const premio = $('.premio');
  const tilt = $('[data-tilt]');
  let kvH = kv ? kv.offsetHeight : 0;
  let tiltOn = mqHover.matches && state.vw >= 768;

  const m = { kvC: 0, tx: 0, ty: 0, sx: 0, sy: 0, cx: 0, cy: 0 };
  const written = {};
  const put = (el, key, val) => {
    if (!el || written[key] === val) return;
    written[key] = val;
    el.style.transform = val;
  };

  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || reduced) return;
    m.tx = (e.clientX / state.vw) * 2 - 1;
    m.ty = (e.clientY / state.vh) * 2 - 1;
    Scene.kick();
  }, { passive: true });
  doc.addEventListener('mouseleave', () => { m.tx = 0; m.ty = 0; Scene.kick(); });

  Scene.add(dt => {
    if (reduced) return false;
    const f = dt / 16.667;

    // scroll → parallax do KV (estágio único, suaviza o atraso entre compositor e main thread)
    const kvT = Math.min(state.y, kvH);
    m.kvC += (kvT - m.kvC) * (1 - Math.pow(1 - 0.2, f));
    let busy = Math.abs(kvT - m.kvC) > 0.01;
    if (!busy) m.kvC = kvT;

    // ponteiro → dois estágios em cascata (velocidade contínua, sem "escada")
    const k1 = 1 - Math.pow(1 - 0.14, f);
    const k2 = 1 - Math.pow(1 - 0.075, f);
    m.sx += (m.tx - m.sx) * k1; m.sy += (m.ty - m.sy) * k1;
    m.cx += (m.sx - m.cx) * k2; m.cy += (m.sy - m.cy) * k2;
    const moving =
      Math.abs(m.tx - m.cx) > 0.0005 || Math.abs(m.ty - m.cy) > 0.0005 ||
      Math.abs(m.tx - m.sx) > 0.0005 || Math.abs(m.ty - m.sy) > 0.0005;
    if (!moving) { m.sx = m.cx = m.tx; m.sy = m.cy = m.ty; }
    busy = busy || moving;

    const amp = state.amp;
    if (kv && kv.classList.contains('is-live')) {
      // sem micro-rotação: é a caixa que recorta a foto; girada, a borda superior deixaria um fio sob o menu
      put(kvMedia, 'kv', `translate3d(0,${(m.kvC * 0.22).toFixed(3)}px,0)`);
      put(dustLayer, 'dust',
        `translate3d(${(m.cx * -16 * amp).toFixed(3)}px,${(m.kvC * -0.12 + m.cy * -10 * amp).toFixed(3)}px,0) rotate(0.02deg)`);
    }
    if (tilt && premio && premio.classList.contains('is-live')) {
      const x = tiltOn ? m.cx * 14 * amp : 0;
      const y = tiltOn ? m.cy * 9 * amp : 0;
      const r = tiltOn ? m.cx * 0.6 : 0;
      put(tilt, 'tilt', `translate3d(${x.toFixed(3)}px,${y.toFixed(3)}px,0) rotate(${(0.02 + r).toFixed(3)}deg)`);
    }
    return busy;
  });

  /* ------------------------------------------------------------------------
     Menu: esconde ao descer, volta ao subir · menu mobile · scroll-spy
     ------------------------------------------------------------------------ */
  const header = $('[data-header]');
  const toggle = $('[data-menu-toggle]');
  const menu = $('[data-menu]');
  const overlay = $('[data-menu-overlay]');
  let menuOpen = false;
  let lastY = scrollY;

  const onScroll = () => {
    const y = scrollY;
    state.y = y;
    const dy = y - lastY;
    if (!menuOpen) {
      if (y < 200) header.classList.remove('is-hidden');
      else if (dy > 8) header.classList.add('is-hidden');
      else if (dy < -8) header.classList.remove('is-hidden');
    }
    if (Math.abs(dy) > 8 || y < 200) lastY = y;
    header.classList.toggle('is-scrolled', y > 8);
    Scroll.sync();
    Scene.kick();
  };
  addEventListener('scroll', onScroll, { passive: true });
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));

  const setMenu = (open, { focus = true } = {}) => {
    menuOpen = open;
    menu.classList.toggle('is-open', open);
    overlay.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    menu.inert = !open;
    doc.classList.toggle('is-locked', open);
    Scroll.lock(open);
    header.classList.remove('is-hidden');
    if (!focus) return;
    if (open) setTimeout(() => { const a = $('a', menu); if (a) a.focus({ preventScroll: true }); }, 80);
    else toggle.focus({ preventScroll: true });
  };
  if (toggle && menu) {
    toggle.addEventListener('click', () => setMenu(!menuOpen));
    overlay.addEventListener('click', () => setMenu(false));
    addEventListener('keydown', e => {
      if (!menuOpen) return;
      if (e.key === 'Escape') { setMenu(false); return; }
      if (e.key !== 'Tab') return;
      const items = [toggle, ...$$('a', menu)];
      const i = items.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
    });
    mqDesktopNav.addEventListener('change', e => { if (e.matches && menuOpen) setMenu(false, { focus: false }); });
  }

  // Âncoras com scroll suave próprio
  const goTo = el => {
    const top = el.getBoundingClientRect().top + scrollY;
    const y = el.id === 'home' ? 0 : top - (top < scrollY ? header.offsetHeight : 0);
    Scroll.to(y);
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const el = id && document.getElementById(id);
    e.preventDefault(); // "#" e placeholders (ex.: #cadastro) não pulam para o topo
    if (!el) return;
    if (menuOpen) setMenu(false, { focus: false });
    goTo(el);
    if (history.replaceState) history.replaceState(null, '', id === 'home' ? location.pathname + location.search : `#${id}`);
  });

  // Scroll-spy
  const spyLinks = $$('[data-spy]');
  const menuLinks = $$('.menu__link');
  const setActive = id => {
    spyLinks.forEach(l => {
      const on = l.dataset.spy === id;
      l.classList.toggle('is-active', on);
      if (on) l.setAttribute('aria-current', 'location'); else l.removeAttribute('aria-current');
    });
    menuLinks.forEach(l => l.classList.toggle('is-active', l.getAttribute('href') === `#${id}`));
  };
  const spyIO = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('[data-section]').forEach(s => spyIO.observe(s));

  /* ------------------------------------------------------------------------
     Mobile: o que está no centro da tela recebe o "hover" (.is-active)
     ------------------------------------------------------------------------ */
  let centerIO = null;
  const setupCenter = () => {
    if (centerIO) centerIO.disconnect();
    centerIO = null;
    const els = $$('[data-center]');
    els.forEach(el => el.classList.remove('is-active'));
    if (!mqTouch.matches || reduced) return;
    centerIO = new IntersectionObserver(entries => {
      for (const e of entries) e.target.classList.toggle('is-active', e.isIntersecting);
    }, { rootMargin: '-44% 0px -44% 0px' });
    els.forEach(el => centerIO.observe(el));
  };
  setupCenter();
  mqTouch.addEventListener('change', setupCenter);

  /* ------------------------------------------------------------------------
     Botões: press 50ms / release 300ms (protótipo do componente Botão)
     ------------------------------------------------------------------------ */
  $$('.btn-press').forEach(b => {
    let t = 0;
    const down = () => { clearTimeout(t); b.classList.remove('is-release'); b.classList.add('is-pressed'); };
    const up = () => {
      if (!b.classList.contains('is-pressed')) return;
      b.classList.remove('is-pressed');
      b.classList.add('is-release');
      t = setTimeout(() => b.classList.remove('is-release'), 320);
    };
    b.addEventListener('pointerdown', down);
    ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(ev => b.addEventListener(ev, up));
    b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') down(); });
    b.addEventListener('keyup', up);
  });

  /* ------------------------------------------------------------------------
     FAQ: acordeão (ease-out 300ms, como no protótipo)
     ------------------------------------------------------------------------ */
  let remeasureT = 0;
  $$('.faq-item').forEach(item => {
    const btn = $('.faq-item__btn', item);
    const panel = $('.faq-item__panel', item);
    const sync = open => {
      btn.setAttribute('aria-expanded', String(open));
      panel.inert = !open;
    };
    sync(item.classList.contains('is-open'));
    btn.addEventListener('click', () => {
      const open = !item.classList.contains('is-open');
      item.classList.toggle('is-open', open);
      sync(open);
      clearTimeout(remeasureT);
      remeasureT = setTimeout(measure, 360);
    });
  });

  /* ------------------------------------------------------------------------
     Medidas (somente em resize/load — nunca dentro do frame)
     ------------------------------------------------------------------------ */
  function measure() {
    state.vw = innerWidth;
    state.vh = innerHeight;
    state.amp = ampFor(state.vw);
    state.y = scrollY;
    kvH = kv ? kv.offsetHeight : 0;
    tiltOn = mqHover.matches && state.vw >= 768;
    Scroll.measure();
    Scene.kick();
  }
  let resizeT = 0;
  const queueMeasure = () => { clearTimeout(resizeT); resizeT = setTimeout(measure, 120); };
  addEventListener('resize', queueMeasure, { passive: true });
  addEventListener('load', measure);
  if ('ResizeObserver' in window) new ResizeObserver(queueMeasure).observe(document.body);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  measure();

  /* Movimento reduzido ligado/desligado em tempo real */
  mqReduce.addEventListener('change', e => {
    reduced = e.matches;
    if (reduced) {
      Scroll.stop();
      dustAnims.forEach(a => a.cancel());
      revealEls.forEach(el => el.classList.add('is-in'));
      [kvMedia, dustLayer, tilt].forEach(el => { if (el) el.style.transform = ''; });
      Object.keys(written).forEach(k => delete written[k]);
    }
    setupCenter();
    Scene.kick();
  });
})();
