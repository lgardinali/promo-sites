/* ==========================================================================
   Assinado & Garantido · Seguradora ALM — interações e movimento
   JS nativo, zero dependências.

   Regras de fluidez aplicadas:
   · camada de GPU ligada pela visibilidade (.is-live via IntersectionObserver), nunca pelo movimento
   · translate3d/scale3d + rotate(0.02deg) no que se move por frame (texto: só translate3d)
   · suavização do ponteiro em dois estágios normalizada pelo tempo
   · um único requestAnimationFrame para a cena; leituras de layout só em resize/load/pointerdown
   · transition para estados (hover, abrir/fechar), rAF para movimento contínuo — nunca no mesmo elemento
   · amplitude por breakpoint: ×1 desktop · ×0,82 tablet · ×0,5 mobile
   · prefers-reduced-motion: loops desligados, tudo na posição final
   ========================================================================== */
(() => {
  'use strict';

  const doc = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const kf = (base, dt) => 1 - Math.pow(1 - base, dt / 16.667); // fator normalizado por frame
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqMouse = matchMedia('(hover: hover) and (pointer: fine)');
  const mqTouch = matchMedia('(hover: none)');
  const mqDesktopNav = matchMedia('(min-width: 1080px)');

  let reduced = mqReduce.matches;
  const ampFor = w => (w >= 1080 ? 1 : w >= 600 ? 0.82 : 0.5);
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
     · Antes de suavizar, mede se o navegador JÁ suaviza a roda do mouse
       (Edge/Chrome com "smooth scrolling", Firefox…): no 1º giro o scroll
       nativo acontece e contamos em quantos frames a posição muda. Mais
       atualizações que eventos de roda = suavização nativa → fica nativo.
     · Touch, trackpad (deltas pequenos/inerciais) e movimento reduzido: nativo.
     · html { scroll-behavior: auto } + scrollTo({behavior:'instant'}) evitam
       que um smooth do CSS/navegador brigue com o loop.
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

    const enabled = () => !reduced && mqMouse.matches;
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
      if (e.target.closest && e.target.closest('[data-menu], .modal__box')) return;
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
  const decoAnims = [];
  const liveIO = new IntersectionObserver(entries => {
    for (const e of entries) {
      e.target.classList.toggle('is-live', e.isIntersecting);
      if (e.target.classList.contains('kv')) decoAnims.forEach(a => (e.isIntersecting ? a.play() : a.pause()));
      if (e.isIntersecting) Scene.kick();
    }
  }, { rootMargin: '20% 0px 20% 0px' });
  $$('[data-live]').forEach(el => liveIO.observe(el));

  /* ------------------------------------------------------------------------
     Revelação no scroll (transition por estado, disparada uma vez).
     Ao terminar, o atributo sai e o elemento volta às transitions de hover.
     ------------------------------------------------------------------------ */
  $$('[data-stagger]').forEach(group => {
    const step = parseFloat(group.dataset.stagger) || 80;
    $$(':scope > [data-reveal], :scope > * > [data-reveal]', group).forEach((el, i) => {
      if (!el.style.getPropertyValue('--rd')) el.style.setProperty('--rd', `${i * step}ms`);
    });
  });
  const revealEls = $$('[data-reveal]');
  const settle = el => {
    const done = () => { el.removeAttribute('data-reveal'); el.classList.remove('is-in'); el.style.removeProperty('--rd'); };
    const delay = parseFloat(el.style.getPropertyValue('--rd')) || 0;
    setTimeout(done, delay + 1100);
  };
  if (reduced || !('IntersectionObserver' in window)) {
    revealEls.forEach(el => el.removeAttribute('data-reveal'));
  } else {
    const revealIO = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        settle(e.target);
        revealIO.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealEls.forEach(el => revealIO.observe(el));
  }

  /* ------------------------------------------------------------------------
     Intro (menu + KV) quando a foto principal estiver pronta
     ------------------------------------------------------------------------ */
  const heroImg = $('.ha-homem img');
  let isReady = false;
  const ready = () => {
    if (isReady) return;
    isReady = true;
    requestAnimationFrame(() => requestAnimationFrame(() => doc.classList.add('is-ready')));
  };
  if (!heroImg || reduced || (heroImg.complete && heroImg.naturalWidth)) ready();
  else {
    heroImg.addEventListener('load', ready, { once: true });
    heroImg.addEventListener('error', ready, { once: true });
  }
  setTimeout(ready, 2200);

  /* ------------------------------------------------------------------------
     Menu: esconde ao descer, volta ao subir · menu mobile · âncoras · scroll-spy
     ------------------------------------------------------------------------ */
  const header = $('[data-header]');
  const toggle = $('[data-menu-toggle]');
  const menu = $('[data-menu]');
  const overlay = $('[data-menu-overlay]');
  let menuOpen = false;
  let lastY = scrollY;
  let modalOpen = false;

  const progress = $('[data-progress]');
  const toTop = $('[data-totop]');

  const onScroll = () => {
    const y = scrollY;
    state.y = y;
    const dy = y - lastY;
    if (header && !menuOpen && !modalOpen) {
      if (y < 200) header.classList.remove('is-hidden');
      else if (dy > 8) header.classList.add('is-hidden');
      else if (dy < -8) header.classList.remove('is-hidden');
    }
    if (Math.abs(dy) > 8 || y < 200) lastY = y;
    if (header) header.classList.toggle('is-scrolled', y > 8);
    if (toTop) toTop.classList.toggle('is-visible', y > 700);
    Scroll.sync();
    Scene.kick();
  };
  addEventListener('scroll', onScroll, { passive: true });
  if (header) header.addEventListener('focusin', () => header.classList.remove('is-hidden'));

  const setMenu = (open, { focus = true } = {}) => {
    if (!menu) return;
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
    const hh = header ? header.offsetHeight : 0;
    const y = el.id === 'home' ? 0 : top - (top < scrollY ? hh : 0) - (el.dataset.offset ? parseFloat(el.dataset.offset) : 0);
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
  // chegada por link com âncora (ex.: regulamento.html#s5)
  if (location.hash && location.hash.length > 1) {
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el) addEventListener('load', () => setTimeout(() => {
      const top = el.getBoundingClientRect().top + scrollY - (header ? header.offsetHeight : 0) - 16;
      window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
    }, 60), { once: true });
  }

  // Scroll-spy (menu)
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
  if (spyLinks.length) {
    const spyIO = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('[data-section]').forEach(s => spyIO.observe(s));
  }

  /* ------------------------------------------------------------------------
     Toque: o que está no centro da tela recebe o "hover" (.is-active)
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
    }, { rootMargin: '-42% 0px -42% 0px' });
    els.forEach(el => centerIO.observe(el));
  };
  setupCenter();
  mqTouch.addEventListener('change', setupCenter);

  /* ------------------------------------------------------------------------
     Botões: press 50ms / release 300ms
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
     Acordeões (Dúvidas: ease-out 300ms · Sumário do regulamento: ease-out 250ms)
     ------------------------------------------------------------------------ */
  let remeasureT = 0;
  const queueRemeasure = () => { clearTimeout(remeasureT); remeasureT = setTimeout(measure, 360); };
  $$('.faq').forEach(item => {
    const btn = $('.faq__btn', item);
    const panel = $('.faq__panel', item);
    const sync = open => { btn.setAttribute('aria-expanded', String(open)); panel.inert = !open; };
    sync(item.classList.contains('is-open'));
    btn.addEventListener('click', () => {
      const open = !item.classList.contains('is-open');
      item.classList.toggle('is-open', open);
      sync(open);
      queueRemeasure();
    });
  });

  /* ------------------------------------------------------------------------
     Overlay "Produtos participantes"
     ------------------------------------------------------------------------ */
  $$('[data-modal]').forEach(modal => {
    const box = $('.modal__box', modal);
    let opener = null;
    const set = open => {
      modalOpen = open;
      modal.classList.toggle('is-open', open);
      modal.inert = !open;
      doc.classList.toggle('is-locked', open);
      Scroll.lock(open);
      if (open) { setTimeout(() => box.focus({ preventScroll: true }), 30); }
      else if (opener) opener.focus({ preventScroll: true });
    };
    $$(`[data-modal-open="${modal.id}"]`).forEach(b => b.addEventListener('click', () => { opener = b; set(true); }));
    $$('[data-modal-close]', modal).forEach(b => b.addEventListener('click', () => set(false)));
    addEventListener('keydown', e => {
      if (!modal.classList.contains('is-open')) return;
      if (e.key === 'Escape') { set(false); return; }
      if (e.key !== 'Tab') return;
      const items = $$('button, a[href]', box);
      const i = items.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && (i === items.length - 1 || i === -1)) { e.preventDefault(); items[0].focus(); }
    });
  });

  /* ------------------------------------------------------------------------
     Carrossel de prêmios
     · posição do trilho por rAF com mola criticamente amortecida (sem
       transition no trilho): sai e chega suave, pode ser interrompida e
       redirecionada no meio sem "resetar"
     · arrastar 1:1 (mouse e toque); ao soltar, a velocidade do gesto vira
       impulso da mola e a página escolhida é a mais próxima da projeção
     · em movimento: micro-rotação (subpixel); parado: posição inteira (texto nítido)
     · cards fora da janela somem com fade; a janela recorta com folga lateral
       para não cortar o que sai do card (ex.: o avião do maior prêmio)
     · hover do componente (625ms "Slow"); no toque, os cards visíveis
       acendem quando o carrossel chega ao centro da tela
     ------------------------------------------------------------------------ */
  const Carousel = (() => {
    const car = $('[data-carousel]');
    if (!car) return null;
    const win = $('[data-window]', car);
    const track = $('[data-track]', car);
    const cards = $$('.premio', track);
    const prev = $('[data-prev]', car);
    const next = $('[data-next]', car);
    const dotsWrap = $('[data-dots]', car);
    const OMEGA = 10; // rigidez da mola crítica (ω): assenta em ~0,65 s
    let per = 4, cw = 302, step = 326, winW = 1280, index = 0, positions = [0], inView = false, fade = true, lastKey = '';
    const sp = { x: 0, v: 0, to: 0, run: false };
    let drag = null, dragDirty = false;
    const activeTimers = [];
    const outState = cards.map(() => null);

    const page = () => Math.max(0, positions.indexOf(index));
    const write = (x, moving) => {
      track.style.transform = moving
        ? `translate3d(${x.toFixed(3)}px,0,0) rotate(0.02deg)`
        : `translate3d(${Math.round(x)}px,0,0)`;
    };
    /* Sem recorte: a opacidade de cada card é proporcional à distância que falta até a
       sua vaga na página visível, ao longo de um passo inteiro (card + espaço):
       · o card que entra começa a aparecer no primeiro pixel de movimento;
       · o que sai vai sumindo devagar, na mesma proporção, até 1 passo fora (0%).
       Escrita no mesmo frame do movimento (rAF): nada é cortado. */
    const updateVis = x => {
      for (let i = 0; i < cards.length; i++) {
        let o = 1;
        if (fade) {
          const left = i * step + x, right = left + cw;
          const dist = Math.max(0, -left) + Math.max(0, right - winW);
          o = 1 - clamp(dist / step, 0, 1);
        }
        const prev = outState[i];
        if (prev === null || Math.abs(prev - o) > 0.002 || (o === 0) !== (prev === 0) || (o === 1) !== (prev === 1)) {
          outState[i] = o;
          cards[i].style.opacity = o >= 1 ? '' : o.toFixed(3);
          cards[i].classList.toggle('is-out', o < 0.05);
        }
      }
    };
    const buildDots = () => {
      if (dotsWrap.children.length === positions.length) return;
      dotsWrap.textContent = '';
      positions.forEach((_, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'carousel__dot';
        b.setAttribute('aria-label', `Ir para o grupo ${i + 1} de ${positions.length}`);
        b.addEventListener('click', () => go(i));
        dotsWrap.appendChild(b);
      });
    };
    const lightCards = () => {
      activeTimers.forEach(clearTimeout);
      activeTimers.length = 0;
      const touch = mqTouch.matches && !reduced;
      cards.forEach((c, i) => {
        const on = touch && inView && i >= index && i < index + per;
        if (!on) { c.classList.remove('is-active'); return; }
        activeTimers.push(setTimeout(() => c.classList.add('is-active'), 260 + (i - index) * 140));
      });
    };
    const syncUI = () => {
      const p = page();
      prev.disabled = p === 0;
      next.disabled = p === positions.length - 1;
      $$('.carousel__dot', dotsWrap).forEach((d, i) => d.setAttribute('aria-current', String(i === p)));
      cards.forEach((c, i) => c.setAttribute('aria-hidden', String(!(i >= index && i < index + per))));
      lightCards();
    };
    const animateTo = (p, v0) => {
      index = positions[clamp(p, 0, positions.length - 1)];
      sp.to = -index * step;
      if (typeof v0 === 'number') sp.v = v0;
      dragDirty = false;
      syncUI();
      if (reduced) { sp.x = sp.to; sp.v = 0; sp.run = false; write(sp.x, false); updateVis(sp.x); return; }
      sp.run = true;
      Scene.kick();
    };
    const go = p => animateTo(p);

    // Layout só reposiciona quando a geometria muda de fato (não interrompe a animação à toa)
    const layout = () => {
      const cs = getComputedStyle(car);
      per = parseInt(cs.getPropertyValue('--per'), 10) || 1;
      cw = parseFloat(cs.getPropertyValue('--cw')) || 302;
      const gap = parseFloat(cs.getPropertyValue('--gap')) || 24;
      fade = per > 1; // mobile (1 card + prévia): o próprio recorte da janela resolve
      winW = per * cw + (per - 1) * gap;
      const key = `${per}|${cw}|${gap}`;
      if (key === lastKey) return;
      lastKey = key;
      step = cw + gap;
      const max = Math.max(0, cards.length - per);
      positions = [];
      for (let i = 0; ; i += per) { positions.push(Math.min(i, max)); if (i >= max) break; }
      positions = [...new Set(positions)];
      let p = 0;
      for (let i = 0; i < positions.length; i++) if (positions[i] <= index) p = i;
      index = positions[p];
      buildDots();
      car.classList.toggle('is-fade', fade);
      sp.run = false; sp.v = 0; sp.x = sp.to = -index * step;
      write(sp.x, false);
      outState.fill(null);
      updateVis(sp.x);
      syncUI();
    };

    prev.addEventListener('click', () => go(page() - 1));
    next.addEventListener('click', () => go(page() + 1));
    car.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(page() + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(page() - 1); }
    });

    // Trackpad / roda horizontal: uma página por gesto
    let wheelAcc = 0, wheelLock = 0;
    win.addEventListener('wheel', e => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      const now = performance.now();
      if (now < wheelLock) return;
      wheelAcc += e.deltaX;
      if (Math.abs(wheelAcc) > 40) {
        go(page() + (wheelAcc > 0 ? 1 : -1));
        wheelAcc = 0;
        wheelLock = now + 450;
      }
    }, { passive: false });

    // Hover com mouse (estado de componente)
    cards.forEach(c => {
      c.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && !(drag && drag.moved)) c.classList.add('is-hover'); });
      c.addEventListener('pointerleave', () => c.classList.remove('is-hover'));
    });

    // Arrastar
    win.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      if (e.pointerType === 'mouse') {
        // impede o "arrastar nativo" do navegador (imagem fantasma da seção):
        // sem seleção de texto nem drag de imagem/seleção começando aqui
        e.preventDefault();
        const sel = window.getSelection && window.getSelection();
        if (sel && !sel.isCollapsed) sel.removeAllRanges();
      }
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, base: sp.x, moved: false, samples: [] };
    });
    // reforço: nenhum drag nativo nem início de seleção dentro do carrossel
    car.addEventListener('dragstart', e => e.preventDefault());
    win.addEventListener('selectstart', e => e.preventDefault());
    win.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      if (!drag.moved) {
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy) * 1.1) {
          if (Math.abs(dy) > 10) drag = null; // gesto vertical: deixa a página rolar
          return;
        }
        drag.moved = true;
        drag.x0 = e.clientX;  // começa do ponto atual: sem salto de 6px
        drag.base = sp.x;     // pega o trilho onde ele estiver, mesmo em movimento
        sp.run = false;
        car.classList.add('is-dragging');
        cards.forEach(c => c.classList.remove('is-hover'));
        try { win.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
      }
      const now = performance.now();
      drag.samples.push([now, e.clientX]);
      while (drag.samples.length > 2 && now - drag.samples[0][0] > 100) drag.samples.shift();
      const min = -positions[positions.length - 1] * step;
      let x = drag.base + (e.clientX - drag.x0);
      if (x > 0) x *= 0.35;
      if (x < min) x = min + (x - min) * 0.35;
      sp.x = x;
      dragDirty = true;
      Scene.kick();
    });
    const release = (e, cancelled) => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const d = drag;
      drag = null;
      if (!d.moved) return;
      car.classList.remove('is-dragging');
      // velocidade do gesto (px/s) pelas últimas amostras; parado antes de soltar = 0
      let v = 0;
      const s = d.samples;
      if (!cancelled && s.length > 1 && performance.now() - s[s.length - 1][0] < 80) {
        const a = s[0], b = s[s.length - 1];
        v = clamp(((b[1] - a[1]) / Math.max(16, b[0] - a[0])) * 1000, -4000, 4000);
      }
      const proj = sp.x + v * 0.2;
      let best = page(), bd = Infinity;
      positions.forEach((pos, i) => { const dd = Math.abs(-pos * step - proj); if (dd < bd) { bd = dd; best = i; } });
      const p0 = page();
      if (v < -260) best = Math.max(best, p0 + 1);
      else if (v > 260) best = Math.min(best, p0 - 1);
      animateTo(best, v);
      // evita "clique" ao soltar
      const stopClick = ev => { ev.stopPropagation(); ev.preventDefault(); };
      win.addEventListener('click', stopClick, { capture: true, once: true });
      setTimeout(() => win.removeEventListener('click', stopClick, { capture: true }), 0);
    };
    win.addEventListener('pointerup', e => release(e, false));
    win.addEventListener('pointercancel', e => release(e, true));
    // no toque a captura começa implícita no card tocado; ao transferi-la para a janela o card
    // dispara lostpointercapture (que sobe até aqui) — só conta a perda da própria janela
    win.addEventListener('lostpointercapture', e => { if (e.target === win) release(e, false); });

    Scene.add(dt => {
      if (drag && drag.moved) {
        if (dragDirty) { dragDirty = false; write(sp.x, true); updateVis(sp.x); }
        return false; // o próximo pointermove reinicia o loop
      }
      if (!sp.run) return false;
      // mola criticamente amortecida, integrada em passos pequenos (estável em 30/60/120 Hz)
      let t = Math.min(dt, 64) / 1000;
      while (t > 1e-6) {
        const h = Math.min(t, 1 / 240);
        const a = -OMEGA * OMEGA * (sp.x - sp.to) - 2 * OMEGA * sp.v;
        sp.v += a * h;
        sp.x += sp.v * h;
        t -= h;
      }
      if (Math.abs(sp.x - sp.to) < 0.25 && Math.abs(sp.v) < 8) { // < 1/4 px: assenta no inteiro sem salto visível
        sp.x = sp.to; sp.v = 0; sp.run = false;
        write(sp.x, false);
        updateVis(sp.x);
        return false;
      }
      write(sp.x, true);
      updateVis(sp.x);
      return true;
    });

    new IntersectionObserver(entries => {
      for (const e of entries) { inView = e.isIntersecting; lightCards(); }
    }, { rootMargin: '-30% 0px -30% 0px' }).observe(car);
    liveIO.observe(car);

    return { layout, refresh: lightCards };
  })();

  /* ------------------------------------------------------------------------
     HERO: tilt 3D do card + parallax de profundidade
     Ordem de profundidade (frente → fundo): Cafeteira, +1, Homem, iPhone,
     Avião, +2, Retângulo, Texto legal. O recorte "Homem" acompanha o
     retângulo (corta só embaixo); a foto tem profundidade própria dentro dele.
     Mouse: só perto do card (afastou, volta ao normal). Toque: giroscópio
     quando não precisa de permissão; senão, acompanha o scroll.
     ------------------------------------------------------------------------ */
  const Hero = (() => {
    const kv = $('.kv');
    const artBox = $('[data-hero-art]');
    if (!kv || !artBox) return null;
    const tilt = $('[data-tilt]', artBox);
    // nenhum arrastar nativo de imagem na Hero (logo e card)
    kv.addEventListener('dragstart', e => { if (e.target.closest && e.target.closest('img, .art')) e.preventDefault(); });
    const deco = $('[data-kv-deco]', kv);
    // Só o retângulo e o texto legal giram (tilt 3D); as imagens só se deslocam (parallax), sempre de frente
    const layers = $$('.ha', artBox).filter(el => !el.classList.contains('ha-homem-clip')).map(el => ({
      el,
      d: parseFloat(el.dataset.depth) || 0,
      tilt: el.classList.contains('ha-card') || el.classList.contains('ha-legal'),
      text: el.classList.contains('ha-legal'),
    }));
    const homem = $('.ha-homem', artBox);
    const clip = $('.ha-homem-clip', artBox);
    const card = $('.ha-card', artBox);
    const clipDepth = card ? parseFloat(card.dataset.depth) || 0 : 0;
    const homemDepth = homem ? parseFloat(homem.dataset.depth) : 0.68;
    const PERSP = 1400;   // igual ao perspective do .art (CSS)
    const SHIFT = 34;     // deslocamento máximo do parallax em px (× amplitude do breakpoint)
    const TILT_X = 6, TILT_Y = 8; // graus
    const geo = { W: 580, H: 560, clipX: 0, clipY: -103.5, manX: 0, manY: 0 };
    const DEG = Math.PI / 180;
    // projeta um ponto do card (px) pelo mesmo transform do retângulo: translate3d · rotateX · rotateY + perspective
    const proj = (px, py, sa, ca, sb, cb, tx, ty) => {
      const x = px - geo.W / 2, y = py - geo.H / 2;
      const x1 = x * cb, z1 = -x * sb;
      const y2 = y * ca - z1 * sa, z2 = y * sa + z1 * ca;
      const k = PERSP / (PERSP - z2);
      return [(x1 + tx) * k + geo.W / 2, (y2 + ty) * k + geo.H / 2];
    };
    const n6 = v => v.toFixed(6), n3 = v => v.toFixed(3);

    const g = { ax: 0, ay: 0, aw: 1, ah: 1, kvTop: 0, kvH: 0 }; // geometria (só em measure)
    const m = { tx: 0, ty: 0, sx: 0, sy: 0, cx: 0, cy: 0, gtx: 0, gty: 0, gsx: 0, gsy: 0, gcx: 0, gcy: 0, kvC: 0 };
    let source = 'none'; // mouse | gyro | scroll
    let gyroBase = null;
    const written = new Map();
    const put = (el, val) => { if (written.get(el) === val) return; written.set(el, val); el.style.transform = val; };

    const pickSource = () => {
      if (reduced) { source = 'none'; return; }
      if (mqMouse.matches) { source = 'mouse'; return; }
      source = source === 'gyro' ? 'gyro' : 'scroll';
    };

    // Giroscópio sem pedido de permissão (Android). iOS pede permissão → fica no scroll.
    const tryGyro = () => {
      if (typeof DeviceOrientationEvent === 'undefined') return;
      if (typeof DeviceOrientationEvent.requestPermission === 'function') return;
      const onOri = e => {
        if (e.beta == null || e.gamma == null || mqMouse.matches || reduced) return;
        if (source !== 'gyro') { source = 'gyro'; gyroBase = e.beta; }
        gyroBase += (e.beta - gyroBase) * 0.004; // recentraliza devagar
        m.tx = clamp(e.gamma / 22, -1, 1);
        m.ty = clamp((e.beta - gyroBase) / 22, -1, 1);
        Scene.kick();
      };
      addEventListener('deviceorientation', onOri, { passive: true });
    };
    tryGyro();

    // Ponteiro: influência só perto do card
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || reduced) return;
      const px = e.clientX + scrollX, py = e.clientY + scrollY;
      const cx = g.ax + g.aw / 2, cy = g.ay + g.ah / 2;
      const nx = (px - cx) / (g.aw / 2), ny = (py - cy) / (g.ah / 2);
      const dist = Math.hypot(nx, ny);
      const f = 1 - smooth(1.15, 2.1, dist);
      m.tx = clamp(nx, -1.2, 1.2) * f;
      m.ty = clamp(ny, -1.2, 1.2) * f;
      m.gtx = (e.clientX / state.vw) * 2 - 1;
      m.gty = (e.clientY / state.vh) * 2 - 1;
      Hit.test(px, py);
      Scene.kick();
    }, { passive: true });
    doc.addEventListener('mouseleave', () => { m.tx = m.ty = m.gtx = m.gty = 0; Hit.clear(); Scene.kick(); });

    /* Hover com zoom (celular, avião, cafeteira): teste pelo alfa da imagem,
       com o Homem bloqueando o que está atrás dele */
    const Hit = (() => {
      const items = [
        { key: 'cafe', el: $('.ha-cafe', artBox) },
        { key: 'homem', el: homem, block: true },
        { key: 'iphone', el: $('.ha-iphone', artBox) },
        { key: 'aviao', el: $('.ha-aviao', artBox) },
      ].filter(i => i.el);
      items.forEach(i => {
        i.zoom = $('.ha-zoom', i.el);
        i.img = $('img', i.el);
        i.d = i.key === 'homem' ? homemDepth : parseFloat(i.el.dataset.depth) || 0;
        i.box = { x: 0, y: 0, w: 1, h: 1 };
        const build = () => {
          try {
            const W = 96, H = Math.max(1, Math.round(W * i.img.naturalHeight / i.img.naturalWidth));
            const c = document.createElement('canvas');
            c.width = W; c.height = H;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(i.img, 0, 0, W, H);
            const data = ctx.getImageData(0, 0, W, H).data;
            const a = new Uint8Array(W * H);
            for (let p = 0; p < W * H; p++) a[p] = data[p * 4 + 3];
            i.alpha = { a, W, H };
          } catch (_) { i.alpha = null; } // file:// bloqueia a leitura → usa a caixa
        };
        if (i.img.complete && i.img.naturalWidth) build(); else i.img.addEventListener('load', build, { once: true });
      });
      let current = null;
      const set = it => {
        if (current === it) return;
        if (current && current.zoom) current.zoom.classList.remove('is-hover');
        current = it && it.zoom ? it : null;
        if (current) current.zoom.classList.add('is-hover');
      };
      const S = () => SHIFT * state.amp;
      return {
        measure() {
          // caixas relativas ao card (offset* ignora transforms)
          items.forEach(i => {
            let x = i.el.offsetLeft, y = i.el.offsetTop;
            if (i.key === 'homem') { const clip = i.el.parentElement; x += clip.offsetLeft; y += clip.offsetTop; i.clip = { x: clip.offsetLeft, y: clip.offsetTop, w: clip.offsetWidth, h: clip.offsetHeight }; }
            i.box = { x, y, w: i.el.offsetWidth, h: i.el.offsetHeight };
          });
        },
        test(px, py) {
          if (source !== 'mouse') return;
          const lx = px - g.ax, ly = py - g.ay;
          if (lx < -g.aw * 0.4 || ly < -g.ah * 0.4 || lx > g.aw * 1.4 || ly > g.ah * 1.4) { set(null); return; }
          for (const i of items) {
            const ox = m.cx * i.d * S(), oy = m.cy * i.d * S();
            if (i.clip) {
              const cx0 = i.clip.x + m.cx * clipDepth * S(), cy0 = i.clip.y + m.cy * clipDepth * S();
              if (lx < cx0 || ly < cy0 || lx > cx0 + i.clip.w || ly > cy0 + i.clip.h) continue;
            }
            const u = (lx - i.box.x - ox) / i.box.w, v = (ly - i.box.y - oy) / i.box.h;
            if (u < 0 || v < 0 || u >= 1 || v >= 1) continue;
            let hit;
            if (i.alpha) hit = i.alpha.a[Math.floor(v * i.alpha.H) * i.alpha.W + Math.floor(u * i.alpha.W)] > 70;
            else hit = u > 0.15 && u < 0.85 && v > 0.15 && v < 0.85;
            if (!hit) continue;
            set(i.block ? null : i);
            return;
          }
          set(null);
        },
        clear() { set(null); },
      };
    })();

    // Elementos do fundo: flutuação lenta (Web Animations, só transform)
    if (deco && !reduced && 'animate' in Element.prototype) {
      $$('.deco', deco).forEach((el, i) => {
        const r = (a, b) => a + Math.random() * (b - a);
        const ring = el.classList.contains('ring');
        const amp = ring ? r(6, 12) : r(4, 8);
        const dx = r(-1, 1) * amp, dy = r(-1, 1) * amp;
        const rot = ring ? 0.02 : r(-45, 45);
        const sc = ring ? 1.03 : 1.25;
        const at = (k, o) => `translate3d(${(dx * k).toFixed(3)}px,${(dy * k).toFixed(3)}px,0) rotate(${(0.02 + rot * k).toFixed(3)}deg) scale3d(${1 + (sc - 1) * Math.abs(k)},${1 + (sc - 1) * Math.abs(k)},1)`;
        decoAnims.push(el.animate([
          { transform: at(-1), opacity: ring ? 1 : 0.65 },
          { transform: at(1), opacity: 1 },
        ], { duration: r(6500, 11000), delay: -r(0, 9000), iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }));
      });
    }

    Scene.add(dt => {
      if (reduced) return false;
      const live = kv.classList.contains('is-live');
      const f = dt / 16.667;

      // toque sem giroscópio: posição do card na tela comanda o efeito
      if (source === 'scroll') {
        const c = g.ay + g.ah / 2 - state.y;
        const n = clamp((c - state.vh / 2) / (state.vh / 2), -1, 1);
        m.ty = n * 0.9;
        m.tx = -n * 0.35;
      }

      // dois estágios em cascata (velocidade contínua, sem "escada")
      const k1 = 1 - Math.pow(1 - 0.14, f);
      const k2 = 1 - Math.pow(1 - 0.075, f);
      m.sx += (m.tx - m.sx) * k1; m.sy += (m.ty - m.sy) * k1;
      m.cx += (m.sx - m.cx) * k2; m.cy += (m.sy - m.cy) * k2;
      m.gsx += (m.gtx - m.gsx) * k1; m.gsy += (m.gty - m.gsy) * k1;
      m.gcx += (m.gsx - m.gcx) * k2; m.gcy += (m.gsy - m.gcy) * k2;
      const kvT = Math.min(state.y, g.kvH);
      m.kvC += (kvT - m.kvC) * (1 - Math.pow(1 - 0.2, f));

      const d = Math.abs(m.tx - m.cx) + Math.abs(m.ty - m.cy) + Math.abs(m.tx - m.sx) + Math.abs(m.ty - m.sy) +
        Math.abs(m.gtx - m.gcx) + Math.abs(m.gty - m.gcy) + Math.abs(kvT - m.kvC) * 0.01;
      const moving = d > 0.0005;
      if (!moving) {
        m.sx = m.cx = m.tx; m.sy = m.cy = m.ty;
        m.gsx = m.gcx = m.gtx; m.gsy = m.gcy = m.gty; m.kvC = kvT;
      }
      if (!live) return moving;

      const amp = state.amp;
      const S = SHIFT * amp;
      const rx = -m.cy * TILT_X * amp, ry = m.cx * TILT_Y * amp;
      const rot = `rotateX(${n3(rx)}deg) rotateY(${n3(ry)}deg)`;
      for (const l of layers) {
        const x = n3(m.cx * l.d * S), y = n3(m.cy * l.d * S);
        if (l.tilt) put(l.el, `translate3d(${x}px,${y}px,0) ${rot}${l.text ? '' : ' rotate(0.02deg)'}`);
        else put(l.el, `translate3d(${x}px,${y}px,0) rotate(0.02deg)`);
      }
      if (clip && homem) {
        /* O recorte segue a borda inferior (e a lateral) do retângulo inclinado:
           ajuste afim a partir de 3 pontos projetados. A foto recebe a inversa
           desse ajuste + o próprio parallax, então continua de frente. */
        const sa = Math.sin(rx * DEG), ca = Math.cos(rx * DEG), sb = Math.sin(ry * DEG), cb = Math.cos(ry * DEG);
        const tRx = m.cx * clipDepth * S, tRy = m.cy * clipDepth * S;
        const A = proj(0, geo.H, sa, ca, sb, cb, tRx, tRy);
        const B = proj(geo.W, geo.H, sa, ca, sb, cb, tRx, tRy);
        const C = proj(0, geo.clipY, sa, ca, sb, cb, tRx, tRy);
        const l11 = (B[0] - A[0]) / geo.W, l21 = (B[1] - A[1]) / geo.W;
        const dy = geo.clipY - geo.H;
        const l12 = (C[0] - A[0]) / dy, l22 = (C[1] - A[1]) / dy;
        const tx = A[0] - l12 * geo.H, ty = A[1] - l22 * geo.H;
        put(clip, `matrix(${n6(l11)},${n6(l21)},${n6(l12)},${n6(l22)},${n3(tx)},${n3(ty)})`);
        const det = l11 * l22 - l12 * l21 || 1;
        const i11 = l22 / det, i12 = -l12 / det, i21 = -l21 / det, i22 = l11 / det;
        const ex = m.cx * homemDepth * S - tx, ey = m.cy * homemDepth * S - ty;
        put(homem, `matrix(${n6(i11)},${n6(i21)},${n6(i12)},${n6(i22)},${n3(i11 * ex + i12 * ey)},${n3(i21 * ex + i22 * ey)}) rotate(0.02deg)`);
      }
      if (deco) {
        const x = (-m.gcx * 14 * amp).toFixed(3);
        const y = (-m.gcy * 10 * amp + m.kvC * 0.12).toFixed(3);
        put(deco, `translate3d(${x}px,${y}px,0) rotate(0.02deg)`);
      }
      return moving;
    });

    return {
      measure() {
        const r = artBox.getBoundingClientRect();
        g.ax = r.left + scrollX; g.ay = r.top + scrollY; g.aw = r.width || 1; g.ah = r.height || 1;
        geo.W = artBox.offsetWidth || 1; geo.H = artBox.offsetHeight || 1;
        if (clip) {
          geo.clipX = clip.offsetLeft; geo.clipY = clip.offsetTop;
          clip.style.transformOrigin = `${-geo.clipX}px ${-geo.clipY}px`; // origem = canto do card
        }
        if (homem) {
          geo.manX = geo.clipX + homem.offsetLeft; geo.manY = geo.clipY + homem.offsetTop;
          homem.style.transformOrigin = `${-geo.manX}px ${-geo.manY}px`;
        }
        written.clear();
        const k = kv.getBoundingClientRect();
        g.kvTop = k.top + scrollY; g.kvH = k.height;
        Hit.measure();
        pickSource();
        if (source !== 'mouse') { Hit.clear(); if (source !== 'gyro') { m.gtx = m.gty = 0; } }
      },
      reset() {
        written.clear();
        [tilt, deco, homem, clip, ...layers.map(l => l.el)].forEach(el => { if (el) el.style.transform = ''; });
      },
    };
  })();

  /* ------------------------------------------------------------------------
     REGULAMENTO: sumário, barra de leitura, voltar ao topo, tópico ativo
     ------------------------------------------------------------------------ */
  const sumario = $('[data-sumario]');
  if (sumario) {
    const btn = $('.sumario__btn', sumario);
    const panel = $('.sumario__panel', sumario);
    const sync = open => { btn.setAttribute('aria-expanded', String(open)); panel.inert = !open; };
    sync(false);
    btn.addEventListener('click', () => {
      const open = !sumario.classList.contains('is-open');
      sumario.classList.toggle('is-open', open);
      sync(open);
      queueRemeasure();
    });
    const topicLinks = $$('.sumario__link, .indice__link');
    const spy = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        topicLinks.forEach(l => l.classList.toggle('is-active', l.getAttribute('href') === `#${e.target.id}`));
      }
    }, { rootMargin: '-30% 0px -60% 0px' });
    $$('[data-topico]').forEach(s => spy.observe(s));
  }
  if (toTop) toTop.addEventListener('click', () => { Scroll.to(0); const f = $('.header__logo'); if (f) f.focus({ preventScroll: true }); });
  let docH = 1;
  if (progress) {
    let pC = 0;
    Scene.add(dt => {
      const t = clamp(state.y / docH, 0, 1);
      pC += (t - pC) * kf(0.25, dt);
      const busy = Math.abs(t - pC) > 0.0005;
      if (!busy) pC = t;
      progress.style.transform = `scale3d(${pC.toFixed(4)},1,1)`;
      return busy;
    });
  }

  /* ------------------------------------------------------------------------
     Medidas (somente em resize/load — nunca dentro do frame)
     ------------------------------------------------------------------------ */
  function measure() {
    state.vw = innerWidth;
    state.vh = innerHeight;
    state.amp = ampFor(state.vw);
    state.y = scrollY;
    docH = Math.max(1, doc.scrollHeight - innerHeight);
    if (Carousel) Carousel.layout();
    if (Hero) Hero.measure();
    Scroll.measure();
    Scene.kick();
  }
  let resizeT = 0;
  let lastW = innerWidth;
  const queueMeasure = () => { clearTimeout(resizeT); resizeT = setTimeout(measure, 120); };
  addEventListener('resize', () => {
    // no celular a barra de endereço muda a altura: só refaz layout se a largura mudar
    if (innerWidth !== lastW || !mqTouch.matches) { lastW = innerWidth; queueMeasure(); }
    else { state.vh = innerHeight; }
  }, { passive: true });
  addEventListener('load', measure);
  if ('ResizeObserver' in window) new ResizeObserver(queueMeasure).observe(document.body);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  measure();

  /* Movimento reduzido ligado/desligado em tempo real */
  mqReduce.addEventListener('change', e => {
    reduced = e.matches;
    if (reduced) {
      Scroll.stop();
      decoAnims.forEach(a => a.cancel());
      $$('[data-reveal]').forEach(el => el.removeAttribute('data-reveal'));
      if (Hero) Hero.reset();
    }
    setupCenter();
    if (Carousel) Carousel.refresh();
    measure();
  });
  mqMouse.addEventListener('change', measure);
})();
