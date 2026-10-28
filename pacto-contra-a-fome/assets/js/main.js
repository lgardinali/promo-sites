/* =============================================================
   Sorteio Solidário — Pacto Contra a Fome
   Interações e movimento em JS nativo, zero dependências.
   ============================================================= */
(() => {
  'use strict';

  /* =============================================================
     LINKS — edite aqui. Vale para todos os elementos marcados com
     data-link="..." no index.html.
     url vazia ('') = link ainda não definido (o clique não faz nada).
     novaAba: true abre em uma nova aba.
     ============================================================= */
  const LINKS = {
    cta: { url: '', novaAba: false },        // "Doe e concorra" (KV e menu mobile), "Concorrer agora", "Quero concorrer"
    login: { url: '', novaAba: false },      // Menu: botão "Login/Cadastro"
    privacidade: { url: '', novaAba: true }, // Rodapé: Política de privacidade
    termos: { url: '', novaAba: true },      // Rodapé: Termos de uso
    regulamento: { url: '', novaAba: true }, // Rodapé: Regulamento
    facebook: { url: '', novaAba: true },    // Rodapé: ícone do Facebook
  };

  const CONFIG = {
    /* Scroll suave da roda do mouse:
       'auto'   → mede se o navegador já suaviza a roda; se já suaviza, mantém o nativo
                  (evita suavização dupla); se não, liga o scroll inercial próprio.
       'always' → sempre usa o próprio (bloqueia o nativo — também sem conflito).
       'never'  → nunca. */
    smoothScroll: 'auto',
    lerp: 0.1,
  };

  window.__pacto = true;

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // Aplica os links configurados em LINKS
  $$('[data-link]').forEach((a) => {
    const link = LINKS[a.dataset.link];
    if (!link || !link.url) return;
    a.href = link.url;
    if (link.novaAba) { a.target = '_blank'; a.rel = 'noopener'; }
  });

  const mqReduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mqFine = matchMedia('(hover: hover) and (pointer: fine)');
  const mqDesktop = matchMedia('(min-width: 1180px)');
  const mqTablet = matchMedia('(min-width: 720px)');
  let reduced = mqReduced.matches;
  // Amplitude por breakpoint: ×1 desktop, ×0,82 tablet, ×0,5 mobile
  const amp = () => (mqDesktop.matches ? 1 : mqTablet.matches ? 0.82 : 0.5);

  const header = $('[data-header]');
  const headerH = () => (header ? header.offsetHeight : 0);
  let hdrH = headerH();

  /* ---------- Loop único (um só requestAnimationFrame para a cena toda) ---------- */
  const loop = (() => {
    const tasks = [];
    let raf = 0;
    let last = 0;
    const frame = (now) => {
      raf = 0;
      const dt = last ? Math.min(64, now - last) : 16.667;
      last = now;
      let again = false;
      for (let i = 0; i < tasks.length; i++) if (tasks[i](dt, now)) again = true;
      if (again) raf = requestAnimationFrame(frame);
      else last = 0;
    };
    return {
      add(fn) { tasks.push(fn); },
      wake() { if (!raf) raf = requestAnimationFrame(frame); },
    };
  })();

  const maxScroll = () => root.scrollHeight - window.innerHeight;
  const instantScroll = (y) => window.scrollTo({ top: y, left: 0, behavior: 'instant' });

  /* =============================================================
     SCROLL SUAVE
     ============================================================= */
  const smooth = (() => {
    let mode = reduced ? 'off'
      : CONFIG.smoothScroll === 'always' ? 'on'
      : CONFIG.smoothScroll === 'never' ? 'off'
      : 'probe';
    let target = window.scrollY;
    let current = target;
    let running = false;
    let anim = null;
    let locked = false;
    let probing = false;
    let probeWheels = 0;

    root.dataset.smooth = mode;

    // Roda de mouse "de verdade" (dentes) x trackpad / Magic Mouse (já inerciais)
    const isMouseWheel = (e) => {
      if (e.deltaMode !== 0) return true;
      const wd = e.wheelDeltaY;
      if (typeof wd === 'number' && wd !== 0) return Math.abs(wd) % 120 === 0;
      return Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 50;
    };

    const normalize = (e) => {
      let d = e.deltaY;
      if (e.deltaMode === 1) d *= 33.34;
      else if (e.deltaMode === 2) d *= window.innerHeight * 0.9;
      return clamp(d, -360, 360);
    };

    // Deixa o primeiro "dente" da roda passar e observa como o navegador rola:
    // se a posição muda ao longo de vários quadros, o navegador já suaviza.
    const probe = (e) => {
      if (probing) { probeWheels++; return; }
      const dir = Math.sign(e.deltaY);
      const y0 = window.scrollY;
      const max = maxScroll();
      if ((dir > 0 && y0 >= max - 2) || (dir < 0 && y0 <= 2)) return;
      probing = true;
      probeWheels = 1;
      const samples = [];
      let n = 0;
      const step = () => {
        samples.push(window.scrollY);
        if (++n < 14) { requestAnimationFrame(step); return; }
        probing = false;
        let moves = 0;
        let prev = y0;
        for (const y of samples) { if (Math.abs(y - prev) > 0.5) moves++; prev = y; }
        if (Math.abs(samples[samples.length - 1] - y0) < 2) return; // inconclusivo, tenta de novo
        mode = moves >= probeWheels + 2 ? 'native' : 'on';
        root.dataset.smooth = mode;
      };
      requestAnimationFrame(step);
    };

    const stop = () => { running = false; anim = null; target = current = window.scrollY; };

    const onWheel = (e) => {
      if (anim) anim = null; // o usuário assume o controle
      if (mode === 'off' || mode === 'native' || locked || e.ctrlKey) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (!isMouseWheel(e)) { if (running) stop(); return; }
      if (mode === 'probe') { probe(e); return; }
      e.preventDefault();
      if (!running) target = current = window.scrollY;
      target = clamp(target + normalize(e), 0, maxScroll());
      running = true;
      loop.wake();
    };

    const easeInOut = (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);

    const to = (y, opts = {}) => {
      const from = window.scrollY;
      const dest = clamp(Math.round(y), 0, maxScroll());
      const dist = Math.abs(dest - from);
      running = false;
      if (reduced || dist < 2) { instantScroll(dest); target = current = dest; return; }
      anim = { from, to: dest, t0: performance.now(), dur: opts.duration || clamp(450 + dist * 0.32, 700, 1500) };
      loop.wake();
    };

    loop.add((dt, now) => {
      if (anim) {
        const p = clamp((now - anim.t0) / anim.dur, 0, 1);
        const y = anim.from + (anim.to - anim.from) * easeInOut(p);
        instantScroll(y);
        if (p >= 1) { target = current = anim.to; anim = null; return false; }
        return true;
      }
      if (!running) return false;
      const k = 1 - Math.pow(1 - CONFIG.lerp, dt / 16.667);
      current += (target - current) * k;
      if (Math.abs(target - current) < 0.4) { current = target; running = false; }
      instantScroll(current);
      return running;
    });

    window.addEventListener('wheel', onWheel, { passive: false });
    // Teclado, barra de rolagem e toque: devolve o controle ao nativo
    const release = () => { if (running || anim) stop(); };
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'].includes(e.key)) release();
    });
    window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.clientX >= root.clientWidth) release(); });
    window.addEventListener('touchstart', release, { passive: true });
    window.addEventListener('scroll', () => { if (!running && !anim) target = current = window.scrollY; }, { passive: true });

    return {
      to,
      lock(v) { locked = v; if (v) stop(); },
      setReduced(v) { if (v) { mode = 'off'; stop(); } },
    };
  })();

  /* Links internos (#ancora) com rolagem suave e compensação do menu fixo */
  const scrollToHash = (hash) => {
    if (hash === '#home' || hash === '#top') { smooth.to(0); return true; }
    const el = hash.length > 1 && document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!el) return false;
    const y = el.getBoundingClientRect().top + window.scrollY - hdrH;
    smooth.to(y);
    return true;
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const hash = a.getAttribute('href');
    if (hash === '#') { e.preventDefault(); return; } // link ainda não definido (CTA)
    const go = () => {
      if (scrollToHash(hash)) history.replaceState(null, '', hash === '#home' ? location.pathname + location.search : hash);
    };
    e.preventDefault();
    if (root.classList.contains('menu-open')) { menu.close(false); requestAnimationFrame(go); } else go();
  });

  /* =============================================================
     MENU: estado ao rolar, esconde/mostra, progresso, seção atual
     ============================================================= */
  const progressBar = $('[data-progress]');
  let lastY = window.scrollY;
  let dirAcc = 0;
  let headerHidden = false;
  let prevProgress = -1;

  loop.add(() => {
    const y = window.scrollY;
    if (!header) return false;
    header.classList.toggle('is-scrolled', y > 8);
    const dy = y - lastY;
    lastY = y;
    if (Math.sign(dy) !== Math.sign(dirAcc)) dirAcc = 0;
    dirAcc += dy;
    const menuOpen = root.classList.contains('menu-open');
    if (!reduced && !menuOpen && y > hdrH * 4 && dirAcc > 24 && !headerHidden) { headerHidden = true; header.classList.add('is-hidden'); }
    else if ((dirAcc < -16 || y <= hdrH * 4 || menuOpen) && headerHidden) { headerHidden = false; header.classList.remove('is-hidden'); }
    const max = maxScroll();
    const p = max > 0 ? clamp(y / max, 0, 1) : 0;
    if (progressBar && Math.abs(p - prevProgress) > 0.0002) {
      prevProgress = p;
      progressBar.style.transform = `scale3d(${p.toFixed(4)}, 1, 1)`;
    }
    return false;
  });
  window.addEventListener('scroll', () => loop.wake(), { passive: true });

  // Seção atual destacada no menu
  const spyLinks = $$('.nav__link[data-spy], .mmenu__link');
  const setCurrent = (id) => {
    spyLinks.forEach((a) => {
      const on = a.getAttribute('href') === `#${id}`;
      a.classList.toggle('is-current', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  };
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) setCurrent(en.target.id); });
    }, { rootMargin: '-45% 0px -54% 0px' });
    $$('[data-section]').forEach((s) => spy.observe(s));
  }

  /* ---------- Menu mobile / tablet ---------- */
  const menu = (() => {
    const burger = $('[data-burger]');
    const panel = $('[data-mmenu]');
    if (!burger || !panel) return { close() {} };
    const open = () => {
      root.classList.add('menu-open');
      panel.inert = false;
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Fechar menu');
      smooth.lock(true);
      loop.wake();
      setTimeout(() => { const f = $('.mmenu__link', panel); if (f) f.focus({ preventScroll: true }); }, 350);
    };
    const close = (restoreFocus = true) => {
      if (!root.classList.contains('menu-open')) return;
      root.classList.remove('menu-open');
      panel.inert = true;
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Abrir menu');
      smooth.lock(false);
      if (restoreFocus) burger.focus({ preventScroll: true });
    };
    burger.addEventListener('click', () => (root.classList.contains('menu-open') ? close() : open()));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    mqDesktop.addEventListener('change', () => close(false));
    return { open, close };
  })();

  /* =============================================================
     REVELAÇÃO GRADUAL + CAMADAS DE GPU POR VISIBILIDADE
     ============================================================= */
  const hasIO = 'IntersectionObserver' in window;
  const revealAll = (els) => els.forEach((el) => el.classList.add('is-in'));

  if (hasIO && !reduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
    $$('[data-reveal]').forEach((el) => io.observe(el));
  } else {
    revealAll($$('[data-reveal]'));
  }

  // Abertura do KV: espera fontes e a imagem do carro para animar tudo junto
  const intro = () => revealAll($$('[data-intro]'));
  if (reduced) intro();
  else {
    const heroImg = $('.hero__car-img img');
    const waitImg = heroImg && heroImg.decode ? heroImg.decode().catch(() => {}) : Promise.resolve();
    const waitFonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    const timeout = new Promise((r) => setTimeout(r, 1200));
    Promise.race([Promise.all([waitImg, waitFonts]), timeout]).then(() => {
      requestAnimationFrame(() => requestAnimationFrame(intro));
    });
  }

  // .is-live: liga will-change/backface quando a sessão entra na viewport e
  // desliga quando sai (nunca em função de estar parado ou em movimento)
  const liveSections = new Set();
  if (hasIO) {
    const live = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        en.target.classList.toggle('is-live', en.isIntersecting);
        if (en.isIntersecting) liveSections.add(en.target); else liveSections.delete(en.target);
      });
      scene.wake();
    }, { rootMargin: '20% 0px 20% 0px' });
    $$('[data-live]').forEach((s) => live.observe(s));
  } else {
    $$('[data-live]').forEach((s) => { s.classList.add('is-live'); liveSections.add(s); });
  }

  /* ---------- "Hover" por rolagem no toque: o item no centro da tela fica ativo ---------- */
  if (hasIO && !mqFine.matches) {
    const center = new IntersectionObserver((entries) => {
      entries.forEach((en) => en.target.classList.toggle('is-active', en.isIntersecting));
    }, { rootMargin: '-46% 0px -46% 0px' }); // faixa estreita no meio da tela
    $$('[data-center]').forEach((el) => center.observe(el));
  }

  /* =============================================================
     CENA: parallax de ponteiro (2 estágios) + parallax de rolagem
     ============================================================= */
  const scene = (() => {
    // mx/my: deslocamento máx. pelo ponteiro (px) | sy: deslocamento pela rolagem (px)
    // rot: rotação pela rolagem (graus) | top: rolagem medida a partir do topo da sessão
    const CFG = {
      'hero-car': { mx: 14, my: 8, sy: -40, top: true },
      'hero-raios': { mx: 12, my: 9, sy: -24, top: true },
      'premio-car': { mx: 16, my: 7, sy: -26 },
      'premio-raios-esq': { mx: 12, my: 10 },
      'premio-raios-dir': { mx: 12, my: 10 },
      'premio-bg': { mx: -10, my: -8, sy: 90, rot: 16 },
      'g-circulo': { sy: -80, mx: -6, my: -6 },
      'g-anel': { sy: -46, mx: -10, my: -8 },
      'g-ondas': { sy: 56, mx: 8, my: 6 },
      'g-pontos': { sy: 96, mx: 10, my: 8 },
      'simbolo': { sy: -24, rot: 70 },
    };

    const items = $$('[data-px]').map((el) => ({
      el,
      cfg: CFG[el.dataset.px] || {},
      section: el.closest('[data-section]'),
      top: 0,
      h: 1,
      last: '',
    })).filter((it) => it.section);

    const magnets = $$('[data-magnetic]').map((el) => ({
      el, rect: null, sy0: 0, tx: 0, ty: 0, sx: 0, sy: 0, cx: 0, cy: 0, last: '',
    }));

    // Ponteiro normalizado (-1..1) e os dois estágios de suavização
    let tx = 0, ty = 0, sx = 0, sy = 0, cx = 0, cy = 0;
    let lastScroll = -1;
    let vh = window.innerHeight;
    let a = amp();

    const measure = () => {
      vh = window.innerHeight;
      a = amp();
      hdrH = headerH();
      const y = window.scrollY;
      items.forEach((it) => {
        const r = it.section.getBoundingClientRect();
        it.top = r.top + y;
        it.h = Math.max(1, r.height);
      });
      lastScroll = -1;
      wake();
    };

    const smoothStep = (dt) => {
      const f = dt / 16.667;
      const k1 = 1 - Math.pow(1 - 0.14, f);
      const k2 = 1 - Math.pow(1 - 0.075, f);
      sx += (tx - sx) * k1; sy += (ty - sy) * k1;
      cx += (sx - cx) * k2; cy += (sy - cy) * k2;
      let moving = Math.abs(tx - cx) > 0.0005 || Math.abs(ty - cy) > 0.0005;
      magnets.forEach((m) => {
        m.sx += (m.tx - m.sx) * k1; m.sy += (m.ty - m.sy) * k1;
        m.cx += (m.sx - m.cx) * k2; m.cy += (m.sy - m.cy) * k2;
        if (Math.abs(m.tx - m.cx) > 0.0005 || Math.abs(m.ty - m.cy) > 0.0005) moving = true;
        const t = `translate3d(${m.cx.toFixed(3)}px, ${m.cy.toFixed(3)}px, 0)`;
        if (t !== m.last) { m.el.style.transform = t; m.last = t; }
      });
      return moving;
    };

    const update = (dt) => {
      if (reduced) return false;
      const moving = smoothStep(dt);
      const y = window.scrollY;
      const scrolled = y !== lastScroll;
      lastScroll = y;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!liveSections.has(it.section)) continue;
        const c = it.cfg;
        let p;
        if (c.top) p = clamp((y - it.top) / it.h, 0, 1);
        else p = clamp((y + vh - it.top) / (vh + it.h), 0, 1) - 0.5;
        const x = (c.mx || 0) * cx * a;
        const ty2 = (c.my || 0) * cy * a + (c.sy || 0) * p * a;
        const r = (c.rot || 0) * p + 0.02;
        const t = `translate3d(${x.toFixed(3)}px, ${ty2.toFixed(3)}px, 0) rotate(${r.toFixed(3)}deg)`;
        if (t !== it.last) { it.el.style.transform = t; it.last = t; }
      }
      return moving || scrolled;
    };
    loop.add(update);

    function wake() { if (!reduced) loop.wake(); }

    if (mqFine.matches) {
      window.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        tx = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
        ty = clamp((e.clientY / vh) * 2 - 1, -1, 1);
        magnets.forEach((m) => {
          if (!m.rect) return;
          const dy = window.scrollY - m.sy0;
          const mx = m.rect.left + m.rect.width / 2;
          const my = m.rect.top - dy + m.rect.height / 2;
          m.tx = clamp((e.clientX - mx) * 0.22, -10, 10) * a;
          m.ty = clamp((e.clientY - my) * 0.3, -7, 7) * a;
        });
        wake();
      }, { passive: true });
      document.addEventListener('pointerleave', () => { tx = 0; ty = 0; wake(); });
      magnets.forEach((m) => {
        m.el.addEventListener('pointerenter', () => { m.rect = m.el.getBoundingClientRect(); m.sy0 = window.scrollY; });
        m.el.addEventListener('pointerleave', () => { m.rect = null; m.tx = 0; m.ty = 0; wake(); });
      });
    }

    window.addEventListener('scroll', wake, { passive: true });
    let rT = 0;
    window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(measure, 120); });
    window.addEventListener('load', measure);
    if ('ResizeObserver' in window) new ResizeObserver(() => { clearTimeout(rT); rT = setTimeout(measure, 120); }).observe(document.body);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    measure();

    const resetAll = () => {
      items.forEach((it) => { it.el.style.transform = ''; it.last = ''; });
      magnets.forEach((m) => { m.el.style.transform = ''; m.last = ''; });
    };
    return { wake, measure, resetAll };
  })();

  /* =============================================================
     DÚVIDAS FREQUENTES — acordeão (um aberto por vez)
     ============================================================= */
  const faqList = $('[data-faq]');
  if (faqList) {
    const items = $$('.faq__item', faqList);
    const set = (item, open) => {
      const btn = $('.faq__q', item);
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    };
    items.forEach((item) => {
      $('.faq__q', item).addEventListener('click', () => {
        const willOpen = !item.classList.contains('is-open');
        items.forEach((other) => { if (other !== item && other.classList.contains('is-open')) set(other, false); });
        set(item, willOpen);
      });
    });
  }

  /* ---------- Preferência de movimento alterada em tempo real ---------- */
  mqReduced.addEventListener('change', (e) => {
    reduced = e.matches;
    smooth.setReduced(reduced);
    if (reduced) { scene.resetAll(); revealAll($$('[data-reveal], [data-intro]')); }
    else scene.wake();
  });
  [mqDesktop, mqTablet].forEach((mq) => mq.addEventListener('change', () => scene.measure()));

  // Abriu a página já com #ancora: corrige a posição considerando o menu fixo
  if (location.hash && location.hash.length > 1) {
    window.addEventListener('load', () => {
      const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (el) instantScroll(el.getBoundingClientRect().top + window.scrollY - hdrH);
    });
  }
})();
