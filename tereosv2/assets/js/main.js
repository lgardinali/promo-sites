/* =============================================================================
   Guarani 50 anos · "Juntou, trocou, sambou!" — interações (v2)
   JS nativo, zero dependências.

   Diretrizes de fluidez aplicadas:
   - Camada GPU ligada pela visibilidade (.is-live via IntersectionObserver), nunca pelo movimento.
   - translate3d + rotate(0.02deg) (exceto blocos de texto), posições com subpixel (.toFixed(3)).
   - Suavização do ponteiro em dois estágios, normalizada pelo tempo do frame.
   - Um único requestAnimationFrame para a cena; leituras de layout só em resize/load.
   - Transition para estados (hover/reveal/troca de tema), rAF para movimento contínuo —
     nunca no mesmo elemento.
   - prefers-reduced-motion: loop desligado e tudo na posição final.
   ========================================================================== */
(() => {
  'use strict';

  const doc = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqFine = matchMedia('(hover: hover) and (pointer: fine)');
  let reduce = mqReduce.matches;
  let fine = mqFine.matches;

  /* ---------------------------------------------------------------------------
     Medidas (somente em resize / load / mudança de altura do documento)
     ------------------------------------------------------------------------ */
  const view = { w: 0, vw: 0, h: 0, u: 1, amp: 1, maxY: 0 };

  // Mesma fórmula do CSS (--u): 1px de design em px reais para o modo atual
  function calcU(vw, w) {
    if (vw >= 1440) return clamp(w / 1920, 0.75, 1);
    if (vw >= 1024) return clamp(w / 1080, 0.94, 1.2);
    if (vw >= 640) return clamp(w / 768, 0.833, 1.2);
    return clamp(w / 390, 0.82, 1.3);
  }

  const sections = $$('[data-section]');
  const secBox = new Map();

  function measure() {
    view.w = doc.clientWidth;
    // largura útil sem a barra de rolagem: no <head> a barra ainda pode não existir
    if (doc.style.getPropertyValue('--vw') !== view.w + 'px') doc.style.setProperty('--vw', view.w + 'px');
    view.vw = window.innerWidth;
    view.h = window.innerHeight;
    view.u = calcU(view.vw, view.w);
    view.amp = view.vw >= 1440 ? 1 : view.vw >= 640 ? 0.82 : 0.5;
    view.maxY = Math.max(0, doc.scrollHeight - view.h);
    const sy = window.scrollY;
    sections.forEach((sec) => {
      const r = sec.getBoundingClientRect();
      secBox.set(sec, { top: r.top + sy, h: r.height });
    });
    ticker.wake();
  }

  /* ---------------------------------------------------------------------------
     Ticker: um único rAF para a cena inteira. Para quando tudo assenta.
     ------------------------------------------------------------------------ */
  const ticker = (() => {
    const subs = [];
    let raf = 0;
    let last = 0;
    function frame(t) {
      const dt = last ? Math.min(t - last, 64) : 16.667;
      last = t;
      let busy = false;
      for (let i = 0; i < subs.length; i++) if (subs[i](dt, t)) busy = true;
      if (busy) raf = requestAnimationFrame(frame);
      else { raf = 0; last = 0; }
    }
    return {
      add(fn) { subs.push(fn); },
      wake() { if (!raf) raf = requestAnimationFrame(frame); },
    };
  })();

  /* ---------------------------------------------------------------------------
     Rolagem
     - Âncoras: animação própria (ease in-out).
     - Roda do mouse: só suaviza se o navegador NÃO tiver rolagem suave nativa.
       A primeira rolada serve de teste: se um "clique" da roda gera vários
       eventos de scroll, o navegador já anima (Chrome/Edge/Firefox com
       "rolagem suave" ligada) e o JS não interfere. Trackpads nunca são
       interceptados (já têm inércia).
     ------------------------------------------------------------------------ */
  const scroller = (() => {
    let mode = 'probe'; // probe | native | custom
    let target = 0;
    let current = 0;
    let wheelActive = false;
    let lastWritten = -1;
    let anim = null;
    let probe = null;
    let trackpadUntil = 0;
    let locked = false;

    const easeInOut = (p) => (p < 0.5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2);

    function write(y) {
      lastWritten = y;
      window.scrollTo(0, y);
    }

    function canScrollInside(el, dy) {
      while (el && el !== document.body && el !== doc) {
        if (el.nodeType === 1) {
          const oy = getComputedStyle(el).overflowY;
          if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
            if ((dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) || (dy < 0 && el.scrollTop > 0)) return true;
          }
        }
        el = el.parentNode;
      }
      return false;
    }

    function isWheelNotch(e) {
      const now = performance.now();
      if (e.deltaMode === 1 || e.deltaMode === 2) return true;
      const ay = Math.abs(e.deltaY);
      const smallOrFractional = ay < 40 || !Number.isInteger(e.deltaY) || Math.abs(e.deltaX) > 0.5;
      if (smallOrFractional) { trackpadUntil = now + 220; return false; }
      return now > trackpadUntil;
    }

    function normDelta(e) {
      if (e.deltaMode === 1) return e.deltaY * 16;
      if (e.deltaMode === 2) return e.deltaY * view.h;
      return e.deltaY;
    }

    // Teste com listener passivo (não bloqueia a rolagem nativa). Só vira não-passivo se
    // o navegador realmente não suavizar a roda.
    function onWheelProbe(e) {
      if (mode !== 'probe' || locked || reduce || e.ctrlKey) return;
      if (!isWheelNotch(e) || canScrollInside(e.target, e.deltaY)) return;
      anim = null;
      if (!probe) {
        probe = { wheels: 0, scrolls: 0 };
        setTimeout(() => {
          const p = probe;
          probe = null;
          if (!p || p.scrolls === 0) return; // nada rolou (ex.: fim da página): testa de novo depois
          mode = p.scrolls >= p.wheels * 2 + 2 ? 'native' : 'custom';
          doc.dataset.scroll = mode;
          window.removeEventListener('wheel', onWheelProbe);
          if (mode === 'custom') window.addEventListener('wheel', onWheel, { passive: false });
        }, 280);
      }
      probe.wheels++;
    }

    function onWheel(e) {
      if (locked || reduce || e.ctrlKey || e.defaultPrevented) return;
      if (!isWheelNotch(e)) return;
      if (canScrollInside(e.target, e.deltaY)) return;
      anim = null;
      e.preventDefault();
      if (!wheelActive) { current = target = window.scrollY; }
      target = clamp(target + normDelta(e), 0, view.maxY);
      wheelActive = true;
      ticker.wake();
    }

    function onScroll() {
      if (probe) probe.scrolls++;
      // rolagem externa (teclado, barra, toque) durante a animação: devolve o controle
      if ((wheelActive || anim) && Math.abs(window.scrollY - lastWritten) > 3) {
        wheelActive = false;
        anim = null;
      }
    }

    function cancel() { anim = null; wheelActive = false; }

    function to(y, opts = {}) {
      y = clamp(y, 0, view.maxY);
      wheelActive = false;
      if (reduce || opts.instant) { anim = null; write(y); return; }
      const from = window.scrollY;
      const dist = Math.abs(y - from);
      if (dist < 2) return;
      anim = { from, to: y, start: performance.now(), dur: clamp(dist * 0.42, 650, 1500), onEnd: opts.onEnd };
      ticker.wake();
    }

    function tick(dt, t) {
      if (anim) {
        const p = clamp((t - anim.start) / anim.dur, 0, 1);
        write(anim.from + (anim.to - anim.from) * easeInOut(p));
        if (p >= 1) {
          const done = anim.onEnd;
          anim = null;
          current = target = window.scrollY;
          if (done) done();
          return false;
        }
        return true;
      }
      if (!wheelActive) return false;
      const k = 1 - Math.pow(1 - 0.11, dt / 16.667);
      current += (target - current) * k;
      if (Math.abs(target - current) < 0.4) { current = target; wheelActive = false; }
      write(current);
      return wheelActive;
    }

    window.addEventListener('wheel', onWheelProbe, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    ['touchstart', 'keydown', 'pointerdown'].forEach((ev) => window.addEventListener(ev, (e) => {
      if (ev === 'pointerdown' && e.target.closest && e.target.closest('a,button')) return;
      cancel();
    }, { passive: true }));
    ticker.add(tick);

    return {
      to,
      cancel,
      lock(v) { locked = v; cancel(); },
      get animating() { return !!anim; },
    };
  })();

  /* ---------------------------------------------------------------------------
     Barra fixa: aparece ao rolar para cima depois do KV; some ao descer
     ------------------------------------------------------------------------ */
  const bar = $('[data-bar]');
  let lastY = window.scrollY;
  let menuOpen = false;

  function setBar(show) {
    if (bar.classList.contains('is-shown') === show) return;
    bar.classList.toggle('is-shown', show);
    if (show) bar.removeAttribute('inert'); else bar.setAttribute('inert', '');
  }
  bar.setAttribute('inert', '');

  function updateBar() {
    const y = window.scrollY;
    const dy = y - lastY;
    if (Math.abs(dy) < 6) return;
    const hero = sections[0] ? secBox.get(sections[0]) : null;
    const pastHero = hero ? y > hero.h * 0.7 : y > 500;
    setBar(dy < 0 && pastHero && !menuOpen && !scroller.animating);
    lastY = y;
  }
  window.addEventListener('scroll', updateBar, { passive: true });

  /* ---------------------------------------------------------------------------
     Navegação por âncoras
     ------------------------------------------------------------------------ */
  function scrollToId(id, opts) {
    const el = id === 'home' || !id ? null : document.getElementById(id);
    if (!el) { scroller.to(0, opts); return; }
    setBar(false);
    scroller.to(el.getBoundingClientRect().top + window.scrollY, opts);
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href === '#') { e.preventDefault(); return; } // links ainda sem destino (cadastro, regulamento)
    if (a.classList.contains('skip')) return;
    const id = href.slice(1);
    if (!document.getElementById(id)) return;
    e.preventDefault();
    const go = () => {
      scrollToId(id);
      if (history.replaceState) history.replaceState(null, '', id === 'home' ? location.pathname + location.search : href);
    };
    if (menuOpen) { closeMenu(false); setTimeout(go, reduce ? 0 : 260); } else go();
  });

  /* ---------------------------------------------------------------------------
     Scroll spy (link ativo no menu)
     ------------------------------------------------------------------------ */
  const navLinks = $$('[data-nav]').filter((l) => !l.classList.contains('ftr__guarani'));
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const id = en.target.id;
      navLinks.forEach((l) => {
        if (l.getAttribute('href') === '#' + id) l.setAttribute('aria-current', 'true');
        else l.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => spy.observe(s));

  /* ---------------------------------------------------------------------------
     Reveal ao rolar (uma vez)
     ------------------------------------------------------------------------ */
  const revealEls = $$('[data-reveal]');
  const carousels = $$('[data-carousel]');
  if (reduce || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-in'));
  } else {
    const ro = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        // dentro de um carrossel: revela o grupo inteiro de uma vez
        const group = el.matches('[data-carousel]') ? $$('[data-reveal]', el) : [el];
        group.forEach((g) => g.classList.add('is-in'));
        ro.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealEls.forEach((el) => { if (!carousels.some((c) => c.contains(el))) ro.observe(el); });
    carousels.forEach((c) => ro.observe(c));
  }

  /* ---------------------------------------------------------------------------
     Camadas vivas (GPU ligada enquanto visível) + estado dos loops CSS
     ------------------------------------------------------------------------ */
  const liveEls = $$('[data-live], [data-fx], .ticket--soon, [data-sign]');
  const liveSet = new WeakSet();
  const lo = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      en.target.classList.toggle('is-live', en.isIntersecting);
      if (en.isIntersecting) liveSet.add(en.target); else liveSet.delete(en.target);
    });
    ticker.wake();
  }, { rootMargin: '20% 0px 20% 0px' });
  liveEls.forEach((el) => lo.observe(el));

  /* ---------------------------------------------------------------------------
     Parallax: ponteiro (dois estágios) + rolagem suavizada, escritos juntos
     ------------------------------------------------------------------------ */
  const ptr = { tx: 0, ty: 0, sx: 0, sy: 0, cx: 0, cy: 0 };
  let sScroll = window.scrollY;

  const layers = $$('[data-depth-x], [data-scroll]').map((el) => ({
    el,
    dx: parseFloat(el.dataset.depthX) || 0,
    dy: parseFloat(el.dataset.depthY) || 0,
    downOnly: el.hasAttribute('data-depth-y-min'),
    sf: parseFloat(el.dataset.scroll) || 0,
    smax: parseFloat(el.dataset.scrollMax) || 0,
    sec: el.closest('[data-section]'),
    text: el.hasAttribute('data-text'),
    last: '',
  }));

  const fxEls = $$('[data-fx]').map((el) => ({
    el,
    type: el.dataset.fx,
    sec: el.closest('[data-section]'),
    last: '',
  }));

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || reduce) return;
    ptr.tx = (e.clientX / view.w) * 2 - 1;
    ptr.ty = (e.clientY / view.h) * 2 - 1;
    ticker.wake();
  }, { passive: true });
  document.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget) { ptr.tx = 0; ptr.ty = 0; ticker.wake(); }
  });
  window.addEventListener('scroll', () => ticker.wake(), { passive: true });

  function setT(o, str) {
    if (o.last !== str) { o.el.style.transform = str; o.last = str; }
  }

  function sceneTick(dt) {
    if (reduce) return false;
    const f = dt / 16.667;
    // 1º estágio: alvo suavizado · 2º estágio: posição exibida
    const k1 = 1 - Math.pow(1 - 0.14, f);
    const k2 = 1 - Math.pow(1 - 0.075, f);
    const tx = fine ? ptr.tx : 0;
    const ty = fine ? ptr.ty : 0;
    ptr.sx += (tx - ptr.sx) * k1;
    ptr.sy += (ty - ptr.sy) * k1;
    ptr.cx += (ptr.sx - ptr.cx) * k2;
    ptr.cy += (ptr.sy - ptr.cy) * k2;

    const y = window.scrollY;
    const ks = 1 - Math.pow(1 - 0.2, f);
    sScroll += (y - sScroll) * ks;
    if (Math.abs(y - sScroll) < 0.05) sScroll = y;

    const u = view.u;
    const amp = view.amp;
    const vh = view.h;

    for (let i = 0; i < layers.length; i++) {
      const L = layers[i];
      if (!liveSet.has(L.el)) continue;
      const x = ptr.cx * L.dx * amp * u;
      // downOnly: a imagem é cortada na base, então só desce (repouso = posição do layout)
      let yy = L.downOnly ? Math.max(0, ptr.cy) * L.dy * amp * u : ptr.cy * L.dy * amp * u;
      if (L.sf && L.sec) {
        const b = secBox.get(L.sec);
        if (b) {
          const dist = b.top + b.h / 2 - (sScroll + vh / 2);
          const lim = L.smax * amp * u;
          yy += clamp(-dist * L.sf, -lim, lim);
        }
      }
      const rot = L.text ? '' : ' rotate(0.02deg)';
      setT(L, `translate3d(${x.toFixed(3)}px, ${yy.toFixed(3)}px, 0)${rot}`);
    }

    for (let i = 0; i < fxEls.length; i++) {
      const F = fxEls[i];
      if (!liveSet.has(F.el) || !F.sec) continue;
      const b = secBox.get(F.sec);
      if (!b) continue;
      // -1 (seção acima) · 0 (centralizada = posição do layout) · +1 (seção abaixo)
      const p = clamp((b.top + b.h / 2 - (sScroll + vh / 2)) / (vh / 2 + b.h / 2), -1, 1);
      if (F.type === 'flor') {
        setT(F, `translate3d(0, ${(p * 26 * amp * u).toFixed(3)}px, 0) rotate(${(p * -16).toFixed(3)}deg)`);
      } else if (F.type === 'drift') {
        setT(F, `translate3d(0, ${(Math.max(0, p) * 30 * amp * u).toFixed(3)}px, 0) rotate(0.02deg)`);
      } else if (F.type === 'spin') {
        setT(F, `rotate(${(p * 90).toFixed(3)}deg)`);
      }
    }

    const settled =
      Math.abs(tx - ptr.cx) < 0.0005 && Math.abs(ty - ptr.cy) < 0.0005 &&
      Math.abs(ptr.sx - ptr.cx) < 0.0005 && Math.abs(ptr.sy - ptr.cy) < 0.0005 &&
      sScroll === y;
    return !settled;
  }
  ticker.add(sceneTick);

  function resetScene() {
    layers.concat(fxEls).forEach((o) => { o.el.style.transform = ''; o.last = ''; });
  }

  /* ---------------------------------------------------------------------------
     Como participar: tema muda a cada 7 s e ao passar o mouse num passo.
     Cada troca: 1) fundo novo (rápido) → 2) pessoa entra deslizando (ease-out) → 3) frase.
     O sequenciamento fica no CSS (transições com atraso); aqui só se troca o estado.
     ------------------------------------------------------------------------ */
  const cp = (() => {
    const root = $('[data-cp]');
    if (!root) return null;
    const bgs = $$('[data-cp-bg]', root);
    const people = $$('[data-cp-person]', root);
    const phrases = $$('[data-cp-phrase]', root);
    const steps = $$('[data-cp-step]', root);
    const list = $('[data-cp-steps]', root);
    const CYCLE = 7000;
    let index = 0;
    let timer = 0;
    let leaveT = 0;
    let visible = false;
    let hovering = false;
    let focused = false;

    const imgsOf = (i) => [bgs[i] && $('img', bgs[i]), people[i] && $('img', people[i])].filter(Boolean);
    const ready = (i) => Promise.race([
      Promise.all(imgsOf(i).map((img) => {
        img.loading = 'eager';
        return img.complete ? Promise.resolve() : (img.decode ? img.decode().catch(() => {}) : Promise.resolve());
      })),
      new Promise((r) => setTimeout(r, 1200)),
    ]);

    function apply(i) {
      const prev = index;
      index = i;
      clearTimeout(leaveT);
      bgs.forEach((b, j) => {
        b.classList.toggle('is-active', j === i);
        b.classList.toggle('is-leaving', j === prev && prev !== i);
      });
      // o fundo anterior fica por baixo até o novo terminar de aparecer
      leaveT = setTimeout(() => bgs.forEach((b) => b.classList.remove('is-leaving')), 450);
      people.forEach((p, j) => { p.classList.toggle('is-active', j === i); p.setAttribute('aria-hidden', String(j !== i)); });
      phrases.forEach((p, j) => { p.classList.toggle('is-active', j === i); p.setAttribute('aria-hidden', String(j !== i)); });
      steps.forEach((s, j) => {
        s.classList.toggle('is-active', j === i);
        if (j === i) s.setAttribute('aria-current', 'step'); else s.removeAttribute('aria-current');
      });
    }

    // as imagens de todos os temas já são aquecidas quando a seção se aproxima
    function go(i) {
      i = (i + steps.length) % steps.length;
      if (i !== index) apply(i);
    }

    const paused = () => !visible || hovering || focused || document.hidden;

    function schedule() {
      clearTimeout(timer);
      const isPaused = paused();
      root.classList.toggle('is-paused', isPaused && visible);
      root.classList.remove('is-cycling');
      if (isPaused) return;
      void root.offsetWidth; // reinicia a barra de progresso do passo ativo
      root.classList.add('is-cycling');
      timer = setTimeout(() => { go(index + 1); schedule(); }, CYCLE);
    }

    steps.forEach((s, i) => {
      s.addEventListener('mouseenter', () => { if (fine) go(i); });
      s.addEventListener('focus', () => go(i));
      s.addEventListener('click', () => { go(i); schedule(); });
    });
    list.addEventListener('mouseenter', () => { if (!fine) return; hovering = true; schedule(); });
    list.addEventListener('mouseleave', () => { hovering = false; schedule(); });
    list.addEventListener('focusin', () => { focused = true; schedule(); });
    list.addEventListener('focusout', (e) => { if (!list.contains(e.relatedTarget)) { focused = false; schedule(); } });
    document.addEventListener('visibilitychange', schedule);

    let warmed = false;
    new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting && !warmed) {
          warmed = true;
          // aquece as imagens de todos os temas para as trocas serem instantâneas
          steps.forEach((_, i) => ready(i));
        }
      });
    }, { rootMargin: '60% 0px 60% 0px' }).observe(root);
    new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        visible = en.isIntersecting;
        root.classList.toggle('is-visible', visible);
        schedule();
      });
    }, { threshold: 0.25 }).observe(root);

    return { go, schedule };
  })();

  /* ---------------------------------------------------------------------------
     "Hover" por rolagem no touch: o item no centro da tela fica ativo
     ------------------------------------------------------------------------ */
  let focusIO = null;
  // Um item ativo por grupo: o último que entrou na faixa central e ainda está nela
  const focusGroups = new Map();
  const isCarouselMode = (c) => getComputedStyle(c).overflowX !== 'visible';

  function setupTouchFocus() {
    if (focusIO) { focusIO.disconnect(); focusIO = null; }
    focusGroups.clear();
    $$('[data-focus]').forEach((el) => el.classList.remove('is-focus'));
    carousels.forEach((c) => c.classList.remove('is-focus'));
    if (fine || reduce) return;
    focusIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const el = en.target;
        const key = el.matches('[data-carousel]') ? el : el.closest('.cards__track') || el;
        const list = focusGroups.get(key) || [];
        const i = list.indexOf(el);
        if (i > -1) list.splice(i, 1);
        if (en.isIntersecting) list.push(el);
        focusGroups.set(key, list);
        const active = list[list.length - 1];
        if (el !== active) el.classList.remove('is-focus');
        list.forEach((it) => it.classList.toggle('is-focus', it === active));
      });
    }, { rootMargin: '-40% 0px -40% 0px' });
    $$('[data-focus]').forEach((el) => {
      const c = el.closest('[data-carousel]');
      if (c && isCarouselMode(c)) return;
      focusIO.observe(el);
    });
    carousels.forEach((c) => { if (isCarouselMode(c)) focusIO.observe(c); });
  }

  /* ---------------------------------------------------------------------------
     Carrosséis no mobile (scroll-snap nativo + paginação): Prêmios, Produtos, Ganhadores
     ------------------------------------------------------------------------ */
  const sliders = carousels.map((track) => {
    const cards = Array.from(track.children);
    const dotsEl = track.parentElement.querySelector('[data-dots]');
    const dots = dotsEl ? $$('.dot', dotsEl) : [];
    const s = { track, cards, dots, active: 0, step: 1, max: 0, offsets: [] };

    s.measure = () => {
      s.offsets = cards.map((c) => c.offsetLeft - cards[0].offsetLeft);
      s.step = s.offsets[1] || 1;
      s.max = track.scrollWidth - track.clientWidth;
    };
    s.setActive = (i) => {
      s.active = i;
      dots.forEach((d, j) => {
        d.classList.toggle('is-active', j === i);
        if (j === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
      if (!fine && isCarouselMode(track)) {
        const inView = track.classList.contains('is-focus');
        cards.forEach((c, j) => c.classList.toggle('is-focus', inView && j === i));
      }
    };
    track.addEventListener('scroll', () => {
      const x = track.scrollLeft;
      const i = x >= s.max - 2 ? cards.length - 1 : Math.round(x / s.step);
      if (i !== s.active) s.setActive(clamp(i, 0, cards.length - 1));
    }, { passive: true });
    dots.forEach((d, i) => d.addEventListener('click', () => {
      track.scrollTo({ left: s.offsets[i] || 0, behavior: reduce ? 'auto' : 'smooth' });
    }));
    // o carrossel no centro da tela ativa o card visível
    new MutationObserver(() => s.setActive(s.active)).observe(track, { attributes: true, attributeFilter: ['class'] });
    return s;
  });
  const measureSliders = () => sliders.forEach((s) => s.measure());

  /* ---------------------------------------------------------------------------
     Dúvidas frequentes (accordion, um aberto por vez)
     ------------------------------------------------------------------------ */
  $$('[data-faq]').forEach((root) => {
    const items = $$('.faq__item', root);
    const setOpen = (item, open) => {
      item.classList.toggle('is-open', open);
      $('.faq__btn', item).setAttribute('aria-expanded', String(open));
      const panel = $('.faq__a', item);
      if (open) panel.removeAttribute('inert'); else panel.setAttribute('inert', '');
    };
    items.forEach((it) => setOpen(it, it.classList.contains('is-open')));

    // Com duas colunas, a altura da seção é a da coluna mais alta: fechar de um lado e abrir do
    // outro faria a seção encolher e crescer de novo. Mede-se a altura final sem transição, volta
    // ao estado atual e anima o contêiner direto de h0 até h1 junto com as respostas.
    const DUR = 650;
    let busyUntil = 0;
    let unlockT = 0;
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('.faq__btn');
      if (!btn) return;
      const item = btn.closest('.faq__item');
      const open = !item.classList.contains('is-open');
      const others = items.filter((it) => it !== item && it.classList.contains('is-open'));
      const apply = () => { others.forEach((it) => setOpen(it, false)); setOpen(item, open); };
      const undo = () => { others.forEach((it) => setOpen(it, true)); setOpen(item, !open); };

      if (reduce || performance.now() < busyUntil) {
        clearTimeout(unlockT);
        root.style.height = '';
        apply();
        return;
      }

      const h0 = root.getBoundingClientRect().height;
      root.classList.add('faq--measure');
      apply();
      const h1 = root.getBoundingClientRect().height;
      undo();
      root.style.height = h0 + 'px';
      root.getBoundingClientRect(); // fixa o estado inicial antes de religar as transições
      root.classList.remove('faq--measure');
      apply();
      root.style.height = h1 + 'px';

      busyUntil = performance.now() + DUR;
      clearTimeout(unlockT);
      unlockT = setTimeout(() => { root.style.height = ''; }, DUR);
    });
  });

  /* ---------------------------------------------------------------------------
     Menu mobile / tablet
     ------------------------------------------------------------------------ */
  const menu = $('[data-menu]');
  const openBtns = $$('[data-menu-open]');
  const closeBtn = $('[data-menu-close]');
  const outside = [bar, $('main'), $('footer')];
  let opener = null;

  function openMenu(btn) {
    if (menuOpen || !menu) return;
    menuOpen = true;
    opener = btn || openBtns[0];
    menu.removeAttribute('inert');
    menu.classList.add('is-open');
    openBtns.forEach((b) => b.setAttribute('aria-expanded', 'true'));
    outside.forEach((el) => el && el.setAttribute('inert', ''));
    doc.style.overflow = 'hidden';
    scroller.lock(true);
    setTimeout(() => closeBtn.focus({ preventScroll: true }), 60);
  }
  function closeMenu(restoreFocus = true) {
    if (!menuOpen || !menu) return;
    menuOpen = false;
    menu.classList.remove('is-open');
    menu.setAttribute('inert', '');
    openBtns.forEach((b) => b.setAttribute('aria-expanded', 'false'));
    outside.forEach((el) => el && el !== bar && el.removeAttribute('inert'));
    if (bar.classList.contains('is-shown')) bar.removeAttribute('inert');
    doc.style.overflow = '';
    scroller.lock(false);
    if (restoreFocus && opener) opener.focus({ preventScroll: true });
  }
  if (menu) {
    menu.setAttribute('inert', '');
    openBtns.forEach((b) => b.addEventListener('click', () => openMenu(b)));
    closeBtn.addEventListener('click', () => closeMenu());
    document.addEventListener('keydown', (e) => {
      if (!menuOpen) return;
      if (e.key === 'Escape') { closeMenu(); return; }
      if (e.key !== 'Tab') return;
      const f = $$('a[href], button', menu).filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ---------------------------------------------------------------------------
     Intro do KV: começa quando as imagens principais estão decodificadas
     ------------------------------------------------------------------------ */
  function ready() { doc.classList.add('is-ready'); }
  if (reduce) ready();
  else {
    const imgs = [$('.hero__brindes-img'), $('.hero__logo img')].filter(Boolean);
    const decode = (img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve());
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([
      Promise.all(imgs.map(decode).concat(fonts)),
      new Promise((r) => setTimeout(r, 1600)),
    ]).then(ready);
  }

  /* ---------------------------------------------------------------------------
     Resize / preferências
     ------------------------------------------------------------------------ */
  let rz = 0;
  function onResize() {
    if (rz) return;
    rz = requestAnimationFrame(() => {
      rz = 0;
      measure();
      measureSliders();
      if (menuOpen && window.innerWidth >= 1024) closeMenu(false);
      setupTouchFocus();
    });
  }
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('load', () => { measure(); measureSliders(); });
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(document.body);

  const onPref = () => {
    reduce = mqReduce.matches;
    fine = mqFine.matches;
    if (reduce) { resetScene(); revealEls.forEach((el) => el.classList.add('is-in')); ready(); }
    setupTouchFocus();
    if (cp) cp.schedule();
    ticker.wake();
  };
  (mqReduce.addEventListener ? mqReduce.addEventListener('change', onPref) : mqReduce.addListener(onPref));
  (mqFine.addEventListener ? mqFine.addEventListener('change', onPref) : mqFine.addListener(onPref));

  measure();
  measureSliders();
  setupTouchFocus();
  if (location.hash && location.hash.length > 1) {
    const id = decodeURIComponent(location.hash.slice(1));
    if (document.getElementById(id)) setTimeout(() => scrollToId(id, { instant: true }), 0);
  }
})();
