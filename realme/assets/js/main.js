/* =============================================================================
   Real Friday · realme — interações
   JS nativo, zero dependências.

   Diretrizes de fluidez aplicadas:
   - Camada GPU ligada pela visibilidade (.is-live via IntersectionObserver), nunca pelo movimento.
   - translate3d + rotate(0.02deg) (exceto blocos de texto), posições com subpixel (.toFixed(3)).
   - Suavização do ponteiro em dois estágios, normalizada pelo tempo do frame.
   - Um único requestAnimationFrame para a cena; leituras de layout só em resize/load/pointerenter.
   - Transition para estados (hover/reveal/foco), rAF para movimento contínuo —
     nunca no mesmo elemento e na mesma propriedade.
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
  const view = { w: 0, vw: 0, h: 0, u: 1, amp: 1, R: 40, maxY: 0, mode: 'desk' };

  // Mesma fórmula do CSS (--u): 1px de design em px reais para o modo atual
  function calcMode(vw, w) {
    if (vw >= 1440) return { mode: 'desk', u: clamp(w / 1680, 0.8, 1), amp: 1, R: 40 };
    if (vw >= 1024) return { mode: 'mid', u: clamp(w / 1080, 0.94, 1.2), amp: 0.82, R: 36 };
    if (vw >= 640) return { mode: 'tab', u: clamp(w / 768, 0.833, 1.25), amp: 0.82, R: 32 };
    return { mode: 'mob', u: clamp(w / 390, 0.82, 1.3), amp: 0.5, R: 24 };
  }

  // Posição no documento sem transforms (o parallax das seções não interfere nas medidas)
  function docTop(el) {
    let y = 0;
    while (el) { y += el.offsetTop; el = el.offsetParent; }
    return y;
  }

  const sections = $$('[data-section]');
  const secBox = new Map();
  const footer = $('.ftr');

  function measure() {
    view.w = doc.clientWidth;
    // largura útil sem a barra de rolagem: no <head> a barra ainda pode não existir
    if (doc.style.getPropertyValue('--vw') !== view.w + 'px') doc.style.setProperty('--vw', view.w + 'px');
    view.vw = window.innerWidth;
    view.h = window.innerHeight;
    Object.assign(view, calcMode(view.vw, view.w));
    view.maxY = Math.max(0, docTop(footer) + footer.offsetHeight - view.h);
    sections.forEach((sec) => secBox.set(sec, { top: docTop(sec), h: sec.offsetHeight }));
    stacks.forEach((s) => { s.top = docTop(s.el); });
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
     Barra de navegação: some ao descer, volta ao subir; fundo escuro fora do topo
     ------------------------------------------------------------------------ */
  const bar = $('[data-nav-bar]');
  let lastY = window.scrollY;
  let menuOpen = false;
  let lojasOpen = false;

  function setBarHidden(hide) {
    if (bar.classList.contains('is-hidden') === hide) return;
    bar.classList.toggle('is-hidden', hide);
    if (hide) bar.setAttribute('inert', ''); else if (!lojasOpen && !menuOpen) bar.removeAttribute('inert');
  }

  function updateBar() {
    const y = window.scrollY;
    bar.classList.toggle('is-solid', y > 40);
    if (y < 120) { setBarHidden(false); lastY = y; return; }
    const dy = y - lastY;
    if (Math.abs(dy) < 6) return;
    setBarHidden(dy > 0 || scroller.animating);
    lastY = y;
  }

  /* ---------------------------------------------------------------------------
     Link ativo no menu (pela posição medida das seções)
     ------------------------------------------------------------------------ */
  const navLinks = $$('[data-nav]').filter((l) => l.closest('.nav, .menu'));
  let activeId = 'home';
  function updateSpy() {
    const probeY = window.scrollY + view.h * 0.45;
    let id = 'home';
    sections.forEach((sec) => {
      const b = secBox.get(sec);
      if (b && b.top <= probeY) id = sec.id;
    });
    if (id === activeId) return;
    activeId = id;
    navLinks.forEach((l) => {
      if (l.getAttribute('href') === '#' + id) l.setAttribute('aria-current', 'true');
      else l.removeAttribute('aria-current');
    });
  }

  window.addEventListener('scroll', () => { updateBar(); updateSpy(); }, { passive: true });

  /* ---------------------------------------------------------------------------
     Navegação por âncoras
     ------------------------------------------------------------------------ */
  function scrollToId(id, opts) {
    const el = id === 'home' || !id ? null : document.getElementById(id);
    if (!el) { scroller.to(0, opts); return; }
    if (docTop(el) > window.scrollY) setBarHidden(true);
    scroller.to(docTop(el), opts);
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href === '#') { e.preventDefault(); return; } // links ainda sem destino (cadastro, regulamento, redes)
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
     Revelação ao rolar (uma vez)
     ------------------------------------------------------------------------ */
  const revealEls = $$('[data-reveal]');
  if (reduce || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-in'));
  } else {
    const ro = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        ro.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
    revealEls.forEach((el) => ro.observe(el));
  }

  /* ---------------------------------------------------------------------------
     Camadas vivas (GPU ligada enquanto visível) + estado dos loops CSS
     ------------------------------------------------------------------------ */
  const liveSet = new WeakSet();
  const lo = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      en.target.classList.toggle('is-live', en.isIntersecting);
      if (en.isIntersecting) liveSet.add(en.target); else liveSet.delete(en.target);
    });
    ticker.wake();
  }, { rootMargin: '20% 0px 20% 0px' });
  $$('[data-live], [data-stack], [data-sign]').forEach((el) => lo.observe(el));

  /* ---------------------------------------------------------------------------
     Cena: parallax do ponteiro (dois estágios) + rolagem suavizada + seções em
     camadas + luz que acompanha o mouse — tudo escrito no mesmo frame
     ------------------------------------------------------------------------ */
  const ptr = { tx: 0, ty: 0, sx: 0, sy: 0, cx: 0, cy: 0 };
  let sScroll = window.scrollY;

  const layers = $$('[data-depth-x], [data-scroll]').map((el) => ({
    el,
    dx: parseFloat(el.dataset.depthX) || 0,
    dy: parseFloat(el.dataset.depthY) || 0,
    sf: parseFloat(el.dataset.scroll) || 0,
    smax: parseFloat(el.dataset.scrollMax) || 0,
    sec: el.closest('[data-section]'),
    last: '',
  }));

  // Seções com topo arredondado: entram um pouco adiantadas (cobrindo só o respiro da
  // seção anterior) e desaceleram até a posição do layout quando o topo chega ao alto da tela.
  // Deslocamento máximo = 80% do raio → nunca abre fresta nem cobre conteúdo da vizinha.
  const stacks = $$('[data-stack]').map((el) => ({ el, top: 0, d: 0, last: '' }));
  const stackOf = (el) => stacks.find((s) => s.el === el.closest('[data-stack]')) || null;

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

  /* ---- Luz que acompanha o mouse (Como participar e Dúvidas) ---- */
  const glows = [];
  function addGlow(host, items) {
    const g = {
      host, items, stack: stackOf(host),
      on: false, left: 0, top: 0, mx: 0, my: 0,
      sx: 0, sy: 0, cx: 0, cy: 0, offs: [],
    };
    g.measure = () => {
      g.left = host.getBoundingClientRect().left + window.scrollX;
      g.top = docTop(host);
      const hl = g.left;
      const ht = g.top;
      g.offs = items.map((it) => ({
        el: it,
        glow: $('.glow', it === host ? host : it),
        x: it === host ? 0 : it.getBoundingClientRect().left + window.scrollX - hl,
        y: it === host ? 0 : docTop(it) - ht,
        last: '',
      }));
    };
    const target = () => {
      const d = g.stack ? g.stack.d : 0;
      return { x: g.mx + window.scrollX - g.left, y: g.my + window.scrollY - (g.top + d) };
    };
    host.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || reduce || !fine) return;
      g.measure();
      g.mx = e.clientX; g.my = e.clientY;
      const t = target();
      if (!g.on) { g.sx = g.cx = t.x; g.sy = g.cy = t.y; }
      g.on = true;
      items.forEach((it) => it.classList.add('is-glow'));
      ticker.wake();
    });
    host.addEventListener('pointermove', (e) => {
      if (!g.on) return;
      g.mx = e.clientX; g.my = e.clientY;
      ticker.wake();
    }, { passive: true });
    host.addEventListener('pointerleave', () => {
      g.on = false;
      items.forEach((it) => it.classList.remove('is-glow'));
    });
    g.target = target;
    glows.push(g);
    return g;
  }
  const stepsHost = $('[data-glow]');
  if (stepsHost) addGlow(stepsHost, [stepsHost]);
  const faqHost = $('[data-glow-list]');
  const faqGlow = faqHost ? addGlow(faqHost, $$('.faq__item', faqHost)) : null;

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

    // Seções em camadas
    const L = view.R * 0.8 * u;
    for (let i = 0; i < stacks.length; i++) {
      const S = stacks[i];
      const start = S.top - vh;
      const end = Math.min(S.top, view.maxY);
      const t = end > start ? clamp((sScroll - start) / (end - start), 0, 1) : 1;
      const e = t * t * (3 - 2 * t);
      S.d = -L * (1 - e);
      if (!liveSet.has(S.el) && S.last) continue;
      setT(S, `translate3d(0, ${S.d.toFixed(3)}px, 0)`);
    }

    for (let i = 0; i < layers.length; i++) {
      const Lr = layers[i];
      if (!liveSet.has(Lr.el)) continue;
      const x = ptr.cx * Lr.dx * amp * u;
      let yy = ptr.cy * Lr.dy * amp * u;
      if (Lr.sf && Lr.sec) {
        const b = secBox.get(Lr.sec);
        if (b) {
          const lim = Lr.smax * amp * u;
          yy += clamp(-(b.top - sScroll) * Lr.sf, -lim, lim);
        }
      }
      setT(Lr, `translate3d(${x.toFixed(3)}px, ${yy.toFixed(3)}px, 0) rotate(0.02deg)`);
    }

    let glowBusy = false;
    for (let i = 0; i < glows.length; i++) {
      const g = glows[i];
      if (!g.offs.length) continue;
      const t = g.target();
      g.sx += (t.x - g.sx) * k1;
      g.sy += (t.y - g.sy) * k1;
      g.cx += (g.sx - g.cx) * k2;
      g.cy += (g.sy - g.cy) * k2;
      for (let j = 0; j < g.offs.length; j++) {
        const o = g.offs[j];
        if (!o.glow) continue;
        const str = `translate3d(${(g.cx - o.x).toFixed(3)}px, ${(g.cy - o.y).toFixed(3)}px, 0) rotate(0.02deg)`;
        if (o.last !== str) { o.glow.style.transform = str; o.last = str; }
      }
      if (Math.abs(t.x - g.cx) > 0.05 || Math.abs(t.y - g.cy) > 0.05 || Math.abs(g.sx - g.cx) > 0.05 || Math.abs(g.sy - g.cy) > 0.05) glowBusy = true;
    }

    const settled =
      Math.abs(tx - ptr.cx) < 0.0005 && Math.abs(ty - ptr.cy) < 0.0005 &&
      Math.abs(ptr.sx - ptr.cx) < 0.0005 && Math.abs(ptr.sy - ptr.cy) < 0.0005 &&
      sScroll === y && !glowBusy;
    return !settled;
  }
  ticker.add(sceneTick);

  function resetScene() {
    layers.concat(stacks).forEach((o) => { o.el.style.transform = ''; o.last = ''; });
    stacks.forEach((s) => { s.d = 0; });
  }

  /* ---------------------------------------------------------------------------
     "Hover" por rolagem no touch: o item no centro da tela fica ativo
     ------------------------------------------------------------------------ */
  let focusIO = null;
  const focusGroups = new Map();
  function setupTouchFocus() {
    if (focusIO) { focusIO.disconnect(); focusIO = null; }
    focusGroups.clear();
    $$('[data-focus]').forEach((el) => el.classList.remove('is-focus'));
    if (fine || reduce) return;
    // Um item ativo por grupo: o último que entrou na faixa central e ainda está nela
    focusIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const el = en.target;
        const key = el.closest('.steps__list, .pcards, .wtable__list') || el;
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
    $$('[data-focus]').forEach((el) => focusIO.observe(el));
  }

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

    // Com duas colunas (título fixo ao lado das perguntas), fechar uma resposta e abrir outra
    // faria a seção encolher e crescer de novo. Mede-se a altura final sem transição, volta ao
    // estado atual e anima o contêiner direto de h0 até h1, junto com as respostas.
    const DUR = 650;
    let busyUntil = 0;
    let unlockT = 0;
    const done = () => { root.style.height = ''; if (faqGlow) faqGlow.measure(); measure(); };
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
        done();
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
      unlockT = setTimeout(done, DUR);
    });
  });

  /* ---------------------------------------------------------------------------
     Ganhadores: filtro por prêmio (a lista muda de altura direto ao tamanho final)
     ------------------------------------------------------------------------ */
  (() => {
    const list = $('[data-winners]');
    if (!list) return;
    const table = list.closest('.wtable');
    const rows = $$('.wrow', list);
    const btns = $$('[data-filter]');
    let current = 'todos';
    let timer = 0;
    const markLast = () => {
      const vis = rows.filter((r) => !r.hidden);
      rows.forEach((r) => r.classList.toggle('is-last', r === vis[vis.length - 1]));
    };
    markLast();
    btns.forEach((b) => b.addEventListener('click', () => {
      const f = b.dataset.filter;
      if (f === current) return;
      current = f;
      btns.forEach((x) => {
        const on = x === b;
        x.classList.toggle('is-active', on);
        x.setAttribute('aria-pressed', String(on));
      });
      const match = (r) => f === 'todos' || r.dataset.prize === f;
      clearTimeout(timer);
      if (reduce) {
        rows.forEach((r) => { r.hidden = !match(r); r.classList.remove('is-out'); });
        markLast();
        measure();
        return;
      }
      // 1) some com o que sai
      rows.forEach((r) => { if (!match(r) && !r.hidden) r.classList.add('is-out'); });
      timer = setTimeout(() => {
        const h0 = table.getBoundingClientRect().height;
        rows.forEach((r) => {
          const m = match(r);
          if (!m) { r.hidden = true; r.classList.remove('is-out'); }
          else if (r.hidden) { r.hidden = false; r.classList.add('is-out'); }
        });
        markLast();
        const h1 = table.getBoundingClientRect().height;
        table.style.height = h0 + 'px';
        table.getBoundingClientRect();
        table.style.height = h1 + 'px';
        // 2) entra o que ficou, em cascata
        rows.filter((r) => !r.hidden && r.classList.contains('is-out')).forEach((r, i) => {
          setTimeout(() => r.classList.remove('is-out'), 60 + i * 60);
        });
        timer = setTimeout(() => { table.style.height = ''; measure(); }, 650);
      }, 260);
    }));
  })();

  /* ---------------------------------------------------------------------------
     Menu mobile / tablet
     ------------------------------------------------------------------------ */
  const menu = $('[data-menu]');
  const openBtns = $$('[data-menu-open]');
  const closeBtn = $('[data-menu-close]');
  const outside = [bar, $('main'), $('footer')];
  let opener = null;

  function trapTab(e, box) {
    const f = $$('a[href], button:not([disabled]), input, select, [tabindex="0"]', box).filter((el) => el.offsetParent !== null && !el.closest('[inert]'));
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !box.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function openMenu(btn) {
    if (menuOpen || !menu) return;
    menuOpen = true;
    opener = btn || openBtns[0];
    menu.removeAttribute('inert');
    menu.classList.add('is-open');
    openBtns.forEach((b) => b.setAttribute('aria-expanded', 'true'));
    outside.forEach((el) => el && el.setAttribute('inert', ''));
    doc.classList.add('is-locked');
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
    if (!bar.classList.contains('is-hidden')) bar.removeAttribute('inert');
    doc.classList.remove('is-locked');
    scroller.lock(false);
    if (restoreFocus && opener) opener.focus({ preventScroll: true });
  }
  if (menu) {
    menu.setAttribute('inert', '');
    openBtns.forEach((b) => b.addEventListener('click', () => openMenu(b)));
    closeBtn.addEventListener('click', () => closeMenu());
  }

  /* ---------------------------------------------------------------------------
     Popup · Lojas e quiosques oficiais
     - modal (≥ 640px) / bottom sheet (mobile)
     - busca por nome ou CNPJ (sem acento, só dígitos no CNPJ) + filtro por estado
     - fecha só por ação clara: X, "Entendi", Esc, toque simples no fundo (sem arrastar)
       ou arrastando a alça para baixo no mobile; rolar a lista nunca fecha
     ------------------------------------------------------------------------ */
  const lojas = (() => {
    const root = $('[data-lojas]');
    const data = window.REALME_LOJAS;
    if (!root || !data) return null;
    const box = $('.lojas__box', root);
    const overlay = $('[data-lojas-overlay]', root);
    const listEl = $('[data-lojas-list]', root);
    const body = $('.lojas__body', root);
    const search = $('[data-lojas-search]', root);
    const clearBtn = $('[data-lojas-clear]', root);
    const select = $('[data-lojas-uf]', root);
    const chipsEl = $('[data-lojas-chips]', root);
    const note = $('[data-lojas-note]', root);
    const grip = $('[data-lojas-grip]', root);
    const dragZone = $('[data-lojas-drag]', root);
    const total = data.lojas.length;
    const defaultNote = `${total} lojas e quiosques participantes. A lista pode ser atualizada conforme o regulamento.`;

    const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const lojasArr = data.lojas.map(([n, c, uf]) => ({ n, c, uf, nn: norm(n), cd: c.replace(/\D/g, '') }));
    const counts = {};
    lojasArr.forEach((l) => { counts[l.uf] = (counts[l.uf] || 0) + 1; });
    const estados = data.estados.filter((e) => counts[e.uf]);
    const plural = (n) => (n === 1 ? '1 loja' : `${n} lojas`);

    let uf = '';
    let q = '';

    // Filtro por estado: <select> (modal) e chips roláveis (bottom sheet)
    select.innerHTML = '<option value="">Todos os estados</option>' +
      estados.map((e) => `<option value="${e.uf}">${esc(e.nome)}</option>`).join('');
    chipsEl.innerHTML = `<button class="uchip is-active" type="button" data-uf="" aria-pressed="true">Todos <em>${total}</em></button>` +
      estados.map((e) => `<button class="uchip" type="button" data-uf="${e.uf}" aria-pressed="false" aria-label="${esc(e.nome)}, ${plural(counts[e.uf])}">${e.uf} <em>${counts[e.uf]}</em></button>`).join('');
    const chips = $$('.uchip', chipsEl);

    function mark(text, nText, needle) {
      if (!needle) return esc(text);
      const i = nText.indexOf(needle);
      if (i < 0) return esc(text);
      return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + needle.length)) + '</mark>' + esc(text.slice(i + needle.length));
    }
    function markCnpj(c, digits) {
      if (!digits) return esc(c);
      const cd = c.replace(/\D/g, '');
      const i = cd.indexOf(digits);
      if (i < 0) return esc(c);
      // posições dos dígitos dentro do CNPJ formatado
      const pos = [];
      for (let k = 0; k < c.length; k++) if (/\d/.test(c[k])) pos.push(k);
      const a = pos[i];
      const b = pos[i + digits.length - 1] + 1;
      return esc(c.slice(0, a)) + '<mark>' + esc(c.slice(a, b)) + '</mark>' + esc(c.slice(b));
    }

    function render() {
      const nq = norm(q.trim());
      const dq = q.replace(/\D/g, '');
      const useDigits = dq.length >= 2 && /^[\d.\/\-\s]+$/.test(q.trim());
      const hits = lojasArr.filter((l) => {
        if (uf && l.uf !== uf) return false;
        if (!nq) return true;
        return l.nn.includes(nq) || (useDigits && l.cd.includes(dq));
      });
      let html = '';
      estados.forEach((e) => {
        const g = hits.filter((l) => l.uf === e.uf);
        if (!g.length) return;
        html += `<section class="lojas__group" aria-label="${esc(e.nome)}">` +
          `<div class="lojas__gh"><h3>${esc(e.nome)}</h3><span class="lojas__count">${plural(g.length)}</span></div>` +
          '<ul class="lojas__items">' +
          g.map((l) => `<li class="loja"><span class="loja__n">${mark(l.n, l.nn, nq)}</span><span class="loja__c">CNPJ ${useDigits ? markCnpj(l.c, dq) : mark(l.c, l.c.toLowerCase(), nq)}</span></li>`).join('') +
          '</ul></section>';
      });
      if (!hits.length) {
        html = `<div class="lojas__empty"><p>Nenhuma loja encontrada${q.trim() ? ` para <b>“${esc(q.trim())}”</b>` : ''}${uf ? ` em ${esc(estados.find((e) => e.uf === uf).nome)}` : ''}.</p>` +
          '<button type="button" data-lojas-reset>Limpar filtros</button></div>';
      } else {
        html += `<p class="lojas__endnote">${defaultNote}</p>`;
      }
      listEl.innerHTML = html;
      listEl.scrollTop = 0;
      const filtered = !!(uf || nq);
      note.textContent = filtered ? `${hits.length === 1 ? '1 loja encontrada' : hits.length + ' lojas encontradas'} de ${total}. A lista pode ser atualizada conforme o regulamento.` : defaultNote;
      clearBtn.hidden = !q;
      updateFade();
    }

    function updateFade() {
      body.classList.toggle('is-end', listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 2);
    }
    listEl.addEventListener('scroll', updateFade, { passive: true });

    function setUf(v) {
      uf = v;
      select.value = v;
      chips.forEach((c) => {
        const on = c.dataset.uf === v;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-pressed', String(on));
        if (on && chipsEl.scrollWidth > chipsEl.clientWidth) {
          const x = c.offsetLeft - (chipsEl.clientWidth - c.offsetWidth) / 2;
          chipsEl.scrollTo({ left: Math.max(0, x), behavior: reduce ? 'auto' : 'smooth' });
        }
      });
      render();
    }

    let qT = 0;
    search.addEventListener('input', () => {
      q = search.value;
      clearBtn.hidden = !q;
      clearTimeout(qT);
      qT = setTimeout(render, 90);
    });
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && search.value) { e.stopPropagation(); search.value = ''; q = ''; render(); }
      if (e.key === 'Enter') search.blur();
    });
    clearBtn.addEventListener('click', () => { search.value = ''; q = ''; render(); search.focus(); });
    select.addEventListener('change', () => setUf(select.value));
    chipsEl.addEventListener('click', (e) => {
      const c = e.target.closest('.uchip');
      if (c) setUf(c.dataset.uf);
    });
    listEl.addEventListener('click', (e) => {
      if (!e.target.closest('[data-lojas-reset]')) return;
      search.value = '';
      q = '';
      setUf('');
    });

    const setPlaceholder = () => {
      search.placeholder = view.vw < 640 ? 'Buscar loja ou CNPJ' : 'Buscar por nome da loja ou CNPJ';
    };

    let lojasOpener = null;
    let closeT = 0;
    function open(btn) {
      if (lojasOpen) return;
      if (menuOpen) closeMenu(false);
      lojasOpen = true;
      lojasOpener = btn || document.activeElement;
      clearTimeout(closeT);
      setPlaceholder();
      render();
      root.style.setProperty('--drag', '0px');
      root.removeAttribute('inert');
      root.classList.add('is-open');
      [bar, $('main'), $('footer')].forEach((el) => el && el.setAttribute('inert', ''));
      doc.classList.add('is-locked');
      scroller.lock(true);
      setTimeout(() => {
        // no desktop a busca já fica pronta; no toque, sem abrir o teclado sozinho
        if (fine) search.focus({ preventScroll: true });
        else box.focus({ preventScroll: true });
      }, 80);
    }
    function close() {
      if (!lojasOpen) return;
      lojasOpen = false;
      root.classList.remove('is-open', 'is-dragging');
      root.style.setProperty('--drag', '0px');
      $('main').removeAttribute('inert');
      $('footer').removeAttribute('inert');
      if (!bar.classList.contains('is-hidden')) bar.removeAttribute('inert');
      doc.classList.remove('is-locked');
      scroller.lock(false);
      closeT = setTimeout(() => root.setAttribute('inert', ''), 600);
      if (lojasOpener && lojasOpener.focus) lojasOpener.focus({ preventScroll: true });
    }

    root.setAttribute('inert', '');
    $$('[data-lojas-open]').forEach((b) => b.addEventListener('click', () => open(b)));
    $$('[data-lojas-close]', root).forEach((b) => b.addEventListener('click', close));

    // Fundo: só fecha num toque/clique "limpo" (começou e terminou no fundo, sem arrastar)
    let ov = null;
    overlay.addEventListener('pointerdown', (e) => { ov = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    overlay.addEventListener('pointerup', (e) => {
      if (!ov) return;
      const moved = Math.hypot(e.clientX - ov.x, e.clientY - ov.y);
      const quick = performance.now() - ov.t < 600;
      ov = null;
      if (moved < 8 && quick) close();
    });
    overlay.addEventListener('pointercancel', () => { ov = null; });

    // Bottom sheet: arrastar a alça/cabeçalho para baixo fecha (só no mobile)
    let drag = null;
    const startDrag = (e) => {
      if (view.vw >= 640 || e.button > 0 || e.target.closest('button, input, select')) return;
      drag = { y: e.clientY, t: performance.now(), dy: 0, v: 0, id: e.pointerId, el: e.currentTarget };
      e.currentTarget.setPointerCapture(e.pointerId);
      root.classList.add('is-dragging');
    };
    const moveDrag = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const raw = e.clientY - drag.y;
      const now = performance.now();
      const dy = raw > 0 ? raw : raw * 0.15; // resistência para cima
      drag.v = (dy - drag.dy) / Math.max(1, now - drag.t);
      drag.dy = dy;
      drag.t = now;
      root.style.setProperty('--drag', dy.toFixed(3) + 'px');
    };
    const endDrag = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      root.classList.remove('is-dragging');
      if (d.dy > 120 * view.u || (d.dy > 40 && d.v > 0.6)) close();
      else root.style.setProperty('--drag', '0px');
    };
    [grip, dragZone].forEach((z) => {
      z.addEventListener('pointerdown', startDrag);
      z.addEventListener('pointermove', moveDrag);
      z.addEventListener('pointerup', endDrag);
      z.addEventListener('pointercancel', endDrag);
    });

    return { open, close, root, box, get isOpen() { return lojasOpen; } };
  })();

  /* ---------------------------------------------------------------------------
     Teclado: Esc fecha o que estiver aberto; Tab fica preso no diálogo
     ------------------------------------------------------------------------ */
  document.addEventListener('keydown', (e) => {
    if (lojas && lojasOpen) {
      if (e.key === 'Escape') { e.preventDefault(); lojas.close(); return; }
      if (e.key === 'Tab') trapTab(e, lojas.box);
      return;
    }
    if (menuOpen) {
      if (e.key === 'Escape') { closeMenu(); return; }
      if (e.key === 'Tab') trapTab(e, menu);
    }
  });

  /* ---------------------------------------------------------------------------
     Intro do KV: começa quando as imagens principais estão decodificadas
     ------------------------------------------------------------------------ */
  function ready() {
    if (doc.classList.contains('is-ready')) return;
    doc.classList.add('is-ready');
    setTimeout(() => doc.classList.add('is-settled'), reduce ? 0 : 2400);
  }
  if (reduce) ready();
  else {
    const imgs = $$('.stage__pop img, .kv__logo img');
    const decode = (img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve());
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([
      Promise.all(imgs.map(decode).concat(fonts)),
      new Promise((r) => setTimeout(r, 1600)),
    ]).then(() => requestAnimationFrame(ready));
  }

  /* ---------------------------------------------------------------------------
     Resize / preferências
     ------------------------------------------------------------------------ */
  let rz = 0;
  let lastMode = '';
  function onResize() {
    if (rz) return;
    rz = requestAnimationFrame(() => {
      rz = 0;
      measure();
      if (menuOpen && window.innerWidth >= 1024) closeMenu(false);
      if (view.mode !== lastMode) { lastMode = view.mode; setupTouchFocus(); }
      updateSpy();
    });
  }
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('load', () => { measure(); updateSpy(); });
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(document.body);

  const onPref = () => {
    reduce = mqReduce.matches;
    fine = mqFine.matches;
    if (reduce) { resetScene(); revealEls.forEach((el) => el.classList.add('is-in')); ready(); }
    setupTouchFocus();
    ticker.wake();
  };
  (mqReduce.addEventListener ? mqReduce.addEventListener('change', onPref) : mqReduce.addListener(onPref));
  (mqFine.addEventListener ? mqFine.addEventListener('change', onPref) : mqFine.addListener(onPref));

  measure();
  lastMode = view.mode;
  setupTouchFocus();
  updateBar();
  updateSpy();
  if (location.hash && location.hash.length > 1) {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id === 'lojas' && lojas) setTimeout(() => lojas.open(), 400);
    else if (document.getElementById(id)) setTimeout(() => scrollToId(id, { instant: true }), 0);
  }
})();
