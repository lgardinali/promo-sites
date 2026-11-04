/* =============================================================================
   Cerâmicas Colecionáveis Frescatto — interações
   JS nativo, zero dependências.

   Diretrizes de fluidez aplicadas:
   - Camada GPU ligada pela visibilidade (.is-live via IntersectionObserver), nunca pelo movimento.
   - translate3d + rotate(0.02deg) (exceto blocos de texto), posições com subpixel (.toFixed(3)).
   - Suavização do ponteiro em dois estágios, normalizada pelo tempo do frame.
   - Um único requestAnimationFrame para a cena; leituras de layout só em resize/load/interação.
   - Transition para estados (hover/reveal/foco), rAF para movimento contínuo —
     nunca no mesmo elemento e na mesma propriedade.
   - O loop para quando tudo assenta (< 0.0005), sem desligar a camada GPU.
   - prefers-reduced-motion: loops desligados e tudo na posição final.
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
  const view = { w: 0, vw: 0, h: 0, u: 1, amp: 1, hh: 96, maxY: 0, mode: 'desk' };

  // Mesma fórmula do CSS (--u): 1px de design em px reais para o modo atual
  function calcMode(vw, w) {
    if (vw >= 1024) return { mode: 'desk', u: clamp(w / 1640, 0.62, 1), amp: 1, hh: 96 };
    if (vw >= 640) return { mode: 'tab', u: clamp(w / 768, 0.833, 1.34), amp: 0.82, hh: 64 };
    return { mode: 'mob', u: clamp(w / 375, 0.853, 1.36), amp: 0.5, hh: 64 };
  }

  // Posição no documento sem transforms (reveal e parallax não interferem nas medidas)
  function docTop(el) {
    let y = 0;
    while (el) { y += el.offsetTop; el = el.offsetParent; }
    return y;
  }

  const sections = $$('[data-section]');
  const secTop = new Map();
  const footer = $('.ftr');
  const ambSec = $('.amb');
  const ambs = $$('.amb__it').map((it) => ({ it, el: $('.amb__par', it), top: 0, h: 0, last: '' }));

  function measure() {
    view.w = doc.clientWidth;
    // largura útil sem a barra de rolagem: no <head> a barra ainda pode não existir
    if (doc.style.getPropertyValue('--vw') !== view.w + 'px') doc.style.setProperty('--vw', view.w + 'px');
    view.vw = window.innerWidth;
    view.h = window.innerHeight;
    Object.assign(view, calcMode(view.vw, view.w));
    view.maxY = Math.max(0, docTop(footer) + footer.offsetHeight - view.h);
    sections.forEach((sec) => secTop.set(sec, docTop(sec)));
    ambs.forEach((a) => { a.top = docTop(a.it); a.h = a.it.offsetHeight; });
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
     Menu fixo: compacto fora do topo · botão "voltar ao topo"
     ------------------------------------------------------------------------ */
  const hdr = $('[data-hdr]');
  const totop = $('[data-totop]');
  let menuOpen = false;

  function updateHdr() {
    const y = window.scrollY;
    hdr.classList.toggle('is-compact', y > 40);
    if (totop) totop.classList.toggle('is-on', y > view.h * 1.2);
  }

  /* ---------------------------------------------------------------------------
     Link ativo no menu (pela posição medida das seções)
     ------------------------------------------------------------------------ */
  const navLinks = $$('[data-nav]');
  let activeId = '';
  function updateSpy() {
    const probeY = window.scrollY + view.h * 0.42;
    let id = 'home';
    let best = -1;
    sections.forEach((sec) => {
      const t = secTop.get(sec);
      if (t !== undefined && t <= probeY && t >= best) { best = t; id = sec.id; }
    });
    if (id === activeId) return;
    activeId = id;
    navLinks.forEach((l) => {
      if (l.getAttribute('href') === '#' + id) l.setAttribute('aria-current', 'true');
      else l.removeAttribute('aria-current');
    });
  }

  window.addEventListener('scroll', () => { updateHdr(); updateSpy(); }, { passive: true });

  /* ---------------------------------------------------------------------------
     Navegação por âncoras
     ------------------------------------------------------------------------ */
  function scrollToId(id, opts) {
    const el = id === 'home' || !id ? null : document.getElementById(id);
    if (!el) { scroller.to(0, opts); return; }
    const mt = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    scroller.to(docTop(el) - mt, opts);
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
    if (menuOpen) { closeMenu(false); setTimeout(go, reduce ? 0 : 280); } else go();
  });

  if (totop) totop.addEventListener('click', () => {
    scroller.to(0, { onEnd: () => $('.hdr__logo').focus({ preventScroll: true }) });
  });

  /* ---------------------------------------------------------------------------
     Revelação ao rolar (uma vez). Ao terminar, o data-reveal sai do elemento:
     as transições dele (hover, cor) voltam a valer sem disputar com o reveal.
     ------------------------------------------------------------------------ */
  const revealEls = $$('[data-reveal]');
  function revealDone(el) {
    el.classList.add('is-in');
    const rd = parseFloat(el.style.getPropertyValue('--rd')) || 0;
    setTimeout(() => el.removeAttribute('data-reveal'), reduce ? 50 : rd + 1700);
  }
  if (reduce || !('IntersectionObserver' in window)) {
    revealEls.forEach(revealDone);
  } else {
    const ro = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        ro.unobserve(en.target);
        revealDone(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
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
  $$('[data-live]').forEach((el) => lo.observe(el));

  /* ---------------------------------------------------------------------------
     Cena: profundidade pelo ponteiro (dois estágios) nas composições do KV e da
     coleção + parallax das fotos de ambiente dentro do quadro — mesmo frame
     ------------------------------------------------------------------------ */
  const ptr = { tx: 0, ty: 0, sx: 0, sy: 0, cx: 0, cy: 0 };
  let sScroll = window.scrollY;

  const depths = $$('[data-depth]').map((el) => ({ el, d: parseFloat(el.dataset.depth) || 0, last: '' }));

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

    // Composições: a imagem "respira" contra o ponteiro (no máximo data-depth px de design)
    for (let i = 0; i < depths.length; i++) {
      const D = depths[i];
      if (!liveSet.has(D.el)) continue;
      const x = -ptr.cx * D.d * amp * u;
      const yy = -ptr.cy * D.d * 0.6 * amp * u;
      setT(D, `translate3d(${x.toFixed(3)}px, ${yy.toFixed(3)}px, 0) rotate(0.02deg)`);
    }

    // Fotos de ambiente: a imagem corre ±7% da altura dentro do quadro (sobra de 7% em cima e embaixo)
    if (ambSec && liveSet.has(ambSec)) {
      const vh = view.h;
      for (let i = 0; i < ambs.length; i++) {
        const A = ambs[i];
        if (!A.h) continue;
        const c = A.top + A.h / 2 - sScroll - vh / 2;
        const p = clamp(c / ((vh + A.h) / 2), -1, 1);
        const off = -p * A.h * 0.07 * (0.55 + 0.45 * amp);
        setT(A, `translate3d(0, ${off.toFixed(3)}px, 0) rotate(0.02deg)`);
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
    depths.concat(ambs).forEach((o) => { o.el.style.transform = ''; o.last = ''; });
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
        const key = el.closest('.atelie, .steps, .amb') || el;
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
     Dúvidas frequentes (accordion, uma resposta aberta por vez)
     - abrir e fechar animam juntos, direto à altura final (grid-template-rows)
     - se a resposta que fecha já saiu da tela por cima, ela fecha sem animação e a
       rolagem é compensada no mesmo frame: a pergunta clicada não sai do lugar
     ------------------------------------------------------------------------ */
  (() => {
    const root = $('[data-faq]');
    if (!root) return;
    const items = $$('.faq__item', root);
    const setOpen = (item, open) => {
      item.classList.toggle('is-open', open);
      $('.faq__btn', item).setAttribute('aria-expanded', String(open));
      const panel = $('.faq__a', item);
      if (open) panel.removeAttribute('inert'); else panel.setAttribute('inert', '');
    };
    items.forEach((it) => setOpen(it, it.classList.contains('is-open')));

    let t = 0;
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('.faq__btn');
      if (!btn) return;
      const item = btn.closest('.faq__item');
      const open = !item.classList.contains('is-open');
      const ib = item.getBoundingClientRect();
      const topLimit = view.hh * view.u;
      let shift = 0;
      items.forEach((it) => {
        if (it === item || !it.classList.contains('is-open')) return;
        const r = it.getBoundingClientRect();
        const above = r.top < ib.top;
        if (above && (reduce || r.bottom <= topLimit)) {
          it.classList.add('is-instant');
          setOpen(it, false);
          shift += it.getBoundingClientRect().height - r.height;
          void it.offsetWidth;
          it.classList.remove('is-instant');
        } else {
          setOpen(it, false);
        }
      });
      if (shift) { scroller.cancel(); window.scrollBy(0, shift); }
      setOpen(item, open);
      clearTimeout(t);
      t = setTimeout(measure, 700);
    });
  })();

  /* ---------------------------------------------------------------------------
     7 peças · 3 cores (carrossel)
     - uma peça por vez; setas trocam a peça e mantêm a cor; navegação em loop
     - a cor troca a foto e o nome; a descrição é da peça
     - avanço automático (para de vez quando a pessoa interage; pausa com o mouse
       em cima, fora da tela ou com a aba escondida)
     ------------------------------------------------------------------------ */
  (() => {
    const root = $('[data-car]');
    if (!root) return;

    const PIECES = [
      ['prato-ralador', 'Prato Ralador'],
      ['saleiro', 'Saleiro'],
      ['petisqueira', 'Petisqueira'],
      ['porta-guardanapo', 'Porta-Guardanapo'],
      ['azeiteiro', 'Azeiteiro'],
      ['prato-raso', 'Prato Raso'],
      ['molheira', 'Molheira'],
    ];
    const COLORS = [['oceano', 'Oceano'], ['coral', 'Coral'], ['areia', 'Areia']];
    // [largura m, altura m, largura g, altura g] de cada arquivo
    const DIMS = {
      'prato-ralador': { oceano: [600, 447, 1100, 820], coral: [600, 472, 1000, 787], areia: [600, 442, 1000, 737] },
      saleiro: { oceano: [414, 480, 759, 880], coral: [427, 480, 782, 880], areia: [430, 480, 788, 880] },
      petisqueira: { oceano: [600, 420, 1100, 770], coral: [600, 446, 1100, 817], areia: [600, 428, 1100, 784] },
      'porta-guardanapo': { oceano: [466, 480, 854, 880], coral: [482, 480, 884, 880], areia: [480, 480, 881, 880] },
      azeiteiro: { oceano: [206, 480, 378, 880], coral: [207, 480, 379, 880], areia: [194, 480, 356, 880] },
      'prato-raso': { oceano: [600, 378, 1100, 694], coral: [600, 384, 1100, 705], areia: [600, 388, 1100, 712] },
      molheira: { oceano: [485, 480, 890, 880], coral: [475, 480, 872, 880], areia: [485, 480, 890, 880] },
    };
    const AUTO = 5200;

    const floatEl = $('.car__float', root);
    const slide = $('.car__slide', root);
    const nameEl = $('.car__name', root);
    const pn = $('[data-car-piece]', root);
    const cn = $('[data-car-color]', root);
    const descs = $$('[data-desc]', root);
    const cores = $$('[data-cor]', root);
    const timer = $('.car__timer span', root);

    let pi = 2; // Petisqueira
    let ci = 0; // Oceano
    let cur = $('.car__img.is-on', root);

    // largura exibida de cada foto (object-fit: contain) em cada modo, para o srcset
    // escolher o arquivo certo: desktop 529 × 420 · tablet 520 × 380 · mobile 239 × 220 (px de design)
    const up = (n) => Math.ceil(n * 10) / 10;
    function sizesFor(r) {
      const d = Math.min(529, 420 * r);
      const t = Math.min(520, 380 * r);
      const m = Math.min(239, 220 * r);
      return `(min-width: 1024px) min(${Math.ceil(d)}px, ${up(d / 16.4)}vw), (min-width: 640px) ${up(t / 7.68)}vw, min(${up(m / 3.75)}vw, ${Math.ceil(m * 1.36)}px)`;
    }

    const cache = new Map();
    cache.set('petisqueira-oceano', cur);
    function getImg(p, c) {
      const key = p + '-' + c;
      let img = cache.get(key);
      if (img) return img;
      const [mw, mh, gw, gh] = DIMS[p][c];
      const base = `assets/img/peca-${p}-${c}`;
      img = new Image();
      img.className = 'car__img';
      img.decoding = 'async';
      img.draggable = false;
      img.alt = '';
      img.width = gw;
      img.height = gh;
      img.sizes = sizesFor(mw / mh);
      img.srcset = `${base}-m.webp ${mw}w, ${base}-g.webp ${gw}w`;
      img.src = `${base}-m.webp`;
      cache.set(key, img);
      return img;
    }
    function whenReady(img) {
      const dec = img.decode ? img.decode().catch(() => {}) : new Promise((r) => {
        if (img.complete) r(); else { img.onload = r; img.onerror = r; }
      });
      return Promise.race([dec, new Promise((r) => setTimeout(r, 1400))]);
    }
    function preload() {
      const n = PIECES.length;
      [[(pi + 1) % n, ci], [(pi - 1 + n) % n, ci], [pi, (ci + 1) % 3], [pi, (ci + 2) % 3]]
        .forEach(([p, c]) => getImg(PIECES[p][0], COLORS[c][0]));
    }

    // Troca das fotos: a nova entra pelo lado da navegação (ou dissolve no lugar, na troca de cor);
    // a anterior sai e é removida do DOM ao fim da transição
    function swapTo(img, dir) {
      if (img === cur) return;
      const prev = cur;
      const out = dir > 0 ? 'is-to-l' : dir < 0 ? 'is-to-r' : 'is-to-c';
      const inn = dir > 0 ? 'is-from-r' : dir < 0 ? 'is-from-l' : 'is-from-c';
      clearTimeout(img._rm);
      if (!img.isConnected) {
        img.className = 'car__img ' + (reduce ? '' : inn);
        floatEl.appendChild(img);
        void img.offsetWidth; // fixa o estado inicial antes da transição
        img.classList.remove(inn);
      } else {
        img.classList.remove('is-to-l', 'is-to-r', 'is-to-c');
        floatEl.appendChild(img); // volta para cima das outras
      }
      img.classList.add('is-on');
      img.alt = `${PIECES[pi][1]} ${COLORS[ci][1]}`;
      img.removeAttribute('aria-hidden');

      prev.classList.remove('is-on');
      prev.classList.add(out);
      prev.alt = '';
      prev.setAttribute('aria-hidden', 'true');
      clearTimeout(prev._rm);
      prev._rm = setTimeout(() => { prev.remove(); prev.classList.remove(out); }, reduce ? 0 : 950);
      cur = img;
    }

    let txtT = 0;
    let token = 0;
    function show(np, nc, dir) {
      const pieceChanged = np !== pi;
      const colorChanged = nc !== ci;
      if (!pieceChanged && !colorChanged) return;
      pi = np;
      ci = nc;
      const t = ++token;

      // nome: sai e volta com o texto novo (só a parte que mudou)
      if (pieceChanged) pn.classList.add('is-out');
      if (colorChanged) cn.classList.add('is-out');
      clearTimeout(txtT);
      txtT = setTimeout(() => {
        pn.textContent = PIECES[pi][1];
        cn.textContent = COLORS[ci][1];
        pn.classList.remove('is-out');
        cn.classList.remove('is-out');
      }, reduce ? 0 : 230);

      // descrição da peça (todas empilhadas na mesma célula: a altura não muda)
      if (pieceChanged) descs.forEach((d) => d.classList.toggle('is-on', d.dataset.desc === PIECES[pi][0]));

      // amostras de cor (rádio)
      cores.forEach((b, i) => {
        const on = i === ci;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      });

      const img = getImg(PIECES[pi][0], COLORS[ci][0]);
      whenReady(img).then(() => {
        if (t !== token) return;
        swapTo(img, colorChanged && !pieceChanged ? 0 : dir);
        preload();
      });
    }

    const step = (d) => show((pi + d + PIECES.length) % PIECES.length, ci, d);

    /* ---- avanço automático ---- */
    let autoOn = !reduce;
    let autoT = 0;
    let inView = false;
    let hover = false;
    root.style.setProperty('--auto', AUTO + 'ms');
    nameEl.setAttribute('aria-live', 'off'); // sem anúncios a cada avanço automático

    function schedule() {
      clearTimeout(autoT);
      root.classList.remove('is-run');
      if (!autoOn || !inView || hover || document.hidden) return;
      void timer.offsetWidth; // reinicia a barra
      root.classList.add('is-run');
      autoT = setTimeout(() => { step(1); schedule(); }, AUTO);
    }
    function stopAuto() {
      if (!autoOn) return;
      autoOn = false;
      clearTimeout(autoT);
      root.classList.remove('is-run');
      root.classList.add('is-manual');
      nameEl.setAttribute('aria-live', 'polite');
    }
    if (!autoOn) root.classList.add('is-manual');

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((en) => { inView = en.isIntersecting; });
        schedule();
      }, { threshold: 0.35 }).observe(slide);
    }
    document.addEventListener('visibilitychange', schedule);
    root.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hover = true; schedule(); } });
    root.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { hover = false; schedule(); } });

    /* ---- controles ---- */
    $('[data-car-prev]', root).addEventListener('click', () => { stopAuto(); step(-1); });
    $('[data-car-next]', root).addEventListener('click', () => { stopAuto(); step(1); });
    cores.forEach((b, i) => b.addEventListener('click', () => { stopAuto(); show(pi, i, 0); }));

    // rádio: setas/Home/End trocam a cor e levam o foco junto
    $('.car__cores', root).addEventListener('keydown', (e) => {
      const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      let n = null;
      if (e.key in keys) n = (ci + keys[e.key] + 3) % 3;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = 2;
      if (n === null) return;
      e.preventDefault();
      stopAuto();
      show(pi, n, 0);
      cores[n].focus();
    });
    // setas do teclado no palco trocam a peça
    $('.car__stage', root).addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      stopAuto();
      step(e.key === 'ArrowRight' ? 1 : -1);
    });

    // deslizar no touch (a rolagem vertical continua livre: touch-action: pan-y)
    let sw = null;
    slide.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      sw = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    slide.addEventListener('pointermove', (e) => {
      if (!sw || e.pointerId !== sw.id) return;
      const dx = e.clientX - sw.x;
      const dy = e.clientY - sw.y;
      if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) sw = null;
    }, { passive: true });
    slide.addEventListener('pointerup', (e) => {
      if (!sw || e.pointerId !== sw.id) return;
      const dx = e.clientX - sw.x;
      const dy = e.clientY - sw.y;
      sw = null;
      if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.2) { stopAuto(); step(dx < 0 ? 1 : -1); }
    });
    slide.addEventListener('pointercancel', () => { sw = null; });

    // pré-carrega as vizinhas quando a página estiver ociosa
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
    window.addEventListener('load', () => idle(preload));
  })();

  /* ---------------------------------------------------------------------------
     Menu mobile / tablet
     ------------------------------------------------------------------------ */
  const menu = $('[data-menu]');
  const burger = $('[data-menu-open]');
  const outside = [$('main'), footer, totop, $('.skip')];

  function focusables(box) {
    return $$('a[href], button:not([disabled]), [tabindex="0"]', box)
      .filter((el) => el.offsetParent !== null && !el.closest('[inert]'));
  }
  function trapTab(e) {
    const f = focusables(hdr).concat(focusables(menu));
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function openMenu() {
    if (menuOpen || !menu) return;
    menuOpen = true;
    menu.removeAttribute('inert');
    menu.classList.add('is-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Fechar menu');
    outside.forEach((el) => el && el.setAttribute('inert', ''));
    doc.classList.add('is-locked');
    scroller.lock(true);
    const first = $('.menu__link', menu);
    setTimeout(() => first && first.focus({ preventScroll: true }), 80);
  }
  function closeMenu(restoreFocus = true) {
    if (!menuOpen || !menu) return;
    menuOpen = false;
    menu.classList.remove('is-open');
    menu.setAttribute('inert', '');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Abrir menu');
    outside.forEach((el) => el && el.removeAttribute('inert'));
    doc.classList.remove('is-locked');
    scroller.lock(false);
    if (restoreFocus) burger.focus({ preventScroll: true });
  }
  if (menu && burger) {
    menu.setAttribute('inert', '');
    burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
  }

  document.addEventListener('keydown', (e) => {
    if (!menuOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
    if (e.key === 'Tab') trapTab(e);
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
    const imgs = $$('.kv__comp img, .kv__tex');
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
      updateHdr();
      updateSpy();
    });
  }
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('load', () => { measure(); updateSpy(); });
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(document.body);

  const onPref = () => {
    reduce = mqReduce.matches;
    fine = mqFine.matches;
    if (reduce) { resetScene(); revealEls.forEach((el) => { if (el.isConnected) revealDone(el); }); ready(); }
    setupTouchFocus();
    ticker.wake();
  };
  (mqReduce.addEventListener ? mqReduce.addEventListener('change', onPref) : mqReduce.addListener(onPref));
  (mqFine.addEventListener ? mqFine.addEventListener('change', onPref) : mqFine.addListener(onPref));

  measure();
  lastMode = view.mode;
  setupTouchFocus();
  updateHdr();
  updateSpy();
  if (location.hash && location.hash.length > 1) {
    const id = decodeURIComponent(location.hash.slice(1));
    if (document.getElementById(id)) setTimeout(() => scrollToId(id, { instant: true }), 0);
  }
})();
