/* ==========================================================================
   FESTIVAL 9 ANOS — AÇAÍ NO KILO · app.js
   HTML/CSS/JS puro, zero dependências.
   --------------------------------------------------------------------------
   1.  Utilidades
   2.  Scroll suave (com compensação do header fixo)
   3.  Header: estado, gaveta mobile, scroll-spy
   4.  Reveal com o scroll
   5.  Parallax (scroll + ponteiro no KV)
   6.  Accordion de dúvidas
   7.  Ganhadores: abas, busca e barra de rolagem customizada
   8.  Barra de progresso + voltar ao topo
   ========================================================================== */
(() => {
  'use strict';

  /* ======================================================== 1. UTILIDADES */
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canHover     = window.matchMedia('(hover: hover) and (pointer: fine)');
  const isDesktopKV  = window.matchMedia('(min-width: 1024px)');

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const lerp  = (a, b, t) => a + (b - a) * t;

  /* Agrupa todo o trabalho de scroll num único rAF */
  const scrollTasks = [];
  let scrollQueued = false;
  const onScrollFrame = () => {
    scrollQueued = false;
    const y = window.scrollY || window.pageYOffset;
    for (const task of scrollTasks) task(y);
  };
  const requestScrollFrame = () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(onScrollFrame);
  };
  window.addEventListener('scroll', requestScrollFrame, { passive: true });
  window.addEventListener('resize', requestScrollFrame, { passive: true });

  const escapeHTML = (str) => String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const normalize = (str) => String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  /* ======================================================== 2. SCROLL SUAVE */
  const headerEl = $('[data-header]');

  const headerOffset = () => (headerEl ? headerEl.getBoundingClientRect().height + 16 : 90);

  const easeInOutCubic = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  let scrollAnim = null;
  function smoothScrollTo(targetY) {
    const startY = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const endY = clamp(targetY, 0, max);
    const distance = endY - startY;

    if (reduceMotion.matches || Math.abs(distance) < 4) {
      window.scrollTo(0, endY);
      return;
    }

    if (scrollAnim) cancelAnimationFrame(scrollAnim);
    /* Duração proporcional à distância: 450ms a 1100ms */
    const duration = clamp(420 + Math.abs(distance) * 0.28, 450, 1100);
    const start = performance.now();

    const step = (now) => {
      const t = clamp((now - start) / duration, 0, 1);
      window.scrollTo(0, startY + distance * easeInOutCubic(t));
      if (t < 1) scrollAnim = requestAnimationFrame(step);
      else scrollAnim = null;
    };
    scrollAnim = requestAnimationFrame(step);
  }

  /* Cancela a animação se a pessoa rolar por conta própria */
  ['wheel', 'touchstart', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, () => {
      if (scrollAnim) { cancelAnimationFrame(scrollAnim); scrollAnim = null; }
    }, { passive: true });
  });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href');
    if (!id || id === '#') return;

    /* Âncoras ainda sem destino (ex.: #cadastro) não devem dar salto */
    const target = document.getElementById(id.slice(1));
    if (!target) { e.preventDefault(); return; }

    e.preventDefault();
    closeDrawer();
    const top = target.getBoundingClientRect().top + window.scrollY - headerOffset();
    smoothScrollTo(top);
    history.replaceState(null, '', id);
  });

  /* ======================================================== 3. HEADER */
  const burger  = $('.burger');
  const drawer  = $('#drawer');
  let drawerOpen = false;

  function openDrawer() {
    if (!drawer || drawerOpen) return;
    drawerOpen = true;
    drawer.hidden = false;
    /* força o reflow para a animação de entrada sempre rodar */
    void drawer.offsetHeight;
    drawer.classList.add('is-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Fechar menu');
  }

  function closeDrawer() {
    if (!drawer || !drawerOpen) return;
    drawerOpen = false;
    drawer.classList.remove('is-open');
    drawer.hidden = true;
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Abrir menu');
  }

  if (burger && drawer) {
    $$('.drawer__link', drawer).forEach((el, i) => el.style.setProperty('--i', i));
    $('.drawer__cta', drawer)?.style.setProperty('--i', $$('.drawer__link', drawer).length);

    burger.addEventListener('click', () => (drawerOpen ? closeDrawer() : openDrawer()));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
    document.addEventListener('click', (e) => {
      if (drawerOpen && !e.target.closest('.header')) closeDrawer();
    });
    window.addEventListener('resize', () => { if (window.innerWidth > 1140) closeDrawer(); });
  }

  /* Estado "grudado" do header */
  if (headerEl) {
    scrollTasks.push((y) => headerEl.classList.toggle('is-stuck', y > 40));
  }

  /* Scroll-spy: destaca a sessão atual no menu */
  const navLinks = $$('.nav__link, .drawer__link');
  const sections = navLinks
    .map((a) => document.getElementById(a.getAttribute('href').slice(1)))
    .filter((el, i, arr) => el && arr.indexOf(el) === i);

  if (sections.length) {
    const setActive = (id) => {
      navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + id));
    };
    const spy = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((en) => en.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, .1, .5, 1] });
    sections.forEach((s) => spy.observe(s));
  }

  /* ======================================================== 4. REVEAL */
  const noReveal = reduceMotion.matches || !('IntersectionObserver' in window);

  const revealIO = noReveal ? null : new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const delay = Number(el.dataset.revealDelay || 0);
      el.style.transitionDelay = delay + 'ms';
      el.classList.add('is-in');
      obs.unobserve(el);
      /* Quando a entrada termina o elemento volta a ser só ele mesmo.
         Enquanto o [data-reveal] existe, a transição da entrada (opacity +
         transform) vence a do próprio componente, e depois de pronto ela
         era zerada — então o hover de cards de prêmio, accordions, CTAs e
         itens da faixa passava a dar um estalo em vez de animar. Soltar o
         atributo devolve a cada um a sua transição e libera o will-change
         para os loops de respiro. As camadas do KV (data-depth) seguem
         controlando o próprio transform e ficam de fora.                  */
      setTimeout(() => {
        el.style.transitionDelay = '';
        if (!el.hasAttribute('data-depth')) {
          el.classList.add('is-done');
          el.removeAttribute('data-reveal');
        }
      }, delay + 900);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: .12 });

  /* Serve tanto para o HTML inicial quanto para o que o JS cria depois */
  function observeReveals(root = document) {
    const els = $$('[data-reveal]', root);
    if (noReveal) { els.forEach((el) => el.classList.add('is-in', 'is-done')); return; }
    els.forEach((el) => { if (!el.classList.contains('is-in')) revealIO.observe(el); });
  }

  observeReveals();

  /* ======================================================== 5. PARALLAX */
  const parallaxEls = $$('[data-parallax]');

  if (parallaxEls.length && !reduceMotion.matches) {
    const items = parallaxEls.map((el) => ({ el, speed: parseFloat(el.dataset.parallax) || 0 }));

    scrollTasks.push(() => {
      const vh = window.innerHeight;
      for (const item of items) {
        const rect = item.el.getBoundingClientRect();
        if (rect.bottom < -300 || rect.top > vh + 300) continue;
        /* distância do centro do elemento ao centro da tela */
        const centerDelta = (rect.top + rect.height / 2) - vh / 2;
        item.el.style.setProperty('--pty', (centerDelta * item.speed).toFixed(2) + 'px');
      }
    });
    requestScrollFrame();
  }

  /* KV: camadas seguem o ponteiro com profundidades diferentes */
  const kv = $('[data-kv]');
  if (kv && canHover.matches && !reduceMotion.matches) {
    const layers = $$('[data-depth], .kv__pattern, .kv__card', kv).map((el) => ({
      el,
      depth: Number(el.dataset.depth || (el.classList.contains('kv__pattern') ? 6 : 8)),
    }));

    let tx = 0, ty = 0, cx = 0, cy = 0, raf = null, active = false;

    const render = () => {
      cx = lerp(cx, tx, .12);
      cy = lerp(cy, ty, .12);
      for (const l of layers) {
        l.el.style.setProperty('--mx', (cx * l.depth).toFixed(2) + 'px');
        l.el.style.setProperty('--my', (cy * l.depth).toFixed(2) + 'px');
      }
      if (Math.abs(cx - tx) > .001 || Math.abs(cy - ty) > .001) {
        raf = requestAnimationFrame(render);
      } else {
        raf = null;
      }
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(render); };

    kv.addEventListener('pointermove', (e) => {
      if (!isDesktopKV.matches) return;
      const r = kv.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - .5) * 2;   /* -1 .. 1 */
      ty = ((e.clientY - r.top) / r.height - .5) * 2;
      active = true;
      kick();
    }, { passive: true });

    kv.addEventListener('pointerleave', () => {
      if (!active) return;
      tx = 0; ty = 0;
      kick();
    });
  }

  /* ======================================================== 6. ACCORDION */
  const acRoot = $('[data-accordion]');
  if (acRoot) {
    acRoot.addEventListener('click', (e) => {
      const btn = e.target.closest('.ac__btn');
      if (!btn) return;
      const item = btn.closest('.ac');
      const willOpen = !item.classList.contains('is-open');

      /* Um aberto por vez na seção inteira: abrir um fecha o anterior */
      $$('.ac.is-open', acRoot).forEach((other) => {
        if (other === item) return;
        other.classList.remove('is-open');
        $('.ac__btn', other)?.setAttribute('aria-expanded', 'false');
      });

      item.classList.toggle('is-open', willOpen);
      btn.setAttribute('aria-expanded', String(willOpen));
    });
  }

  /* ======================================================== 7. GANHADORES
     Substitua WINNERS pelos dados reais (ou por um fetch da API).
     Formato: { nome, cpf, premio, data }                                  */
  const WINNERS = {
    sorteios: Array.from({ length: 12 }, () => ({
      nome: 'Nome Do Ganhador',
      cpf: '###.###.###-##',
      premio: 'Lorem ipsum dolor sit amet',
      data: 'DD/MM/AAAA',
    })),
    roleta: Array.from({ length: 9 }, () => ({
      nome: 'Nome Do Ganhador',
      cpf: '###.###.###-##',
      premio: 'Lorem ipsum dolor sit amet',
      data: 'DD/MM/AAAA',
    })),
  };

  const winRow = (w, i) => `
    <li class="win__row" style="--i:${i}">
      <img class="win__avatar" src="assets/svg/avatar-ellipse.svg" alt="" width="44" height="44" loading="lazy">
      <div class="win__who">
        <p class="win__name">${escapeHTML(w.nome)}</p>
        <p class="win__cpf">CPF: ${escapeHTML(w.cpf)}</p>
      </div>
      <p class="win__prize">Prêmio: ${escapeHTML(w.premio)}</p>
      <p class="win__date">${escapeHTML(w.data)}</p>
    </li>`;

  const winLists  = $$('[data-win-list]');
  const winEmpty  = $('[data-win-empty]');
  const winSearch = $('[data-win-search]');
  const winScroll = $('[data-win-scroll]');
  const winThumb  = $('[data-win-thumb]');
  const tabs      = $$('.tab');

  let currentTab = 'sorteios';

  function renderWinners(animate = false) {
    const term = normalize(winSearch ? winSearch.value.trim() : '');
    let total = 0;

    winLists.forEach((list) => {
      const key = list.dataset.winList;
      const isCurrent = key === currentTab;
      list.hidden = !isCurrent;
      if (!isCurrent) return;

      const rows = (WINNERS[key] || []).filter((w) => {
        if (!term) return true;
        return normalize(`${w.nome} ${w.cpf} ${w.premio} ${w.data}`).includes(term);
      });
      total = rows.length;
      list.innerHTML = rows.map(winRow).join('');

      if (animate && !reduceMotion.matches) {
        list.classList.remove('is-switching');
        void list.offsetHeight;
        list.classList.add('is-switching');
      }
    });

    if (winEmpty) winEmpty.hidden = total > 0;
    updateThumb();
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.classList.contains('is-active')) return;
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      currentTab = tab.id === 'tab-roleta' ? 'roleta' : 'sorteios';
      if (winScroll) winScroll.scrollTop = 0;
      renderWinners(true);
    });
  });

  /* navegação por teclado nas abas */
  $('.tabs')?.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = tabs.findIndex((t) => t.classList.contains('is-active'));
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    next.focus();
    next.click();
  });

  if (winSearch) {
    let t = null;
    winSearch.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => renderWinners(false), 120);
    });
  }

  /* Barra de rolagem customizada (o desenho do Figma tem a barra externa) */
  function updateThumb() {
    if (!winScroll || !winThumb) return;
    const track = winScroll.parentElement.querySelector('.win__bar');
    if (!track) return;

    const trackH = track.clientHeight;
    const ratio  = winScroll.clientHeight / winScroll.scrollHeight;

    if (ratio >= 1) { winThumb.style.opacity = '0'; return; }
    winThumb.style.opacity = '1';

    const thumbH = Math.max(40, Math.round(trackH * ratio));
    const maxTop = trackH - thumbH;
    const progress = winScroll.scrollTop / (winScroll.scrollHeight - winScroll.clientHeight || 1);

    winThumb.style.height = thumbH + 'px';
    winThumb.style.transform = `translateY(${Math.round(progress * maxTop)}px)`;
  }

  if (winScroll && winThumb) {
    winScroll.addEventListener('scroll', () => requestAnimationFrame(updateThumb), { passive: true });
    window.addEventListener('resize', updateThumb, { passive: true });

    /* arrastar o polegar */
    const track = winScroll.parentElement.querySelector('.win__bar');
    let dragging = false;
    const moveTo = (clientY) => {
      const r = track.getBoundingClientRect();
      const thumbH = winThumb.offsetHeight;
      const pos = clamp(clientY - r.top - thumbH / 2, 0, r.height - thumbH);
      const p = pos / (r.height - thumbH || 1);
      winScroll.scrollTop = p * (winScroll.scrollHeight - winScroll.clientHeight);
    };
    track?.addEventListener('pointerdown', (e) => {
      dragging = true;
      track.setPointerCapture(e.pointerId);
      moveTo(e.clientY);
    });
    track?.addEventListener('pointermove', (e) => { if (dragging) moveTo(e.clientY); });
    track?.addEventListener('pointerup', () => { dragging = false; });
    track?.addEventListener('pointercancel', () => { dragging = false; });
  }

  if (winLists.length) renderWinners(false);

  /* ======================================================== 8. PROGRESSO / TOPO */
  const progress = $('[data-progress]');
  const toTop = $('[data-to-top]');

  scrollTasks.push((y) => {
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;
    }
    if (toTop) toTop.hidden = y < window.innerHeight * 0.8;
  });

  toTop?.addEventListener('click', () => smoothScrollTo(0));

  requestScrollFrame();
})();
