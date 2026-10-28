/* =========================================================================
   LATA DO TESOURO · Montana Química
   Interações e animações — JavaScript nativo, zero dependências.
   ========================================================================= */
(() => {
  'use strict';

  /* ---------------------------------------------------------------------
     CONFIGURAÇÃO
     --------------------------------------------------------------------- */
  const CONFIG = {
    // URLs definitivas — enquanto forem '#', os botões não navegam.
    links: {
      cadastro: '#',     // página de cadastro / participação
      regulamento: '#',  // PDF do regulamento (abre em nova aba)
    },

    /* Rolagem suave da roda do mouse
       'override' → mede se o navegador já aplica rolagem suave e, em qualquer
                    caso, a roda passa a ser suavizada só pela página
                    (a nativa é cancelada) — nunca as duas juntas.
       'respect'  → se o navegador já tiver rolagem suave, mantém a nativa;
                    se não tiver, aplica a da página.
       'off'      → desligada.
       Trackpad, touch, teclado e barra de rolagem continuam sempre nativos. */
    smoothScroll: 'override',
    smoothLerp: 0.09,      // 0.06 (mais "macio") … 0.16 (mais direto)
    wheelStep: 70,         // px rolados por "clique" da roda (o padrão dos navegadores é ~100–120)
    wheelMaxLead: 0.55,    // o alvo pode se adiantar no máximo esta fração da altura da tela

    // Parallax do fundo de papel: fração da rolagem que o fundo "anda" para baixo.
    // 0 = fundo preso ao conteúdo · 0.14 = leve (padrão) · 0.25 = bem perceptível
    paperParallax: 0.14,
  };

  /* ---------------------------------------------------------------------
     UTILITÁRIOS
     --------------------------------------------------------------------- */
  const doc = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const mq = (q) => window.matchMedia(q);

  const reduceMotion = mq('(prefers-reduced-motion: reduce)');
  const finePointer = mq('(hover: hover) and (pointer: fine)');
  const desktopLayout = mq('(min-width: 1280px)');

  const maxScroll = () => Math.max(0, doc.scrollHeight - window.innerHeight);
  const HEADER_COMPACT_H = 80;

  doc.classList.add('is-ready');

  /* ---------------------------------------------------------------------
     LINKS (cadastro / regulamento)
     --------------------------------------------------------------------- */
  $$('[data-link]').forEach((a) => {
    const url = CONFIG.links[a.dataset.link];
    if (url && url !== '#') {
      a.href = url;
      if (a.dataset.link === 'regulamento') {
        a.target = '_blank';
        a.rel = 'noopener';
      }
    } else {
      a.addEventListener('click', (e) => e.preventDefault());
    }
  });

  /* ---------------------------------------------------------------------
     TEXTO: títulos divididos em palavras + links com efeito "roll"
     --------------------------------------------------------------------- */
  function splitWords(root) {
    let wi = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(' '));
              return;
            }
            const w = document.createElement('span');
            const inner = document.createElement('span');
            w.className = 'w';
            inner.textContent = part;
            inner.style.setProperty('--wi', wi++);
            w.appendChild(inner);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(root);
  }
  $$('[data-split]').forEach(splitWords);

  $$('.nav-link').forEach((a) => {
    const text = a.textContent.trim();
    const clip = document.createElement('span');
    const roll = document.createElement('span');
    const a1 = document.createElement('span');
    const a2 = document.createElement('span');
    clip.className = 'nav-link__clip';
    roll.className = 'nav-link__roll';
    a1.textContent = text;
    a2.textContent = text;
    a2.setAttribute('aria-hidden', 'true');
    roll.append(a1, a2);
    clip.appendChild(roll);
    a.replaceChildren(clip);
  });

  /* ---------------------------------------------------------------------
     ENTRADA DO KV (espera as imagens do KV decodificarem)
     --------------------------------------------------------------------- */
  const heroImgs = $$('.hero img');
  const whenReady = (img) => new Promise((resolve) => {
    const done = () => (img.decode ? img.decode().catch(() => {}).then(resolve) : resolve());
    if (img.complete) done();
    else {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', resolve, { once: true });
    }
  });
  Promise.race([
    Promise.all(heroImgs.map(whenReady)),
    new Promise((r) => setTimeout(r, 2200)),
  ]).then(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => doc.classList.add('is-loaded')));
  });

  /* ---------------------------------------------------------------------
     REVELAÇÃO NO SCROLL
     --------------------------------------------------------------------- */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        revealIO.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
  $$('[data-reveal], [data-split]').forEach((el) => revealIO.observe(el));

  /* ---------------------------------------------------------------------
     MENU: compacto no scroll · barra de progresso · seção ativa
     --------------------------------------------------------------------- */
  const header = $('.header');
  const progressBar = $('.header__progress');
  let lastCompact = null;

  function updateHeader(y) {
    const compact = y > 40;
    if (compact !== lastCompact) {
      header.classList.toggle('is-compact', compact);
      lastCompact = compact;
    }
    const max = maxScroll();
    progressBar.style.transform = `scaleX(${max > 0 ? (y / max).toFixed(4) : 0})`;
  }

  const spyLinks = $$('.header .nav-link[href^="#"], .mnav__link[href^="#"]');
  const spyIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = `#${entry.target.id}`;
      spyLinks.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === id));
    });
  }, { rootMargin: '-49% 0px -49% 0px' });
  $$('main section[id]').forEach((s) => spyIO.observe(s));

  /* ---------------------------------------------------------------------
     MENU MOBILE / TABLET
     --------------------------------------------------------------------- */
  const burger = $('.burger');
  const mnav = $('#menu-mobile');
  let menuOpen = false;

  function openMenu() {
    if (menuOpen) return;
    menuOpen = true;
    Smooth.stop();
    mnav.hidden = false;
    void mnav.offsetWidth; // reflow para a transição iniciar
    mnav.classList.add('is-open');
    document.body.classList.add('menu-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Fechar menu');
    setTimeout(() => { const first = $('.mnav__link', mnav); if (first) first.focus({ preventScroll: true }); }, 250);
  }
  function closeMenu({ focusBurger = false } = {}) {
    if (!menuOpen) return;
    menuOpen = false;
    mnav.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Abrir menu');
    const hide = () => { if (!menuOpen) mnav.hidden = true; };
    mnav.addEventListener('transitionend', hide, { once: true });
    setTimeout(hide, 800);
    if (focusBurger) burger.focus({ preventScroll: true });
  }
  burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen) closeMenu({ focusBurger: true });
    if (e.key === 'Tab' && menuOpen) { // mantém o foco dentro do menu
      const focusables = [burger, ...$$('a', mnav)];
      const i = focusables.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); focusables[focusables.length - 1].focus(); }
      else if (!e.shiftKey && i === focusables.length - 1) { e.preventDefault(); focusables[0].focus(); }
    }
  });
  desktopLayout.addEventListener('change', (e) => { if (e.matches) closeMenu(); });

  /* ---------------------------------------------------------------------
     ROLAGEM PARA ÂNCORAS (curva própria, cancelável)
     --------------------------------------------------------------------- */
  let tween = null;
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function cancelTween() {
    if (tween) { cancelAnimationFrame(tween.raf); tween = null; }
  }
  function scrollToY(y) {
    const to = clamp(y, 0, maxScroll());
    const from = window.scrollY;
    const dist = to - from;
    cancelTween();
    Smooth.stop();
    if (reduceMotion.matches || Math.abs(dist) < 2) { window.scrollTo(0, to); return; }
    const dur = clamp(Math.abs(dist) * 0.45, 650, 1400);
    const t0 = performance.now();
    tween = { raf: 0 };
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      window.scrollTo(0, from + dist * easeInOutCubic(p));
      Frame.flush();
      if (p < 1 && tween) tween.raf = requestAnimationFrame(step);
      else tween = null;
    };
    tween.raf = requestAnimationFrame(step);
  }
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((type) => {
    window.addEventListener(type, (e) => {
      if (type === 'keydown' && !['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) return;
      cancelTween();
    }, { passive: true });
  });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const hash = a.getAttribute('href');
    if (hash.length < 2) return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    e.preventDefault();
    const wasOpen = menuOpen;
    closeMenu();
    const y = hash === '#inicio' ? 0 : target.getBoundingClientRect().top + window.scrollY - HEADER_COMPACT_H;
    setTimeout(() => scrollToY(y), wasOpen ? 180 : 0);
    history.replaceState(null, '', hash);
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  /* ---------------------------------------------------------------------
     ROLAGEM SUAVE (roda do mouse) — com detecção da rolagem suave nativa
     --------------------------------------------------------------------- */
  const Smooth = (() => {
    const S = {
      native: null,        // null = não medido · true/false após a 1ª "clicada" da roda
      measured: false,
      detecting: false,
      detectDirty: false,
      running: false,
      target: 0,
      current: 0,
      raf: 0,
      t: 0,
      lastTrackpad: -1e9,
    };
    const mode = CONFIG.smoothScroll;
    const allowed = () => mode !== 'off' && !reduceMotion.matches && finePointer.matches && !menuOpen;

    // Trackpads e mouses "de inércia" já são suaves: ficam sempre nativos.
    function isTrackpad(e) {
      let pad = false;
      if (e.deltaMode === 0) {
        const ad = Math.abs(e.deltaY);
        if (e.wheelDeltaY && Math.abs(e.wheelDeltaY) === Math.round(ad * 3)) pad = true;
        else if (ad < 40) pad = true;
        else if (e.deltaX !== 0) pad = true;
      }
      if (pad) S.lastTrackpad = e.timeStamp;
      else if (e.timeStamp - S.lastTrackpad < 350) pad = true; // mesmo gesto
      return pad;
    }

    function hasScrollableParent(el, dy) {
      for (; el && el !== document.body && el !== doc; el = el.parentElement) {
        if (el.scrollHeight > el.clientHeight + 1) {
          const oy = getComputedStyle(el).overflowY;
          if (oy === 'auto' || oy === 'scroll') {
            if ((dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) || (dy < 0 && el.scrollTop > 0)) return true;
          }
        }
      }
      return false;
    }

    // A 1ª "clicada" da roda rola de forma nativa e é medida quadro a quadro:
    // salto único = navegador sem rolagem suave · deslocamento em vários quadros = já suave.
    function detect() {
      S.detecting = true;
      S.detectDirty = false;
      const y0 = window.scrollY;
      const t0 = performance.now();
      const samples = [];
      let slowFrames = false;
      const step = (now) => {
        if (!samples.length && now - t0 > 60) slowFrames = true; // aba em 2º plano / quadros atrasados
        samples.push(window.scrollY - y0);
        if (samples.length < 12) requestAnimationFrame(step);
        else finish();
      };
      const finish = () => {
        S.detecting = false;
        const total = samples[samples.length - 1];
        if (S.detectDirty || slowFrames || Math.abs(total) < 2) return; // inconclusivo
        const k = samples.findIndex((v) => Math.abs(v) > 0.5);
        const kept = samples.slice(k + 1).some((v, i) => Math.abs(v - samples[k + i]) > 1);
        S.native = Math.abs(samples[k]) < Math.abs(total) * 0.8 || kept;
        doc.dataset.nativeSmooth = String(S.native);
      };
      requestAnimationFrame(step);
    }

    /* Converte o evento em "cliques" da roda e aplica um passo fixo.
       O deltaY bruto varia com o navegador, a escala da tela (125%, 150%…) e o
       ajuste "linhas por clique" do sistema — por isso é normalizado. */
    function wheelDistance(e) {
      let notches;
      if (e.deltaMode === 1) notches = e.deltaY / 3;                                       // Firefox: 3 linhas por clique
      else if (e.deltaMode === 2) notches = e.deltaY * 4;                                  // modo "página" (raro)
      else if (e.wheelDeltaY && e.wheelDeltaY % 120 === 0) notches = -e.wheelDeltaY / 120; // Chromium/WebKit
      else notches = e.deltaY / 100;
      return clamp(notches, -3, 3) * CONFIG.wheelStep;
    }

    function loop(now) {
      const dt = Math.min(64, now - S.t);
      S.t = now;
      const k = 1 - Math.pow(1 - CONFIG.smoothLerp, dt / 16.667);
      S.current += (S.target - S.current) * k;
      if (Math.abs(S.target - S.current) < 0.35) S.current = S.target;
      window.scrollTo(0, S.current);
      Frame.flush(); // parallax/menu no MESMO quadro da rolagem (sem atraso de 1 quadro)
      if (S.current === S.target) { S.running = false; return; }
      S.raf = requestAnimationFrame(loop);
    }
    function start() {
      if (S.running) return;
      S.running = true;
      S.t = performance.now();
      S.raf = requestAnimationFrame(loop);
    }
    function stop() {
      if (!S.running) return;
      cancelAnimationFrame(S.raf);
      S.running = false;
    }

    function onWheel(e) {
      if (!allowed() || e.ctrlKey || e.defaultPrevented) return;
      if (isTrackpad(e)) { stop(); return; }
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (hasScrollableParent(e.target, e.deltaY)) return;
      if (S.detecting) { S.detectDirty = true; return; }
      // 1ª clicada: nativa, para medir. No modo 'respect' mede até ter um resultado conclusivo.
      if (!S.measured || (mode === 'respect' && S.native === null)) { S.measured = true; detect(); return; }
      if (mode === 'respect' && S.native) return;

      e.preventDefault(); // cancela a rolagem (e a suavização) nativa: só a da página atua
      if (!S.running) S.current = S.target = window.scrollY;
      const lead = window.innerHeight * CONFIG.wheelMaxLead;
      S.target = clamp(S.target + wheelDistance(e), S.current - lead, S.current + lead);
      S.target = clamp(S.target, 0, maxScroll());
      start();
    }

    // Se algo externo rolar a página (barra, teclado, "localizar"), volta ao controle nativo.
    function onScroll() {
      if (S.running && Math.abs(window.scrollY - S.current) > 4) stop();
    }

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { S.target = clamp(S.target, 0, maxScroll()); });

    return { stop };
  })();

  /* ---------------------------------------------------------------------
     PARALLAX (scroll + cursor) — um único rAF, só transform, subpixel
     Deslocamento = (scroll − topo da seção) × velocidade: com a seção alinhada
     ao topo da tela, cada camada fica exatamente na posição do layout.
     --------------------------------------------------------------------- */
  const Parallax = (() => {
    const MAX_SHIFT = 140;
    const enabled = () => !reduceMotion.matches;
    const items = $$('.fx').map((el) => ({
      el,
      section: el.closest('section'),
      speed: parseFloat(el.dataset.speed) || 0,
      depth: parseFloat(el.dataset.depth) || 0,
      ref: 0,
      visible: true,
      x: 0,
      y: 0,
    }));
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const hero = $('.hero');
    let lastT = 0;

    const visIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const it = items.find((i) => i.el === entry.target);
        if (it) it.visible = entry.isIntersecting;
      });
      Frame.request();
    }, { rootMargin: '25% 0px 25% 0px' });
    items.forEach((it) => visIO.observe(it.el));

    function measure() {
      const sy = window.scrollY;
      items.forEach((it) => {
        if (!it.section || it.section === hero) { it.ref = 0; return; }
        it.ref = it.section.getBoundingClientRect().top + sy - HEADER_COMPACT_H;
      });
    }

    function update(now) {
      if (!enabled()) return false;
      const sy = window.scrollY;
      const allowPointer = finePointer.matches;
      // mesma curva a 60, 120 ou 144 Hz; X e Y avançam juntos (trajetória reta)
      const dt = lastT ? Math.min(64, now - lastT) : 16.667;
      lastT = now;
      const k = 1 - Math.pow(1 - 0.075, dt / 16.667);
      pointer.x += (pointer.tx - pointer.x) * k;
      pointer.y += (pointer.ty - pointer.y) * k;
      const pointerMoving = Math.abs(pointer.tx - pointer.x) > 0.0005 || Math.abs(pointer.ty - pointer.y) > 0.0005;
      if (!pointerMoving) lastT = 0;

      for (const it of items) {
        if (!it.visible) continue;
        let y = (sy - it.ref) * it.speed;
        if (it.ref !== 0) y = clamp(y, -MAX_SHIFT, MAX_SHIFT);
        let x = 0;
        if (it.depth && allowPointer) {
          x = -pointer.x * it.depth;
          y += -pointer.y * it.depth * 0.6;
        }
        if (Math.abs(x - it.x) > 0.01 || Math.abs(y - it.y) > 0.01) {
          it.el.style.translate = `${x.toFixed(3)}px ${y.toFixed(3)}px`;
          it.x = x;
          it.y = y;
        }
      }
      return pointerMoving;
    }

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
      Frame.request();
    }, { passive: true });
    doc.addEventListener('pointerleave', () => { pointer.tx = 0; pointer.ty = 0; Frame.request(); });

    return { update, measure };
  })();

  /* ---------------------------------------------------------------------
     PARALLAX DO FUNDO DE PAPEL
     O fundo desce a uma fração da rolagem (CONFIG.paperParallax), então o
     conteúdo passa "por cima" dele com profundidade.
     · Com scroll-driven animations (CSS): a animação roda no compositor; aqui
       só mantemos --paper-drift = rolagem máxima × fator.
     · Sem suporte: o deslocamento é aplicado a cada quadro, junto do restante.
     --------------------------------------------------------------------- */
  const PaperBg = (() => {
    const el = $('.paper__bg');
    const cssDriven = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()'));
    const factor = () => (reduceMotion.matches ? 0 : CONFIG.paperParallax);
    let lastDrift = -1;
    let lastY = -1;

    function syncDrift() {
      if (!el || !cssDriven) return;
      const drift = Math.round(maxScroll() * factor() * 100) / 100;
      if (drift !== lastDrift) {
        el.style.setProperty('--paper-drift', `${drift}px`);
        lastDrift = drift;
      }
    }
    function update(sy) {
      if (!el || cssDriven) return;
      const y = sy * factor();
      if (Math.abs(y - lastY) > 0.01) {
        el.style.translate = `0px ${y.toFixed(3)}px`;
        lastY = y;
      }
    }
    if (el) el.dataset.mode = cssDriven ? 'css' : 'js';
    return { syncDrift, update };
  })();

  /* ---------------------------------------------------------------------
     LOOP DE QUADRO (scroll / cursor)
     --------------------------------------------------------------------- */
  const Frame = (() => {
    let raf = 0;
    const tick = (now = performance.now()) => {
      raf = 0;
      const sy = window.scrollY;
      updateHeader(sy);
      PaperBg.update(sy);
      if (Parallax.update(now)) request();
    };
    const request = () => { if (!raf) raf = requestAnimationFrame(tick); };
    // Chamado pela rolagem suave logo após o scrollTo: aplica o parallax no mesmo quadro.
    const flush = () => {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      tick(performance.now());
    };
    return { request, flush };
  })();

  window.addEventListener('scroll', Frame.request, { passive: true });

  // Re-mede quando a altura da página muda (redimensionar, fonte carregada, FAQ aberto…)
  let measureT = 0;
  const remeasure = () => {
    clearTimeout(measureT);
    measureT = setTimeout(() => { Parallax.measure(); Frame.request(); }, 150);
  };
  // O alcance do parallax do fundo acompanha a altura da página a cada quadro
  // (sem debounce: ao abrir o FAQ a página cresce aos poucos e o fundo não pode "pular").
  const onPageResize = () => { PaperBg.syncDrift(); remeasure(); };
  if ('ResizeObserver' in window) new ResizeObserver(onPageResize).observe(document.body);
  window.addEventListener('resize', onPageResize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onPageResize);
  reduceMotion.addEventListener('change', () => { PaperBg.syncDrift(); Frame.request(); });
  PaperBg.syncDrift();
  Parallax.measure();
  Frame.request();

  /* ---------------------------------------------------------------------
     COMO PARTICIPAR: inclinação 3D que segue o cursor
     --------------------------------------------------------------------- */
  if (finePointer.matches && !reduceMotion.matches) {
    $$('[data-tilt]').forEach((card) => {
      let rect = null;
      card.addEventListener('pointerenter', () => {
        rect = card.getBoundingClientRect();
        card.classList.add('is-tilting');
      });
      card.addEventListener('pointermove', (e) => {
        if (!rect) rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty('--ry', `${(px * 8).toFixed(2)}deg`);
        card.style.setProperty('--rx', `${(-py * 6).toFixed(2)}deg`);
        card.style.setProperty('--ix', `${(px * 16).toFixed(2)}px`);
        card.style.setProperty('--iy', `${(py * 10).toFixed(2)}px`);
      });
      card.addEventListener('pointerleave', () => {
        rect = null;
        card.classList.remove('is-tilting');
        ['--rx', '--ry', '--ix', '--iy'].forEach((p) => card.style.removeProperty(p));
      });
    });
  }

  /* ---------------------------------------------------------------------
     TOUCH: o card no centro da tela recebe o estado de "hover"
     --------------------------------------------------------------------- */
  if (!finePointer.matches) {
    const centerIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle('is-active', entry.isIntersecting));
    }, { rootMargin: '-46% 0px -46% 0px' });
    $$('[data-center]').forEach((el) => centerIO.observe(el));
  }

  /* ---------------------------------------------------------------------
     BOTÕES MAGNÉTICOS (desktop)
     --------------------------------------------------------------------- */
  if (finePointer.matches && !reduceMotion.matches) {
    $$('[data-magnetic]').forEach((btn) => {
      let rect = null;
      let restT = 0;
      btn.addEventListener('pointerenter', () => {
        rect = btn.getBoundingClientRect();
        clearTimeout(restT);
        btn.classList.add('is-magnetic'); // camada de GPU + posição subpixel enquanto segue o cursor
      });
      btn.addEventListener('pointermove', (e) => {
        if (!rect) rect = btn.getBoundingClientRect();
        const dx = e.clientX - (rect.left + rect.width / 2);
        const dy = e.clientY - (rect.top + rect.height / 2);
        btn.style.setProperty('--mx', `${(dx * 0.16).toFixed(2)}px`);
        btn.style.setProperty('--my', `${(dy * 0.3).toFixed(2)}px`);
      });
      btn.addEventListener('pointerleave', () => {
        rect = null;
        btn.style.removeProperty('--mx');
        btn.style.removeProperty('--my');
        // mantém a camada subpixel até o botão terminar de voltar; em repouso o texto fica nítido
        clearTimeout(restT);
        restT = setTimeout(() => { if (!btn.matches(':hover')) btn.classList.remove('is-magnetic'); }, 700);
      });
    });
  }

  /* ---------------------------------------------------------------------
     DÚVIDAS FREQUENTES (acordeão — um aberto por vez)
     --------------------------------------------------------------------- */
  const faqItems = $$('.faq__item');
  function setFaq(item, open) {
    item.classList.toggle('is-open', open);
    $('.faq__q', item).setAttribute('aria-expanded', String(open));
  }
  faqItems.forEach((item) => {
    $('.faq__q', item).addEventListener('click', () => {
      const willOpen = !item.classList.contains('is-open');
      faqItems.forEach((i) => { if (i !== item) setFaq(i, false); });
      setFaq(item, willOpen);
    });
  });

  /* ---------------------------------------------------------------------
     GANHADORES: busca instantânea (ignora acentos e maiúsculas)
     --------------------------------------------------------------------- */
  const searchForm = $('.search');
  if (searchForm) {
    const input = $('.search__input', searchForm);
    const empty = $('.winners__empty');
    const status = $('#busca-status');
    const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').toLowerCase().trim();
    let t = 0;

    // Lê a lista a cada busca: funciona mesmo se os ganhadores forem inseridos depois (via CMS/API).
    const run = () => {
      const q = norm(input.value);
      let count = 0;
      $$('.winners__list .winner').forEach((li) => {
        const match = !q || norm(li.textContent).includes(q);
        const wasHidden = li.hidden;
        li.hidden = !match;
        if (match) {
          count++;
          if (wasHidden) { li.classList.remove('is-match'); void li.offsetWidth; li.classList.add('is-match'); }
        }
      });
      empty.hidden = count > 0 || !q;
      status.textContent = q ? `${count} ${count === 1 ? 'ganhador encontrado' : 'ganhadores encontrados'}` : '';
    };
    input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 120); });
    searchForm.addEventListener('submit', (e) => { e.preventDefault(); run(); });
  }
})();
