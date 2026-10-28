/* ==========================================================================
   Natal Premiado Cheirin Bão — interações (JS nativo, sem dependências)
   - Um único requestAnimationFrame para a cena inteira
   - Ponteiro suavizado em dois estágios, normalizado pelo tempo
   - Camada de GPU ligada pela visibilidade (IntersectionObserver)
   - Leitura de layout apenas em resize / pointerenter, nunca dentro do frame
   ========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');

  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqFine = matchMedia('(hover: hover) and (pointer: fine)');
  const mqDesktop = matchMedia('(min-width: 1280px)');
  const mqTablet = matchMedia('(min-width: 768px)');
  let reduced = mqReduce.matches;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------- amplitude por breakpoint ---------- */
  const amp = () => (mqDesktop.matches ? 1 : mqTablet.matches ? 0.82 : 0.5);

  /* ==========================================================================
     Estado da cena
     ========================================================================== */
  const S = {
    vw: innerWidth,
    vh: innerHeight,
    scrollY: scrollY,
    docH: 0,
    // ponteiro normalizado (-1..1): alvo, 1º estágio, 2º estágio
    tx: 0, ty: 0, sx: 0, sy: 0, cx: 0, cy: 0,
    running: false,
    last: 0,
  };

  const depthItems = [];    // [data-depth]  → paralaxe do ponteiro
  const plxItems = [];      // [data-parallax] → paralaxe do scroll
  const magnets = [];       // [data-magnetic]
  const live = new Set();   // elementos visíveis (recebem escrita no frame)
  const progressBar = $('.scroll-progress');

  /* ---------- medições (somente em resize/load) ---------- */
  function measure() {
    S.vw = innerWidth;
    S.vh = innerHeight;
    S.scrollY = scrollY;
    S.docH = Math.max(root.scrollHeight, document.body.scrollHeight);
    for (const it of plxItems) {
      const host = it.el.parentElement;
      const r = host.getBoundingClientRect();
      it.top = r.top + S.scrollY;
      it.h = r.height;
    }
    smooth.max = Math.max(0, S.docH - S.vh);
    kick();
  }

  /* ==========================================================================
     Rolagem suave (opcional)
     Só atua em roda de mouse "dentada" num ponteiro fino. Trackpads, telas
     touch e navegadores que já entregam rolagem precisa/suave ficam no nativo.
     Quando ativa, o CSS scroll-behavior:smooth é desligado (.has-smooth-scroll)
     para não haver duas suavizações em série.
     ========================================================================== */
  const smooth = {
    enabled: false,
    active: false,
    target: scrollY,
    current: scrollY,
    max: 0,
    lastSet: -1,
    preciseUntil: 0,
  };

  function canSmooth() {
    return !reduced && mqFine.matches;
  }

  function isNotchedWheel(e) {
    if (e.deltaMode === 1) return true;                         // linhas (Firefox)
    if (e.deltaMode !== 0) return false;
    const ad = Math.abs(e.deltaY);
    const wd = e.wheelDeltaY;
    // trackpad / mouse de alta resolução: deltas pequenos ou fracionados
    if (ad < 40 || (wd !== undefined && wd !== 0 && Math.abs(wd) % 120 !== 0)) {
      smooth.preciseUntil = performance.now() + 1200;
      return false;
    }
    return performance.now() > smooth.preciseUntil;
  }

  function inNativeScroller(t) {
    for (let n = t; n && n !== document.body; n = n.parentElement) {
      if (n.hasAttribute && n.hasAttribute('data-native-scroll') && n.scrollHeight > n.clientHeight + 1) return true;
    }
    return false;
  }

  function onWheel(e) {
    if (!smooth.enabled || e.ctrlKey || e.defaultPrevented) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (document.body.classList.contains('menu-open')) return;
    if (inNativeScroller(e.target)) return;
    if (!isNotchedWheel(e)) { stopSmooth(); return; }
    e.preventDefault();
    const lineH = e.deltaMode === 1 ? 40 : 1;
    if (!smooth.active) { smooth.current = scrollY; smooth.target = scrollY; }
    smooth.target = clamp(smooth.target + e.deltaY * lineH, 0, smooth.max);
    smooth.active = true;
    kick();
  }

  function stopSmooth() {
    smooth.active = false;
    smooth.target = smooth.current = scrollY;
  }

  function scrollToY(y) {
    y = clamp(y, 0, smooth.max || Math.max(0, S.docH - S.vh));
    if (smooth.enabled) {
      if (!smooth.active) smooth.current = scrollY;
      smooth.target = y;
      smooth.active = true;
      kick();
    } else {
      window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
    }
  }

  function setupSmooth() {
    smooth.enabled = canSmooth();
    root.classList.toggle('has-smooth-scroll', smooth.enabled);
    if (!smooth.enabled) stopSmooth();
  }

  /* ==========================================================================
     Loop único
     ========================================================================== */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function kick() {
    if (S.running) return;
    S.running = true;
    S.last = performance.now();
    requestAnimationFrame(frame);
  }

  function frame(now) {
    const dt = Math.min(64, now - S.last || 16.667);
    S.last = now;
    const f = dt / 16.667;
    const k1 = 1 - Math.pow(1 - 0.14, f);   // 1º estágio: alvo suavizado
    const k2 = 1 - Math.pow(1 - 0.075, f);  // 2º estágio: posição exibida
    let moving = false;

    /* rolagem suave */
    if (smooth.active) {
      const ks = 1 - Math.pow(1 - 0.11, f);
      smooth.current += (smooth.target - smooth.current) * ks;
      if (Math.abs(smooth.target - smooth.current) < 0.5) {
        smooth.current = smooth.target;
        smooth.active = false;
      } else moving = true;
      smooth.lastSet = smooth.current;
      window.scrollTo({ top: smooth.current, behavior: 'instant' });
      S.scrollY = smooth.current;
    }

    /* ponteiro (dois estágios) */
    S.sx += (S.tx - S.sx) * k1; S.sy += (S.ty - S.sy) * k1;
    S.cx += (S.sx - S.cx) * k2; S.cy += (S.sy - S.cy) * k2;
    if (Math.abs(S.tx - S.cx) > 0.0005 || Math.abs(S.ty - S.cy) > 0.0005) moving = true;

    const a = amp();

    /* paralaxe do ponteiro */
    for (const it of depthItems) {
      if (reduced || !live.has(it.el)) continue;
      const x = S.cx * it.d * a;
      const y = S.cy * it.d * a * 0.7;
      it.el.style.transform = `translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0)${it.rot ? ' rotate(0.02deg)' : ''}`;
    }

    /* paralaxe do scroll */
    for (const it of plxItems) {
      if (reduced || !live.has(it.el)) continue;
      let y;
      if (it.mode === 'top') {
        y = S.scrollY * it.f;
      } else {
        const center = it.top + it.h / 2 - S.scrollY - S.vh / 2;
        y = -center * it.f;
      }
      const lim = it.h * it.max;
      y = clamp(y, -lim, lim);
      it.el.style.transform = `translate3d(0, ${y.toFixed(3)}px, 0) rotate(0.02deg)`;
    }

    /* botões magnéticos */
    for (const m of magnets) {
      m.sx += (m.tx - m.sx) * k1; m.sy += (m.ty - m.sy) * k1;
      m.cx += (m.sx - m.cx) * k2; m.cy += (m.sy - m.cy) * k2;
      if (Math.abs(m.tx - m.cx) > 0.0005 || Math.abs(m.ty - m.cy) > 0.0005) moving = true;
      m.el.style.transform = `translate3d(${m.cx.toFixed(3)}px, ${m.cy.toFixed(3)}px, 0)`;
    }

    /* barra de progresso */
    if (progressBar) {
      const p = smooth.max > 0 ? clamp(S.scrollY / smooth.max, 0, 1) : 0;
      progressBar.style.transform = `scale3d(${p.toFixed(4)}, 1, 1)`;
    }

    if (moving) requestAnimationFrame(frame);
    else S.running = false;
  }

  /* ==========================================================================
     Coleta dos elementos animados
     ========================================================================== */
  function collect() {
    for (const el of $$('[data-depth]')) {
      depthItems.push({ el, d: parseFloat(el.dataset.depth) || 10, rot: el.hasAttribute('data-rot') });
    }
    for (const el of $$('[data-parallax]')) {
      plxItems.push({
        el,
        f: parseFloat(el.dataset.parallax) || 0.15,
        mode: el.dataset.parallaxMode || 'center',
        max: parseFloat(el.dataset.parallaxMax) || 0.06,
        top: 0, h: 0,
      });
    }
    for (const el of $$('[data-magnetic]')) {
      const m = { el, rect: null, tx: 0, ty: 0, sx: 0, sy: 0, cx: 0, cy: 0 };
      el.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse' || reduced) return;
        m.rect = el.getBoundingClientRect();
      });
      el.addEventListener('pointermove', (e) => {
        if (!m.rect || e.pointerType !== 'mouse' || reduced) return;
        const nx = (e.clientX - (m.rect.left + m.rect.width / 2)) / (m.rect.width / 2);
        const ny = (e.clientY - (m.rect.top + m.rect.height / 2)) / (m.rect.height / 2);
        m.tx = clamp(nx, -1, 1) * 7;
        m.ty = clamp(ny, -1, 1) * 5;
        kick();
      });
      el.addEventListener('pointerleave', () => { m.rect = null; m.tx = 0; m.ty = 0; kick(); });
      magnets.push(m);
    }
  }

  /* ---------- visibilidade → camada de GPU + escrita no frame ---------- */
  function setupLive() {
    const els = new Set([
      ...depthItems.map((i) => i.el),
      ...plxItems.map((i) => i.el),
      ...$$('[data-live]'),
    ]);
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => { el.classList.add('is-live'); live.add(el); });
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        en.target.classList.toggle('is-live', en.isIntersecting);
        if (en.isIntersecting) live.add(en.target); else live.delete(en.target);
      }
      kick();
    }, { rootMargin: '15% 0px 15% 0px' });
    els.forEach((el) => io.observe(el));
  }

  /* ==========================================================================
     Revelação no scroll
     ========================================================================== */
  function splitTitles() {
    for (const el of $$('[data-reveal="title"]')) {
      let w = 0;
      const wrapWords = (node) => {
        for (const child of Array.from(node.childNodes)) {
          if (child.nodeType === 3) {
            const parts = child.textContent.split(/(\s+)/);
            const frag = document.createDocumentFragment();
            for (const p of parts) {
              if (!p) continue;
              if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); continue; }
              const mask = document.createElement('span');
              mask.className = 'split';
              const inner = document.createElement('span');
              inner.textContent = p;
              inner.style.setProperty('--w', w++);
              mask.appendChild(inner);
              frag.appendChild(mask);
            }
            child.replaceWith(frag);
          } else if (child.nodeType === 1 && !child.classList.contains('split')) {
            wrapWords(child);
          }
        }
      };
      wrapWords(el);
    }
  }

  function setupReveal() {
    const els = $$('[data-reveal], [data-reveal-steps]');
    if (reduced || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach((el) => io.observe(el));
  }

  /* ==========================================================================
     "Hover" no centro da tela (touch / sem hover)
     ========================================================================== */
  function setupCenterHover() {
    if (!('IntersectionObserver' in window)) return;
    const vertical = $$('[data-center]');
    let io = null;
    const start = () => {
      if (io || mqFine.matches) return;
      io = new IntersectionObserver((entries) => {
        for (const en of entries) en.target.classList.toggle('is-centered', en.isIntersecting);
      }, { rootMargin: '-42% 0px -42% 0px' });
      vertical.forEach((el) => io.observe(el));
    };
    const stop = () => {
      if (!io) return;
      io.disconnect(); io = null;
      vertical.forEach((el) => el.classList.remove('is-centered'));
    };
    const update = () => (mqFine.matches ? stop() : start());
    update();
    mqFine.addEventListener('change', update);
  }

  /* ==========================================================================
     Trilha de passos: arrastar com o mouse + passo central ativo
     ========================================================================== */
  function setupSteps() {
    for (const sc of $$('.steps')) {
      const steps = $$('.step', sc);
      const hint = sc.parentElement.querySelector('.steps__hint');

      // passo ativo = o que está no centro da área visível (tablet/mobile)
      let io = null;
      const startIO = () => {
        if (io || mqDesktop.matches || !('IntersectionObserver' in window)) return;
        io = new IntersectionObserver((entries) => {
          for (const en of entries) en.target.classList.toggle('is-centered', en.isIntersecting);
          sc.classList.toggle('has-center', !mqFine.matches && steps.some((s) => s.classList.contains('is-centered')));
        }, { root: sc, rootMargin: '0px -38% 0px -38%' });
        steps.forEach((s) => io.observe(s));
      };
      const stopIO = () => {
        if (!io) return;
        io.disconnect(); io = null;
        steps.forEach((s) => s.classList.remove('is-centered'));
        sc.classList.remove('has-center');
      };
      const update = () => (mqDesktop.matches || mqFine.matches ? stopIO() : startIO());
      update();
      mqDesktop.addEventListener('change', update);
      mqFine.addEventListener('change', update);

      // a dica "arraste" se apaga depois do primeiro movimento
      sc.addEventListener('scroll', () => {
        if (hint && sc.scrollLeft > 24) hint.classList.add('is-done');
      }, { passive: true });

      // arrastar com o mouse (tablet com mouse / janelas estreitas)
      let down = false, startX = 0, startLeft = 0, moved = false;
      sc.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse' || mqDesktop.matches) return;
        down = true; moved = false;
        startX = e.clientX; startLeft = sc.scrollLeft;
      });
      window.addEventListener('pointermove', (e) => {
        if (!down) return;
        const dx = e.clientX - startX;
        if (!moved && Math.abs(dx) > 4) { moved = true; sc.classList.add('is-dragging'); }
        if (moved) sc.scrollLeft = startLeft - dx;
      });
      window.addEventListener('pointerup', () => {
        if (!down) return;
        down = false;
        sc.classList.remove('is-dragging');
      });
      sc.addEventListener('click', (e) => { if (moved) { e.preventDefault(); moved = false; } }, true);
    }
  }

  /* ==========================================================================
     Menu mobile
     ========================================================================== */
  function setupMenu() {
    const menu = $('#mobile-menu');
    const toggle = $('.menu-toggle');
    if (!menu || !toggle) return;
    const closeBtn = $('.mobile-menu__close', menu);
    let lastFocus = null;

    const open = () => {
      lastFocus = document.activeElement;
      menu.classList.add('is-open');
      menu.removeAttribute('inert');
      menu.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-open');
      stopSmooth();
      setTimeout(() => closeBtn && closeBtn.focus({ preventScroll: true }), 60);
    };
    const close = () => {
      if (!menu.classList.contains('is-open')) return;
      menu.classList.remove('is-open');
      menu.setAttribute('inert', '');
      menu.setAttribute('aria-hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    };

    toggle.addEventListener('click', open);
    closeBtn && closeBtn.addEventListener('click', close);
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab' && menu.classList.contains('is-open')) {
        const f = $$('a, button', menu).filter((n) => n.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    mqDesktop.addEventListener('change', (e) => { if (e.matches) close(); });
  }

  /* ==========================================================================
     Âncoras na mesma página
     ========================================================================== */
  function setupAnchors() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href*="#"]');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const url = new URL(a.href, location.href);
      if (url.pathname !== location.pathname || !url.hash) return;
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      const header = $('.site-header');
      const off = (header ? header.offsetHeight : 0) + 24;
      scrollToY(target.getBoundingClientRect().top + scrollY - off);
      history.pushState(null, '', url.hash);
    });
  }

  /* ==========================================================================
     Transição entre páginas
     Com View Transitions entre documentos (Chrome/Edge/Safari recentes) o CSS
     e o head.js cuidam de tudo. Sem suporte, faz um fade curto do conteúdo
     (header e banner compartilhado ficam) antes de navegar.
     ========================================================================== */
  const POINTER_KEY = 'cb-pointer';

  function setupPageTransitions() {
    const nativeVT = 'CSSViewTransitionRule' in window;
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      const share = window.CBTransition ? window.CBTransition.shareBannerWith(url.href) : false;
      if (nativeVT || reduced) return;
      e.preventDefault();
      root.classList.add('is-leaving');
      root.classList.toggle('keep-banner', share);
      setTimeout(() => { location.href = url.href; }, 260);
    });
    // o ponteiro continua onde estava: a paralaxe não "pula" na página nova
    addEventListener('pagehide', () => {
      try { sessionStorage.setItem(POINTER_KEY, JSON.stringify([S.cx, S.cy])); } catch (err) { /* sem storage */ }
    });
  }

  function restorePointer() {
    if (reduced || !mqFine.matches) return;
    let p = null;
    try { p = JSON.parse(sessionStorage.getItem(POINTER_KEY)); } catch (err) { /* sem storage */ }
    if (!Array.isArray(p)) return;
    S.tx = S.sx = S.cx = clamp(+p[0] || 0, -1, 1);
    S.ty = S.sy = S.cy = clamp(+p[1] || 0, -1, 1);
    const a = amp();
    for (const it of depthItems) {
      it.el.style.transform = `translate3d(${(S.cx * it.d * a).toFixed(3)}px, ${(S.cy * it.d * a * 0.7).toFixed(3)}px, 0)${it.rot ? ' rotate(0.02deg)' : ''}`;
    }
  }

  /* ==========================================================================
     Dúvidas frequentes (acordeão)
     ========================================================================== */
  function setupFaq() {
    for (const item of $$('.faq-item')) {
      const btn = $('.faq-item__btn', item);
      const panel = $('.faq-item__panel', item);
      const set = (open) => {
        item.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
        panel.setAttribute('aria-hidden', String(!open));
        if (open) panel.removeAttribute('inert'); else panel.setAttribute('inert', '');
      };
      set(item.classList.contains('is-open'));
      btn.addEventListener('click', () => set(!item.classList.contains('is-open')));
    }
  }

  /* ==========================================================================
     Cadastro: máscaras + validação (envio será integrado depois)
     ========================================================================== */
  const masks = {
    cpf: (v) => v.replace(/\D/g, '').slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'),
    date: (v) => v.replace(/\D/g, '').slice(0, 8)
      .replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})(\d)/, '$1/$2'),
    phone: (v) => {
      const d = v.replace(/\D/g, '').slice(0, 11);
      if (d.length <= 2) return d.length ? `(${d}` : '';
      if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    },
  };

  function validCPF(v) {
    const d = v.replace(/\D/g, '');
    if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    let s = 0;
    for (let i = 0; i < 9; i++) s += +d[i] * (10 - i);
    let r = (s * 10) % 11; if (r === 10) r = 0;
    if (r !== +d[9]) return false;
    s = 0;
    for (let i = 0; i < 10; i++) s += +d[i] * (11 - i);
    r = (s * 10) % 11; if (r === 10) r = 0;
    return r === +d[10];
  }

  function validAdultDate(v) {
    const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return false;
    const [, dd, mm, yy] = m.map(Number);
    const dt = new Date(yy, mm - 1, dd);
    if (dt.getFullYear() !== yy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return false;
    const now = new Date();
    const adult = new Date(yy + 18, mm - 1, dd);
    return adult <= now && yy > 1900;
  }

  function setupForm() {
    const form = $('#form-cadastro');
    if (!form) return;
    for (const input of $$('[data-mask]', form)) {
      const fn = masks[input.dataset.mask];
      input.addEventListener('input', () => {
        const atEnd = input.selectionStart === input.value.length;
        input.value = fn(input.value);
        if (atEnd) input.setSelectionRange(input.value.length, input.value.length);
      });
    }
    const checks = {
      nome: (v) => v.trim().split(/\s+/).length >= 2 || 'Informe seu nome completo.',
      cpf: (v) => validCPF(v) || 'Informe um CPF válido.',
      nascimento: (v) => validAdultDate(v) || 'A promoção é para maiores de 18 anos (dd/mm/aaaa).',
      email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Informe um e-mail válido.',
      celular: (v) => v.replace(/\D/g, '').length >= 10 || 'Informe um celular com DDD.',
      cidade: (v) => v.trim().length >= 3 || 'Informe sua cidade e UF.',
      senha: (v) => v.length >= 8 || 'A senha precisa ter pelo menos 8 caracteres.',
    };
    const showError = (input, msg) => {
      const field = input.closest('.field');
      const err = field && $('.field__error', field);
      field && field.classList.toggle('is-invalid', !!msg);
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (err) err.textContent = msg || '';
    };
    const validate = (input) => {
      const fn = checks[input.name];
      if (!fn) return true;
      const r = fn(input.value);
      showError(input, r === true ? '' : r);
      return r === true;
    };
    for (const input of $$('input[name]', form)) {
      input.addEventListener('blur', () => { if (input.value) validate(input); });
      input.addEventListener('input', () => { if (input.getAttribute('aria-invalid') === 'true') validate(input); });
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const inputs = $$('input[name]', form).filter((i) => checks[i.name]);
      const okFields = inputs.map(validate).every(Boolean);
      const terms = $('#aceite', form);
      const status = $('.signup__status', form);
      if (!okFields) { const bad = inputs.find((i) => i.getAttribute('aria-invalid') === 'true'); bad && bad.focus(); return; }
      if (terms && !terms.checked) { status.textContent = 'Para participar, aceite o regulamento.'; terms.focus(); return; }
      // Ponto de integração com o back-end da promoção.
      form.dispatchEvent(new CustomEvent('cadastro:enviar', { bubbles: true, detail: Object.fromEntries(new FormData(form)) }));
      status.textContent = 'Dados validados. O envio do cadastro será habilitado em breve.';
    });
  }

  /* ==========================================================================
     Busca de lojas (lista será integrada depois)
     ========================================================================== */
  function setupStoreSearch() {
    for (const form of $$('[data-store-search]')) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = $('input', form).value.trim();
        form.dispatchEvent(new CustomEvent('lojas:buscar', { bubbles: true, detail: { cidade: q } }));
      });
    }
  }

  /* ==========================================================================
     Eventos globais
     ========================================================================== */
  function onScroll() {
    const y = scrollY;
    // rolagem iniciada por teclado, barra de rolagem ou âncora nativa
    if (smooth.active && Math.abs(y - smooth.lastSet) > 2) stopSmooth();
    if (!smooth.active) { smooth.current = smooth.target = y; S.scrollY = y; }
    kick();
  }

  function onPointerMove(e) {
    if (e.pointerType !== 'mouse' || reduced) return;
    S.tx = (e.clientX / S.vw) * 2 - 1;
    S.ty = (e.clientY / S.vh) * 2 - 1;
    kick();
  }

  let resizeT = 0;
  function onResize() {
    clearTimeout(resizeT);
    resizeT = setTimeout(measure, 120);
  }

  function resetMotion() {
    reduced = mqReduce.matches;
    setupSmooth();
    if (reduced) {
      S.tx = S.ty = S.sx = S.sy = S.cx = S.cy = 0;
      depthItems.forEach((i) => (i.el.style.transform = ''));
      plxItems.forEach((i) => (i.el.style.transform = ''));
      magnets.forEach((m) => { m.tx = m.ty = m.sx = m.sy = m.cx = m.cy = 0; m.el.style.transform = ''; });
    }
    kick();
  }

  /* ---------- init ---------- */
  function init() {
    splitTitles();
    collect();
    restorePointer();
    setupLive();
    setupReveal();
    setupCenterHover();
    setupSteps();
    setupMenu();
    setupAnchors();
    setupFaq();
    setupForm();
    setupStoreSearch();
    setupPageTransitions();
    setupSmooth();
    if (reduced) resetMotion();

    addEventListener('wheel', onWheel, { passive: false });
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('pointermove', onPointerMove, { passive: true });
    addEventListener('resize', onResize);
    addEventListener('load', measure);
    mqReduce.addEventListener('change', resetMotion);
    mqFine.addEventListener('change', setupSmooth);
    if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(document.body);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    measure();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
