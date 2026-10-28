/* =========================================================================
   Natal de Prêmios Mahogany — interações
   JavaScript nativo, sem dependências.
   ========================================================================= */
(() => {
  'use strict';

  const doc = document.documentElement;
  const body = document.body;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqFinePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let reduce = mqReduce.matches;
  mqReduce.addEventListener?.('change', (e) => { reduce = e.matches; });

  /* ---------- Largura útil da viewport (sem a barra de rolagem) ---------- */
  const setVW = () => doc.style.setProperty('--vw', `${doc.clientWidth / 100}px`);
  setVW();

  /* ---------- Links ainda sem destino (cadastro, regulamento) ---------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-pendente]');
    if (a && (a.getAttribute('href') || '#') === '#') e.preventDefault();
  });

  /* =======================================================================
     ENTRADA DO KV
     ======================================================================= */
  const startIntro = () => requestAnimationFrame(() => requestAnimationFrame(() => body.classList.add('is-loaded')));
  Promise.race([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise((r) => setTimeout(r, 900)),
  ]).then(startIntro);

  /* =======================================================================
     SCROLL SUAVE INTELIGENTE
     -----------------------------------------------------------------------
     Só assume a rolagem da roda do mouse se o navegador NÃO tiver scroll
     suave próprio. No primeiro giro da roda observamos a rolagem nativa:
     se ela anima por vários quadros, o navegador já suaviza → mantemos o
     nativo. Se salta de uma vez → ativamos a suavização própria.
     Trackpads, toque e "movimento reduzido" nunca são interceptados.
     ======================================================================= */
  const Scroller = (() => {
    let mode = 'detect'; // 'detect' | 'native' | 'custom'
    let current = window.scrollY;
    let target = current;
    let running = false;
    let lastSet = -1;
    let lastTime = 0;
    let tween = null;
    let probing = false;
    let probeEvents = 0;
    let locked = false;

    const maxScroll = () => Math.max(0, doc.scrollHeight - window.innerHeight);
    const setY = (y) => { lastSet = y; window.scrollTo(0, y); };
    const easeInOut = (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);

    function frame(now) {
      if (!running) return;
      if (tween) {
        const t = clamp((now - tween.start) / tween.dur, 0, 1);
        current = tween.from + (tween.to - tween.from) * easeInOut(t);
        setY(current);
        if (t >= 1) { tween = null; target = current; running = false; return; }
      } else {
        const dt = lastTime ? Math.min(64, now - lastTime) : 16.7;
        const k = 1 - Math.pow(1 - 0.105, dt / 16.7);
        current += (target - current) * k;
        if (Math.abs(target - current) < 0.4) { current = target; setY(current); running = false; lastTime = 0; return; }
        setY(current);
      }
      lastTime = now;
      requestAnimationFrame(frame);
    }
    function run() { if (!running) { running = true; lastTime = 0; requestAnimationFrame(frame); } }
    function stop() { running = false; tween = null; current = target = window.scrollY; }

    // Roda de mouse "com dentes" (não trackpad)
    function isNotchedWheel(e) {
      if (e.deltaMode === 1 || e.deltaMode === 2) return true;
      if (e.deltaX !== 0) return false;
      if (typeof e.wheelDeltaY === 'number' && e.wheelDeltaY !== 0) return Math.abs(e.wheelDeltaY) >= 120 && e.wheelDeltaY % 120 === 0;
      return Math.abs(e.deltaY) >= 100 && Number.isInteger(e.deltaY);
    }

    function probe() {
      probing = true;
      probeEvents = 1;
      const y0 = window.scrollY;
      const samples = [];
      let n = 0;
      const step = () => {
        samples.push(window.scrollY);
        if (++n < 14) requestAnimationFrame(step); else decide();
      };
      requestAnimationFrame(step);
      function decide() {
        probing = false;
        const total = samples[samples.length - 1] - y0;
        if (Math.abs(total) < 2) return; // não rolou (topo/fim): tenta no próximo giro
        let changes = Math.abs(samples[0] - y0) > 0.5 ? 1 : 0;
        for (let i = 1; i < samples.length; i++) if (Math.abs(samples[i] - samples[i - 1]) > 0.5) changes++;
        // sem suavização nativa: cada evento de roda gera um único salto
        mode = changes > probeEvents + 1 ? 'native' : 'custom';
        doc.dataset.scroll = mode;
        // navegador já suaviza: o listener passa a ser passivo (não atrasa a rolagem nativa)
        if (mode === 'native') usePassiveWheel();
      }
    }

    function onWheel(e) {
      if (tween) { tween = null; running = false; current = target = window.scrollY; }
      if (e.ctrlKey || e.defaultPrevented || locked || reduce || mode === 'native') return;
      if (!isNotchedWheel(e)) { if (running) stop(); return; }
      if (mode === 'detect') { if (probing) probeEvents++; else probe(); return; }
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      if (!running) current = target = window.scrollY;
      target = clamp(target + dy, 0, maxScroll());
      run();
    }

    const cancelTween = () => { if (tween) stop(); };
    function usePassiveWheel() {
      window.removeEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('wheel', cancelTween, { passive: true });
    }
    if (reduce) window.addEventListener('wheel', cancelTween, { passive: true });
    else window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('scroll', () => {
      // rolagem externa (barra, teclado) durante a animação → cede o controle
      if (running && Math.abs(window.scrollY - lastSet) > 3) stop();
    }, { passive: true });
    ['touchstart', 'keydown', 'mousedown'].forEach((ev) => window.addEventListener(ev, () => { if (tween) stop(); }, { passive: true }));

    // Navegação até âncoras com a mesma suavidade
    function scrollToY(y) {
      y = clamp(Math.round(y), 0, maxScroll());
      if (reduce) { window.scrollTo(0, y); return; }
      const from = window.scrollY;
      const dist = Math.abs(y - from);
      if (dist < 2) return;
      tween = { from, to: y, start: performance.now(), dur: clamp(520 + dist * 0.22, 700, 1500) };
      running = false;
      run();
    }
    return { scrollToY, lock: (v) => { locked = v; if (v) stop(); } };
  })();

  /* =======================================================================
     MENU (sticky, compacto, esconde ao descer) + MENU MOBILE + ÂNCORAS
     ======================================================================= */
  const header = $('[data-header]');
  const burger = $('[data-burger]');
  const mobileMenu = $('[data-mobile-menu]');
  let menuOpen = false;

  function setMenu(open) {
    menuOpen = open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    mobileMenu.classList.toggle('is-open', open);
    mobileMenu.setAttribute('aria-hidden', String(!open));
    doc.style.overflow = open ? 'hidden' : '';
    Scroller.lock(open);
    header.classList.remove('is-hidden');
    if (open) setTimeout(() => $('.mobile-menu__link', mobileMenu)?.focus({ preventScroll: true }), 250);
  }
  burger.addEventListener('click', () => setMenu(!menuOpen));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) { setMenu(false); burger.focus(); } });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    if (menuOpen) setMenu(false);
    const y = id === 'inicio' ? 0 : el.getBoundingClientRect().top + window.scrollY - header.offsetHeight + 1;
    Scroller.scrollToY(y);
    history.replaceState(null, '', id === 'inicio' ? location.pathname + location.search : `#${id}`);
  });

  let lastY = window.scrollY;
  function updateHeader(y) {
    header.classList.toggle('is-scrolled', y > 8);
    const kvBottom = kv ? kv.offsetHeight : 600;
    if (!menuOpen) {
      if (y > kvBottom * 0.6 && y - lastY > 6) header.classList.add('is-hidden');
      else if (lastY - y > 6 || y < kvBottom * 0.6) header.classList.remove('is-hidden');
    }
    lastY = y;
  }
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));

  // Seção atual destacada no menu
  const navMap = { 'como-participar': 'como-participar', premios: 'premios', roleta: 'premios', duvidas: 'duvidas', ganhadores: 'ganhadores' };
  const navLinks = $$('.nav__link, .mobile-menu__link');
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const key = navMap[en.target.id];
      navLinks.forEach((l) => l.classList.toggle('is-current', !!key && l.getAttribute('href') === `#${key}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['inicio', ...Object.keys(navMap)].forEach((id) => { const el = document.getElementById(id); if (el) spy.observe(el); });

  /* =======================================================================
     ELEMENTOS QUE APARECEM COM O SCROLL
     ======================================================================= */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      el.classList.add('is-in');
      revealIO.unobserve(el);
      const d = parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0;
      setTimeout(() => el.classList.add('is-settled'), (d + 1.3) * 1000);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
  $$('[data-reveal]').forEach((el) => revealIO.observe(el));

  /* =======================================================================
     "HOVER" POR SCROLL EM TELAS DE TOQUE
     O elemento que passa pelo centro da tela recebe o estado de hover.
     ======================================================================= */
  if (!mqFinePointer.matches && 'IntersectionObserver' in window) {
    const centerIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => en.target.classList.toggle('is-active', en.isIntersecting));
    }, { rootMargin: '-38% 0px -38% 0px' });
    $$('[data-scroll-hover]').forEach((el) => centerIO.observe(el));
  }

  /* =======================================================================
     BOKEH GLOBAL
     Uma única imagem fixa sobre o site. Aparece quando o centro de cada uma
     das 4 primeiras seções passa pelo centro da tela (fade in/out contínuo,
     ligado à posição do scroll — se a rolagem parar no meio, fica no meio).
     Cada seção usa uma orientação diferente da mesma imagem.
     ======================================================================= */
  const bokeh = $('.bokeh');
  const bokehImg = $('.bokeh__img');
  const bokehSecs = $$('[data-bokeh]').sort((a, b) => a.dataset.bokeh - b.dataset.bokeh);
  const PEAK = [1, 0.3, 0.7, 0.25];                    // opacidades do Figma por seção
  const FLIP = [[1, 1], [-1, 1], [1, -1], [-1, -1]];    // normal · espelho H · espelho V · H+V
  let bokehMetrics = [];
  let bokehActive = -1;
  let bokehLast = -1;

  function measureBokeh() {
    const vh = window.innerHeight;
    const sy = window.scrollY;
    const boxes = bokehSecs.map((el) => { const r = el.getBoundingClientRect(); return { c: r.top + sy + r.height / 2 }; });
    bokehMetrics = boxes.map((b, i) => {
      let maxR = Infinity;
      if (boxes[i - 1]) maxR = Math.min(maxR, (b.c - boxes[i - 1].c) * 0.48);
      if (boxes[i + 1]) maxR = Math.min(maxR, (boxes[i + 1].c - b.c) * 0.48);
      return { c: b.c, r: Math.max(120, Math.min(vh * 0.56, maxR)) };
    });
  }

  /* =======================================================================
     SUAVIZAÇÃO DO QUE ACOMPANHA O SCROLL
     Em vez de aplicar a posição "seca" a cada evento de scroll (o que gera
     pequenos degraus), cada efeito persegue seu alvo com interpolação
     contínua em um único rAF. Resultado: movimento fluido, sem "escada".
     ======================================================================= */
  const smoothItems = [];
  let smoothRunning = false;
  let smoothLast = 0;
  function smoothItem(apply, ease = 0.14) {
    const it = { cur: 0, tgt: 0, shown: NaN, ready: false, ease, apply };
    smoothItems.push(it);
    return it;
  }
  function setSmooth(it, value, snap) {
    it.tgt = value;
    if (snap || !it.ready) { it.cur = value; it.ready = true; }
    if (!smoothRunning) { smoothRunning = true; smoothLast = 0; requestAnimationFrame(smoothFrame); }
  }
  function smoothFrame(now) {
    const dt = smoothLast ? Math.min(64, now - smoothLast) : 16.7;
    smoothLast = now;
    let moving = false;
    smoothItems.forEach((it) => {
      const d = it.tgt - it.cur;
      if (Math.abs(d) > 0.02) { it.cur += d * (1 - Math.pow(1 - it.ease, dt / 16.7)); moving = true; } else it.cur = it.tgt;
      const v = Math.round(it.cur * 100) / 100;
      if (v !== it.shown) { it.shown = v; it.apply(v); }
    });
    if (moving) requestAnimationFrame(smoothFrame); else { smoothRunning = false; smoothLast = 0; }
  }

  // Bokeh acompanha a direção do scroll (desce quando desce, sobe quando sobe) — bem leve
  const BOKEH_PARALLAX = 0.1;
  const bokehShift = smoothItem((v) => bokehImg.style.setProperty('--py', `${v}px`), 0.12);

  function updateBokeh(y) {
    const vh = window.innerHeight;
    const mid = y + vh / 2;
    let best = -1;
    let op = 0;
    bokehMetrics.forEach((m, i) => {
      const d = Math.abs(m.c - mid) / m.r;
      const f = 1 - smoothstep(0.16, 1, d);
      if (f > 0 && PEAK[i] * f > op) { op = PEAK[i] * f; best = i; }
    });
    let switched = false;
    if (best !== -1 && best !== bokehActive) {
      bokehActive = best;
      switched = true;
      bokehImg.style.setProperty('--fx', FLIP[best][0]);
      bokehImg.style.setProperty('--fy', FLIP[best][1]);
    }
    const v = Math.round(op * 1000) / 1000;
    if (v !== bokehLast) { bokeh.style.opacity = v; bokehLast = v; }
    if (best !== -1 && !reduce) {
      const lim = vh * 0.06;
      // na troca de seção a imagem está invisível: reposiciona sem deslizar
      setSmooth(bokehShift, clamp((mid - bokehMetrics[best].c) * BOKEH_PARALLAX, -lim, lim), switched);
    }
  }

  /* =======================================================================
     PARALLAX SUAVE (KV e fotos em arco)
     ======================================================================= */
  const kv = $('.kv');
  const mqDesktop = matchMedia('(min-width: 1100px)');
  const parallaxEls = $$('[data-parallax]').map((el) => {
    const desk = el.hasAttribute('data-parallax-desk');
    return { el, desk, f: parseFloat(el.dataset.parallax) || 0, it: smoothItem((v) => { el.style.transform = v ? `translate3d(0, ${v}px, 0)` : ''; }) };
  });
  const archImgs = $$('[data-parallax-inner]').map((img) => ({
    img, box: img.parentElement, visible: false,
    it: smoothItem((v) => { img.style.transform = `translate3d(0, ${v}px, 0)`; }, 0.1),
  }));
  const archIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => { const a = archImgs.find((x) => x.box === en.target); if (a) a.visible = en.isIntersecting; });
  });
  archImgs.forEach((a) => archIO.observe(a.box));

  function updateParallax(y) {
    if (reduce) return;
    const kvH = kv.offsetHeight;
    if (y < kvH + 200) {
      const desk = mqDesktop.matches;
      // Mahy e prêmios se sobrepõem no tablet/mobile: lá eles não se movem entre si
      parallaxEls.forEach((p) => setSmooth(p.it, p.desk && !desk ? 0 : y * p.f));
    }
    const vh = window.innerHeight;
    archImgs.forEach((a) => {
      if (!a.visible) return;
      const r = a.box.getBoundingClientRect();
      const p = clamp((r.top + r.height / 2 - vh / 2) / vh, -1, 1); // -1..1
      setSmooth(a.it, p * r.height * 0.028);
    });
  }

  /* =======================================================================
     FLARES: reagem ao cursor como reflexo de lente (desktop)
     ======================================================================= */
  const flares = $$('[data-lens]').map((el) => ({ el, s: parseFloat(el.dataset.lens) || 1 }));
  const lens = { x: 0, y: 0, tx: 0, ty: 0, running: false, last: 0 };
  function lensFrame(now) {
    const k = 1 - Math.pow(1 - 0.06, (lens.last ? Math.min(64, now - lens.last) : 16.7) / 16.7);
    lens.last = now;
    lens.x += (lens.tx - lens.x) * k;
    lens.y += (lens.ty - lens.y) * k;
    const amp = kv.offsetWidth * 0.012;
    flares.forEach(({ el, s }) => { el.style.transform = `translate3d(${(-lens.x * amp * s).toFixed(2)}px, ${(-lens.y * amp * s).toFixed(2)}px, 0)`; });
    if (Math.abs(lens.tx - lens.x) > 0.001 || Math.abs(lens.ty - lens.y) > 0.001) requestAnimationFrame(lensFrame);
    else { lens.running = false; lens.last = 0; }
  }
  function lensTo(x, y) {
    lens.tx = x; lens.ty = y;
    if (!lens.running && !reduce) { lens.running = true; requestAnimationFrame(lensFrame); }
  }
  if (mqFinePointer.matches) {
    kv.addEventListener('pointermove', (e) => {
      const r = kv.getBoundingClientRect();
      lensTo(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2);
    });
    kv.addEventListener('pointerleave', () => lensTo(0, 0));
  }

  /* =======================================================================
     LOOP DE SCROLL (um único rAF para tudo que depende da posição)
     ======================================================================= */
  let ticking = false;
  function onScrollFrame() {
    ticking = false;
    const y = window.scrollY;
    updateBokeh(y);
    updateParallax(y);
    updateHeader(y);
    if (!mqFinePointer.matches && kv) {
      const p = clamp(y / Math.max(1, kv.offsetHeight), 0, 1);
      lensTo(0, -p * 1.4);
    }
  }
  const requestTick = () => { if (!ticking) { ticking = true; requestAnimationFrame(onScrollFrame); } };
  window.addEventListener('scroll', requestTick, { passive: true });

  function remeasure() {
    setVW();
    measureBokeh();
    movePill(true);
    requestTick();
  }
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(remeasure, 120); });
  if ('ResizeObserver' in window) {
    let roTimer;
    new ResizeObserver(() => { clearTimeout(roTimer); roTimer = setTimeout(() => { measureBokeh(); requestTick(); }, 80); }).observe($('main'));
  }
  window.addEventListener('load', remeasure);

  /* =======================================================================
     ROLETA — não gira: "dá indício" de que quer girar
     -----------------------------------------------------------------------
     Fatias e ponteiro são uma mola física (posição + velocidade) integrada
     a cada quadro. Hover, indício automático e toque apenas trocam o ALVO
     e a rigidez da mola — a posição nunca é reiniciada, então o movimento
     é sempre contínuo, mesmo quando uma interação interrompe outra.
     ======================================================================= */
  const wheel = $('[data-wheel]');
  if (wheel) {
    const disc = $('[data-wheel-disc]', wheel);
    const pointer = $('.wheel__ponteiro', wheel);
    const ARMA = { k: 36, c: 12 };     // criticamente amortecida: arma devagar, sem quique
    const SOLTA = { k: 56, c: 4.6 };   // subamortecida: passa um pouco do ponto e assenta
    const PONTEIRO = { k: 260, c: 15 };
    const s = { a: 0, v: 0, alvo: 0, k: ARMA.k, c: ARMA.c, pa: 0, pv: 0, running: false, last: 0 };

    const alvoPonteiro = () => clamp(-s.a * 0.45 - s.v * 0.09, -14, 14);
    function frame(now) {
      const dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 1 / 60;
      s.last = now;
      const n = Math.max(1, Math.ceil(dt * 240));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        s.v += (s.k * (s.alvo - s.a) - s.c * s.v) * h;
        s.a += s.v * h;
        s.pv += (PONTEIRO.k * (alvoPonteiro() - s.pa) - PONTEIRO.c * s.pv) * h;
        s.pa += s.pv * h;
      }
      disc.style.rotate = `${s.a.toFixed(3)}deg`;
      pointer.style.rotate = `${s.pa.toFixed(3)}deg`;
      const parado = Math.abs(s.alvo - s.a) < 0.004 && Math.abs(s.v) < 0.01
        && Math.abs(alvoPonteiro() - s.pa) < 0.004 && Math.abs(s.pv) < 0.01;
      if (parado) { s.running = false; s.last = 0; } else requestAnimationFrame(frame);
    }
    function mola(alvo, p) {
      if (reduce) return;
      s.alvo = alvo; s.k = p.k; s.c = p.c;
      if (!s.running) { s.running = true; s.last = 0; requestAnimationFrame(frame); }
    }

    let inView = false;
    let hovering = false;
    let timer = 0;
    let fase = 0;
    let luzT = 0;
    const schedule = (ms) => { clearTimeout(timer); if (inView) timer = setTimeout(hint, ms ?? 5200 + Math.random() * 2600); };
    function acendeLuzes() {
      if (wheel.classList.contains('is-lit')) return; // não reinicia no meio
      wheel.classList.add('is-lit');
      clearTimeout(luzT);
      luzT = setTimeout(() => wheel.classList.remove('is-lit'), 2900);
    }
    function hint() {
      if (!inView || reduce) return;
      if (hovering) { schedule(); return; }
      mola(-8, ARMA);
      acendeLuzes();
      clearTimeout(fase);
      fase = setTimeout(() => { if (!hovering) mola(0, SOLTA); }, 950);
      schedule();
    }
    new IntersectionObserver(([en]) => {
      const was = inView;
      inView = en.isIntersecting;
      if (inView && !was) schedule(900);
      if (!inView) clearTimeout(timer);
    }, { threshold: 0.45 }).observe(wheel);
    // desktop: no hover as fatias "armam" e seguram; ao sair, soltam com mola
    wheel.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      hovering = true;
      clearTimeout(fase);
      mola(-7, ARMA);
    });
    wheel.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      hovering = false;
      mola(0, SOLTA);
      schedule();
    });
    // toque: um toque faz a roleta ensaiar o giro
    wheel.addEventListener('click', () => { if (!mqFinePointer.matches) hint(); });
  }

  /* =======================================================================
     ACORDEÃO (Dúvidas frequentes)
     ======================================================================= */
  $$('[data-accordion]').forEach((acc) => {
    const setOpen = (item, open) => {
      item.classList.toggle('is-open', open);
      $('.faq__botao', item).setAttribute('aria-expanded', String(open));
      const panel = $('.faq__painel', item);
      if (open) panel.removeAttribute('inert'); else panel.setAttribute('inert', '');
    };
    acc.addEventListener('click', (e) => {
      const btn = e.target.closest('.faq__botao');
      if (!btn) return;
      const item = btn.closest('.faq__item');
      const willOpen = !item.classList.contains('is-open');
      $$('.faq__item.is-open', acc).forEach((it) => { if (it !== item) setOpen(it, false); });
      setOpen(item, willOpen);
    });
  });

  /* =======================================================================
     GANHADORES: abas, busca, paginação e "carregar mais"
     ======================================================================= */
  const tabs = $('[data-tabs]');
  const pill = tabs ? $('.abas__pill', tabs) : null;
  const tabBtns = tabs ? $$('[role="tab"]', tabs) : [];

  function movePill(instant) {
    if (!pill) return;
    const active = tabBtns.find((b) => b.classList.contains('is-active'));
    if (!active) return;
    if (instant) pill.style.transition = 'none';
    pill.style.setProperty('--pill-x', `${active.offsetLeft}px`);
    pill.style.setProperty('--pill-w', `${active.offsetWidth}px`);
    if (instant) { void pill.offsetWidth; pill.style.transition = ''; }
  }

  function selectTab(btn, focus) {
    tabBtns.forEach((b) => {
      const on = b === btn;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(b.getAttribute('aria-controls'));
      if (!panel) return;
      if (on) {
        panel.hidden = false;
        panel.classList.remove('is-entering');
        void panel.offsetWidth;
        panel.classList.add('is-entering');
      } else {
        panel.hidden = true;
      }
    });
    if (focus) btn.focus();
    movePill(false);
    applySearch();
  }
  tabBtns.forEach((b) => b.addEventListener('click', () => selectTab(b)));
  tabs?.addEventListener('keydown', (e) => {
    const i = tabBtns.findIndex((b) => b.classList.contains('is-active'));
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabBtns.length) % tabBtns.length;
      selectTab(tabBtns[n], true);
    }
  });
  movePill(true);
  document.fonts?.ready.then(() => movePill(true));

  // Busca (filtra a lista visível)
  const busca = $('[data-busca]');
  const campo = busca ? $('.busca__campo', busca) : null;
  const normaliza = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  function applySearch() {
    if (!campo) return;
    const q = normaliza(campo.value);
    $$('[data-lista]').forEach((lista) => {
      if (lista.hidden) return;
      let hits = 0;
      $$('.tabela__linha', lista).forEach((row) => {
        const show = !q || (!row.hasAttribute('data-fixa') && normaliza(row.textContent).includes(q));
        row.classList.toggle('is-filtrada', !show);
        if (show) hits++;
      });
      lista.classList.toggle('is-buscando', !!q);
      const vazia = $('.tabela__vazia', lista);
      if (vazia) vazia.hidden = hits > 0;
    });
  }
  let buscaTimer;
  campo?.addEventListener('input', () => { clearTimeout(buscaTimer); buscaTimer = setTimeout(applySearch, 160); });
  busca?.addEventListener('submit', (e) => { e.preventDefault(); applySearch(); });

  // Placeholder curto no mobile
  if (campo) {
    const longo = campo.placeholder;
    const curto = campo.dataset.placeholderCurto || longo;
    const mqMobile = matchMedia('(max-width: 767.98px)');
    const setPh = () => { campo.placeholder = mqMobile.matches ? curto : longo; };
    setPh();
    mqMobile.addEventListener?.('change', setPh);
  }

  // Paginação (estado visual; os dados virão do sistema)
  $$('.paginacao').forEach((nav) => {
    const nums = $$('.paginacao__btn:not(.paginacao__btn--seta)', nav);
    const setPage = (btn) => nums.forEach((b) => {
      const on = b === btn;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('.paginacao__btn');
      if (!btn) return;
      const i = nums.findIndex((b) => b.classList.contains('is-active'));
      if (btn.classList.contains('paginacao__btn--seta')) {
        const dir = btn === $$('.paginacao__btn--seta', nav)[0] ? -1 : 1;
        setPage(nums[clamp(i + dir, 0, nums.length - 1)]);
      } else setPage(btn);
    });
  });

  // Carregar mais (mobile)
  $$('[data-carregar]').forEach((btn) => btn.addEventListener('click', () => {
    btn.closest('[data-lista]')?.classList.add('is-expanded');
  }));

  /* ---------- pausa animações contínuas fora da tela ---------- */
  const pauseIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => en.target.classList.toggle('is-paused', !en.isIntersecting));
  }, { rootMargin: '120px 0px' });
  [kv, ...$$('.sec'), $('.footer')].forEach((el) => el && pauseIO.observe(el));

  /* ---------- inicialização ---------- */
  measureBokeh();
  onScrollFrame();
})();
