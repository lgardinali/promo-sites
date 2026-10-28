/* ==========================================================================
   Frescatto · Gostinho de Infância — interações
   JavaScript nativo, zero dependências.
   ========================================================================== */
(() => {
  'use strict';

  const doc = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mqFine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const mqDesk = window.matchMedia('(min-width: 1024px)');
  const reduced = () => mqReduce.matches;
  const hasIO = 'IntersectionObserver' in window;

  // Desativa o fallback CSS que revela tudo caso o JS não carregue
  doc.classList.add('r-ready');

  /* Curva "Slow" do Figma — mola k=80, c=20, m=1 (mesma de --ease-slow no CSS) */
  const easeSlow = (() => {
    const s = Math.sqrt(20), r1 = -10 + s, r2 = -10 - s;
    const A = r2 / (r1 - r2), B = -r1 / (r1 - r2), T = 1.046;
    return p => (p >= 1 ? 1 : 1 + A * Math.exp(r1 * p * T) + B * Math.exp(r2 * p * T));
  })();

  const maxScroll = () => Math.max(0, doc.scrollHeight - window.innerHeight);

  /* ------------------------------------------------------------------------
     SCROLL SUAVE
     Navegadores modernos (Chrome/Edge/Firefox com "rolagem suave", Safari com
     trackpad) já suavizam a roda do mouse. Para não "suavizar duas vezes",
     o primeiro giro de roda é deixado nativo e medido: se o navegador saltou
     a distância inteira de uma vez, ativamos a suavização própria; se ele
     animou, mantemos o comportamento nativo e removemos o listener.
     Trackpads / mouses de alta precisão sempre ficam no nativo (têm inércia).
     ------------------------------------------------------------------------ */
  const Smooth = (() => {
    let mode = 'unknown'; // 'unknown' | 'native' | 'custom'
    let probing = false;
    let raf = 0, last = 0, lastSet = null;
    let target = window.scrollY, current = window.scrollY;
    let tween = null; // { from, to, t0, dur, done }

    const apply = y => { lastSet = y; window.scrollTo(0, y); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; last = 0; tween = null; };
    const cancel = () => { if (raf) { stop(); target = current = window.scrollY; } };

    function frame(now) {
      if (tween) {
        const p = clamp((now - tween.t0) / tween.dur, 0, 1);
        current = tween.from + (tween.to - tween.from) * easeSlow(p);
        apply(current);
        if (p >= 1) {
          const done = tween.done;
          stop();
          target = current;
          if (done) done();
          return;
        }
      } else {
        const dt = last ? Math.min(64, now - last) : 16.67;
        last = now;
        current += (target - current) * (1 - Math.pow(1 - 0.12, dt / 16.67));
        if (Math.abs(target - current) < 0.5) {
          current = target;
          apply(current);
          stop();
          return;
        }
        apply(current);
      }
      raf = requestAnimationFrame(frame);
    }
    const run = () => { if (!raf) raf = requestAnimationFrame(frame); };

    const norm = e => e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? window.innerHeight : 1);
    const precise = e => e.deltaMode === 0 && (Math.abs(e.deltaY) < 50 || e.deltaY % 1 !== 0);

    // elementos com rolagem própria continuam nativos
    const scrollableInside = el => {
      for (; el && el !== document.body && el !== doc; el = el.parentElement) {
        if (el.hasAttribute && el.hasAttribute('data-native-scroll')) return true;
        const oy = getComputedStyle(el).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return true;
      }
      return false;
    };

    function probe(e) {
      const y0 = window.scrollY, d = norm(e);
      if ((d > 0 && y0 >= maxScroll() - 4) || (d < 0 && y0 <= 4)) return; // sem espaço para medir
      probing = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        probing = false;
        const moved = Math.abs(window.scrollY - y0);
        if (!moved) return; // inconclusivo — mede no próximo giro
        if (moved >= Math.abs(d) * 0.9) {
          mode = 'custom';
        } else {
          mode = 'native';
          window.removeEventListener('wheel', onWheel, { passive: false });
        }
      }));
    }

    function onWheel(e) {
      if (tween) cancel(); // qualquer roda interrompe a rolagem de âncora
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || reduced()) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (doc.classList.contains('menu-open') || scrollableInside(e.target)) return;
      if (precise(e)) { cancel(); return; }
      if (mode === 'unknown') { if (!probing) probe(e); return; }
      if (mode !== 'custom') return;

      e.preventDefault();
      if (!raf) { current = window.scrollY; target = current; }
      target = clamp(target + norm(e), 0, maxScroll());
      run();
    }

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('wheel', () => { if (tween) cancel(); }, { passive: true });
    window.addEventListener('touchstart', cancel, { passive: true });
    window.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.target === doc) cancel(); }, { passive: true });
    window.addEventListener('keydown', e => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'].includes(e.key)) cancel();
    }, { passive: true });
    // rolagem externa (barra de rolagem, teclado, find-in-page…) cancela a nossa
    window.addEventListener('scroll', () => {
      if (raf && lastSet !== null && Math.abs(window.scrollY - lastSet) > 3 && Math.abs(window.scrollY - maxScroll()) > 3) cancel();
    }, { passive: true });

    function to(y, done) {
      y = clamp(Math.round(y), 0, maxScroll());
      const from = window.scrollY, dist = Math.abs(y - from);
      if (reduced() || dist < 2) { apply(y); if (done) done(); return; }
      stop();
      current = from;
      tween = { from, to: y, t0: performance.now(), dur: clamp(480 + dist * 0.3, 700, 1500), done };
      run();
    }

    return { to, cancel };
  })();

  /* ------------------------------------------------------------------------
     ÂNCORAS (menu, CTA, voltar ao topo)
     ------------------------------------------------------------------------ */
  const headerOffset = () => (mqDesk.matches ? 96 * Math.min(1, window.innerWidth / 1920) : 64);

  $$('main, main section[id]').forEach(s => s.setAttribute('tabindex', '-1'));

  function goTo(hash) {
    if (hash === '#home' || hash === '#topo') {
      Smooth.to(0, () => $('#home').focus({ preventScroll: true }));
      history.replaceState(null, '', '#home');
      return true;
    }
    const el = document.getElementById(hash.slice(1));
    if (!el) return false;
    const y = el.getBoundingClientRect().top + window.scrollY - headerOffset() + 1;
    Smooth.to(y, () => { if (el.matches('section, main')) el.focus({ preventScroll: true }); });
    history.replaceState(null, '', hash);
    return true;
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href === '#') { e.preventDefault(); return; } // links provisórios (cadastro, regulamento, redes)
    if (goTo(href)) {
      e.preventDefault();
      Menu.close(false);
    }
  });

  /* ------------------------------------------------------------------------
     MENU MOBILE
     ------------------------------------------------------------------------ */
  const Menu = (() => {
    const burger = $('.burger');
    const menu = $('#menu-mobile');
    const page = $('.page');
    const isOpen = () => menu.classList.contains('is-open');

    function open() {
      Smooth.cancel();
      menu.classList.add('is-open');
      menu.setAttribute('aria-hidden', 'false');
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Fechar menu');
      doc.classList.add('menu-open');
      page.inert = true;
      setTimeout(() => { const l = $('.menu__link', menu); if (l && isOpen()) l.focus({ preventScroll: true }); }, 420);
    }
    function close(returnFocus = true) {
      if (!isOpen()) return;
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Abrir menu');
      doc.classList.remove('menu-open');
      page.inert = false;
      if (returnFocus) burger.focus({ preventScroll: true });
    }
    burger.addEventListener('click', () => (isOpen() ? close() : open()));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    mqDesk.addEventListener('change', e => { if (e.matches) close(false); });
    return { close };
  })();

  /* ------------------------------------------------------------------------
     DIVISÃO DE LETRAS ("Compre & Ganhe")
     ------------------------------------------------------------------------ */
  $$('[data-split]').forEach(el => {
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    while (el.firstChild) visual.appendChild(el.firstChild);
    let i = 0;
    const walk = node => {
      Array.from(node.childNodes).forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const ch of n.textContent) {
            if (/\s/.test(ch)) { frag.appendChild(document.createTextNode(' ')); continue; }
            const s = document.createElement('span');
            s.className = 'char';
            s.textContent = ch;
            s.style.setProperty('--i', i++);
            frag.appendChild(s);
          }
          n.replaceWith(frag);
        } else if (n.nodeType === 1) {
          walk(n);
        }
      });
    };
    walk(visual);
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = label;
    el.append(sr, visual);
  });

  /* ------------------------------------------------------------------------
     INTRO DO KV (após as fontes, para a animação usar o desenho correto)
     ------------------------------------------------------------------------ */
  const loaded = () => requestAnimationFrame(() => doc.classList.add('is-loaded'));
  if (reduced()) {
    doc.classList.add('is-loaded');
  } else {
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise(r => setTimeout(r, 900))]).then(loaded);
  }

  /* ------------------------------------------------------------------------
     REVELAÇÃO AO ROLAR
     ------------------------------------------------------------------------ */
  (() => {
    $$('[data-stagger]').forEach(group => {
      const step = parseFloat(group.dataset.stagger) || 80;
      $$('[data-reveal]', group).forEach((el, i) => el.style.setProperty('--d', `${i * step}ms`));
    });
    const els = $$('[data-reveal]');
    // ao terminar, remove o estado de revelação para o elemento voltar às próprias transições (hover etc.)
    const finish = el => { el.classList.remove('is-in'); el.removeAttribute('data-reveal'); };

    if (reduced() || !hasIO) { els.forEach(finish); return; }

    const io = new IntersectionObserver(entries => {
      let n = 0;
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target;
        io.unobserve(el);
        if (el.dataset.reveal === 'faq') el.style.setProperty('--d', `${n++ * 70}ms`);
        el.classList.add('is-in');
        const d = parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0;
        setTimeout(() => finish(el), d + 1500);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    els.forEach(el => io.observe(el));
  })();

  /* ------------------------------------------------------------------------
     PARALLAX DE ROLAGEM (blurs, padrão de peixes, flores da FAQ)
     ------------------------------------------------------------------------ */
  const Parallax = (() => {
    const items = $$('[data-parallax]').map(el => ({
      el,
      s: parseFloat(el.dataset.parallax) || 0,
      max: el.dataset.parallaxMax !== undefined ? parseFloat(el.dataset.parallaxMax) : Infinity,
      ref: 0,
      on: true
    }));
    const offTop = el => { let y = 0; for (; el; el = el.offsetParent) y += el.offsetTop; return y; };

    // ref = rolagem em que o elemento fica na posição exata do layout:
    // 0 para o que já aparece na primeira dobra; centro da tela para o resto
    let mw = 0, mh = 0;
    function measure() {
      const vh = window.innerHeight;
      mw = window.innerWidth; mh = doc.scrollHeight;
      items.forEach(it => {
        const top = offTop(it.el), h = it.el.offsetHeight;
        it.ref = top < vh ? 0 : top + h / 2 - vh / 2;
      });
    }
    if (hasIO) {
      const io = new IntersectionObserver(es => es.forEach(en => {
        const it = items.find(i => i.el === en.target);
        if (it) it.on = en.isIntersecting;
      }), { rootMargin: '40% 0px' });
      items.forEach(it => io.observe(it.el));
    }
    function update(y) {
      if (reduced()) return;
      // garante medidas atuais mesmo se o resize/ResizeObserver ainda não tiver disparado
      if (window.innerWidth !== mw || doc.scrollHeight !== mh) measure();
      const k = mqDesk.matches ? 1 : 0.6;
      for (const it of items) {
        if (!it.on) continue;
        // data-parallax-max limita o deslocamento (ex.: 0 = nunca desce além da posição do layout)
        const shift = Math.min(it.max, (y - it.ref) * it.s * k);
        it.el.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0)`;
      }
    }
    return { measure, update };
  })();

  /* ------------------------------------------------------------------------
     PROFUNDIDADE NO KV (segue o cursor no desktop)
     ------------------------------------------------------------------------ */
  (() => {
    const hero = $('#home');
    const items = $$('[data-depth]', hero);
    if (!items.length) return;
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    function loop() {
      cx += (tx - cx) * 0.07;
      cy += (ty - cy) * 0.07;
      items.forEach(el => {
        const d = parseFloat(el.dataset.depth);
        el.style.transform = `translate3d(${(cx * d).toFixed(2)}px, ${(cy * d).toFixed(2)}px, 0)`;
      });
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.0005 ? requestAnimationFrame(loop) : 0;
    }
    hero.addEventListener('pointermove', e => {
      if (!mqFine.matches || reduced()) return;
      const r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      if (!raf) raf = requestAnimationFrame(loop);
    });
    hero.addEventListener('pointerleave', () => { tx = ty = 0; if (!raf) raf = requestAnimationFrame(loop); });
  })();

  /* ------------------------------------------------------------------------
     HEADER: compacto, CTA, progresso, voltar ao topo, scrollspy
     ------------------------------------------------------------------------ */
  const header = $('.header');
  const heroEl = $('#home');
  const progress = $('.header__progress span');
  const toTop = $('.to-top');
  const headerCta = $('.header__cta');
  let ctaShown = false;

  function onFrame() {
    ticking = false;
    const y = window.scrollY;
    const max = maxScroll();
    header.classList.toggle('is-compact', y > 24);
    const show = y > heroEl.offsetTop + heroEl.offsetHeight * 0.55;
    if (show !== ctaShown) {
      ctaShown = show;
      header.classList.toggle('show-cta', show);
      headerCta.tabIndex = show ? 0 : -1;
      headerCta.setAttribute('aria-hidden', String(!show));
    }
    progress.style.transform = `scaleX(${max ? (y / max).toFixed(4) : 0})`;
    toTop.classList.toggle('is-visible', y > window.innerHeight * 1.2);
    Parallax.update(y);
  }
  let ticking = false;
  const requestFrame = () => { if (!ticking) { ticking = true; requestAnimationFrame(onFrame); } };
  window.addEventListener('scroll', requestFrame, { passive: true });
  headerCta.setAttribute('aria-hidden', 'true');

  toTop.addEventListener('click', () => {
    Smooth.to(0, () => heroEl.focus({ preventScroll: true }));
    history.replaceState(null, '', '#home');
  });

  if (hasIO) {
    const links = $$('[data-spy]');
    const spy = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        links.forEach(a => {
          const on = a.dataset.spy === en.target.id;
          a.classList.toggle('is-active', on);
          if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -54% 0px' });
    ['home', 'como-participar', 'premios', 'duvidas'].forEach(id => { const s = document.getElementById(id); if (s) spy.observe(s); });
  }

  /* ------------------------------------------------------------------------
     "HOVER" POR ROLAGEM NO TOQUE: o item no centro da tela fica ativo
     ------------------------------------------------------------------------ */
  if (hasIO) {
    const center = new IntersectionObserver(entries => {
      entries.forEach(en => en.target.classList.toggle('is-active', en.isIntersecting && !mqFine.matches && !reduced()));
    }, { rootMargin: '-44% 0px -44% 0px' });
    $$('[data-center]').forEach(el => center.observe(el));
  }

  /* ------------------------------------------------------------------------
     LOOPS PAUSADOS FORA DA TELA
     ------------------------------------------------------------------------ */
  if (hasIO) {
    const loops = new IntersectionObserver(es => es.forEach(en => en.target.classList.toggle('is-offscreen', !en.isIntersecting)), { rootMargin: '15% 0px' });
    $$('[data-loop-scope]').forEach(el => { if (el !== header) loops.observe(el); });
  }

  /* ------------------------------------------------------------------------
     CARROSSEL DE PRÊMIOS
     ------------------------------------------------------------------------ */
  $$('[data-carousel]').forEach(root => {
    const slides = $$('.carousel__slide', root);
    const track = $('.carousel__track', root);
    const viewport = $('.carousel__viewport', root);
    const dotsWrap = $('.carousel__dots', root);
    const n = slides.length;
    let index = 0, timer = 0, hover = false, focused = false, visible = false;
    const DELAY = 4800;

    const dots = slides.map((s, k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'carousel__dot';
      b.setAttribute('aria-label', `Ver presente ${k + 1} de ${n}`);
      b.addEventListener('click', () => { go(k, k > index ? 'next' : 'prev'); interacted(); });
      dotsWrap.appendChild(b);
      return b;
    });
    slides.forEach((s, k) => { if (k) s.setAttribute('aria-hidden', 'true'); });

    function sync() {
      dots.forEach((d, k) => {
        d.classList.toggle('is-active', k === index);
        if (k === index) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
    }

    function go(k, dir) {
      k = (k + n) % n;
      if (k === index) return;
      const from = slides[index], to = slides[k];
      track.dataset.dir = dir;
      // posiciona o próximo slide do lado de entrada, sem transição
      to.classList.remove('is-leaving');
      to.style.transition = 'none';
      to.style.translate = dir === 'next' ? '14% 0' : '-14% 0';
      void to.offsetWidth;
      to.style.transition = '';
      to.style.translate = '';
      from.classList.remove('is-active');
      from.classList.add('is-leaving');
      from.setAttribute('aria-hidden', 'true');
      const tilt = $('.carousel__tilt', from);
      if (tilt) tilt.style.transform = '';
      to.classList.add('is-active');
      to.removeAttribute('aria-hidden');
      clearTimeout(from._leave);
      from._leave = setTimeout(() => from.classList.remove('is-leaving'), 700);
      index = k;
      sync();
    }

    const stopAuto = () => { clearTimeout(timer); timer = 0; };
    function auto() {
      stopAuto();
      if (reduced() || hover || focused || !visible || document.hidden) return;
      timer = setTimeout(() => { go(index + 1, 'next'); auto(); }, DELAY);
    }
    function interacted() {
      track.setAttribute('aria-live', 'polite');
      auto();
    }

    $('[data-prev]', root).addEventListener('click', () => { go(index - 1, 'prev'); interacted(); });
    $('[data-next]', root).addEventListener('click', () => { go(index + 1, 'next'); interacted(); });

    root.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1, 'prev'); interacted(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1, 'next'); interacted(); }
    });

    // gesto de arrastar no toque
    let sx = 0, sy = 0, tracking = false;
    viewport.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      tracking = true; sx = e.clientX; sy = e.clientY;
    }, { passive: true });
    viewport.addEventListener('pointerup', e => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        go(index + (dx < 0 ? 1 : -1), dx < 0 ? 'next' : 'prev');
        interacted();
      }
    });
    viewport.addEventListener('pointercancel', () => { tracking = false; });

    // inclinação 3D seguindo o cursor
    viewport.addEventListener('pointermove', e => {
      if (!mqFine.matches || reduced()) return;
      const r = viewport.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      const tilt = $('.carousel__slide.is-active .carousel__tilt', root);
      if (tilt) tilt.style.transform = `perspective(1000px) rotateY(${(x * 10).toFixed(2)}deg) rotateX(${(-y * 8).toFixed(2)}deg)`;
    });
    viewport.addEventListener('pointerleave', () => { $$('.carousel__tilt', root).forEach(t => { t.style.transform = ''; }); });

    root.addEventListener('mouseenter', () => { hover = true; stopAuto(); });
    root.addEventListener('mouseleave', () => { hover = false; auto(); });
    root.addEventListener('focusin', () => { focused = true; stopAuto(); });
    root.addEventListener('focusout', e => { if (!root.contains(e.relatedTarget)) { focused = false; auto(); } });
    document.addEventListener('visibilitychange', auto);

    if (hasIO) {
      new IntersectionObserver(es => { visible = es[0].isIntersecting; auto(); }, { threshold: 0.35 }).observe(root);
    }
    sync();
  });

  /* ------------------------------------------------------------------------
     FAQ — acordeão (um aberto por vez, sem "pulos" na página)
     ------------------------------------------------------------------------ */
  $$('[data-faq]').forEach(list => {
    const items = $$('.faq-item', list);

    function set(item, open) {
      item.classList.toggle('is-open', open);
      $('.faq-item__btn', item).setAttribute('aria-expanded', String(open));
    }

    items.forEach((item, k) => {
      const btn = $('.faq-item__btn', item);
      const panel = $('.faq-item__panel', item);
      btn.id = `faq-${k + 1}`;
      panel.id = `faq-${k + 1}-resposta`;
      btn.setAttribute('aria-controls', panel.id);
      panel.setAttribute('aria-labelledby', btn.id);

      btn.addEventListener('click', () => {
        const open = !item.classList.contains('is-open');
        const closingAbove = items.some((o, j) => j < k && o.classList.contains('is-open'));
        items.forEach(o => { if (o !== item && o.classList.contains('is-open')) set(o, false); });
        set(item, open);
        // mantém a pergunta clicada parada na tela enquanto a anterior fecha
        if (closingAbove) {
          const startTop = item.getBoundingClientRect().top;
          const t0 = performance.now();
          const hold = now => {
            const delta = item.getBoundingClientRect().top - startTop;
            if (Math.abs(delta) > 0.5) window.scrollBy(0, delta);
            if (now - t0 < 720) requestAnimationFrame(hold);
          };
          requestAnimationFrame(hold);
        }
      });
    });
  });

  /* ------------------------------------------------------------------------
     BOTÃO MAGNÉTICO (CTA principal, desktop)
     ------------------------------------------------------------------------ */
  $$('[data-magnetic]').forEach(el => {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const loop = () => {
      cx += (tx - cx) * 0.14;
      cy += (ty - cy) * 0.14;
      el.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`;
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.05 ? requestAnimationFrame(loop) : 0;
    };
    el.addEventListener('pointermove', e => {
      if (!mqFine.matches || reduced()) return;
      const r = el.getBoundingClientRect();
      tx = (e.clientX - (r.left + r.width / 2)) * 0.18;
      ty = (e.clientY - (r.top + r.height / 2)) * 0.3;
      if (!raf) raf = requestAnimationFrame(loop);
    });
    el.addEventListener('pointerleave', () => { tx = ty = 0; if (!raf) raf = requestAnimationFrame(loop); });
  });

  /* ------------------------------------------------------------------------
     MÔNICA — pulinho + chuva de flores e estrelas
     ------------------------------------------------------------------------ */
  (() => {
    const monica = $('.hero__monica');
    if (!monica) return;
    const shapes = ['estrela-amarela.svg', 'flor-rosa.svg', 'flor-verde-p.svg'];
    monica.addEventListener('click', () => {
      monica.classList.remove('is-jump');
      void monica.offsetWidth;
      monica.classList.add('is-jump');
      if (reduced() || !Element.prototype.animate) return;
      const r = monica.getBoundingClientRect();
      const ox = r.left + r.width * 0.42, oy = r.top + r.height * 0.32;
      for (let k = 0; k < 16; k++) {
        const img = new Image();
        img.src = `assets/img/${shapes[k % shapes.length]}`;
        img.alt = '';
        img.className = 'confetti';
        const size = 16 + Math.random() * 30;
        img.style.width = `${size}px`;
        img.style.left = `${ox}px`;
        img.style.top = `${oy}px`;
        document.body.appendChild(img);
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
        const dist = 110 + Math.random() * 200;
        const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
        const spin = (Math.random() - 0.5) * 720;
        img.animate([
          { transform: 'translate(-50%, -50%) scale(.2) rotate(0deg)', opacity: 1 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(${spin * 0.6}deg)`, opacity: 1, offset: 0.55 },
          { transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${dy + 140}px)) scale(.7) rotate(${spin}deg)`, opacity: 0 }
        ], { duration: 1300 + Math.random() * 600, easing: 'cubic-bezier(.2, .75, .3, 1)' }).onfinish = () => img.remove();
      }
    });
  })();

  /* ------------------------------------------------------------------------
     MEDIDAS (parallax) — no carregamento, resize e mudança de altura
     ------------------------------------------------------------------------ */
  let resizeT = 0;
  const remeasure = () => { Parallax.measure(); requestFrame(); };
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(remeasure, 120); }, { passive: true });
  window.addEventListener('load', remeasure);
  if ('ResizeObserver' in window) new ResizeObserver(() => { clearTimeout(resizeT); resizeT = setTimeout(remeasure, 120); }).observe($('.page'));
  remeasure();
})();
