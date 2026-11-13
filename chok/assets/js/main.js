/* =============================================================================
   Promoção Viagem dos Sonhos — interações
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
  const view = { w: 0, vw: 0, h: 0, u: 1, amp: 1, hh: 75, maxY: 0, mode: 'desk' };

  // Mesma fórmula do CSS (--u): 1px de design em px reais para o modo atual
  function calcMode(vw, w) {
    if (vw >= 1280) return { mode: 'desk', u: clamp(w / 1600, 0.8, 1), amp: 1, hh: 75 };
    if (vw >= 960) return { mode: 'mid', u: clamp(w / 1080, 0.889, 1.185), amp: 1, hh: 106 };
    if (vw >= 600) return { mode: 'tab', u: clamp(w / 768, 0.78, 1.25), amp: 0.82, hh: 106 };
    return { mode: 'mob', u: clamp(w / 360, 0.889, 1.35), amp: 0.5, hh: 49 };
  }

  // Posição no documento sem transforms (reveal e parallax não interferem nas medidas)
  function docTop(el) {
    let y = 0;
    while (el) { y += el.offsetTop; el = el.offsetParent; }
    return y;
  }
  function docLeft(el) {
    let x = 0;
    while (el) { x += el.offsetLeft; el = el.offsetParent; }
    return x;
  }

  const sections = $$('[data-section]');
  const secTop = new Map();
  const footer = $('.ftr');
  const zone = $('[data-tilt-zone]');
  const zr = { l: 0, t: 0, w: 0, h: 0 };

  function measure() {
    view.w = doc.clientWidth;
    if (doc.style.getPropertyValue('--vw') !== view.w + 'px') doc.style.setProperty('--vw', view.w + 'px');
    view.vw = window.innerWidth;
    view.h = window.innerHeight;
    Object.assign(view, calcMode(view.vw, view.w));
    view.maxY = Math.max(0, docTop(footer) + footer.offsetHeight - view.h);
    sections.forEach((sec) => secTop.set(sec, docTop(sec)));
    if (zone) { zr.l = docLeft(zone); zr.t = docTop(zone); zr.w = zone.offsetWidth; zr.h = zone.offsetHeight; }
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
       "rolagem suave" ligada, Safari) e o JS não interfere. Trackpads e toque
       nunca são interceptados (já têm inércia).
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

    // "instant": a versão de produção tem html { scroll-behavior: smooth } no core
    function jump(y) {
      try { window.scrollTo({ top: y, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, y); }
    }

    const easeInOut = (p) => (p < 0.5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2);

    function write(y) {
      lastWritten = y;
      jump(y);
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
    };
  })();

  /* ---------------------------------------------------------------------------
     Menu fixo (sombra fora do topo) · botão "voltar ao topo"
     ------------------------------------------------------------------------ */
  const hdr = $('[data-hdr]');
  const totop = $('[data-totop]');
  let menuOpen = false;

  function updateHdr() {
    const y = window.scrollY;
    hdr.classList.toggle('is-scrolled', y > 8);
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
    scroller.to(docTop(el) - view.hh * view.u, opts);
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
    if (menuOpen) { closeMenu(false); setTimeout(go, reduce ? 0 : 220); } else go();
  });

  if (totop) totop.addEventListener('click', () => {
    scroller.to(0, { onEnd: () => $('.hdr__logo').focus({ preventScroll: true }) });
  });

  /* ---------------------------------------------------------------------------
     Revelação ao rolar (uma vez). Ao terminar, o data-reveal sai do elemento:
     as transições dele (hover, cor) voltam a valer sem disputar com o reveal.
     ------------------------------------------------------------------------ */
  const revealEls = $$('[data-reveal]');
  const popEls = $$('[data-pop]');
  function revealDone(el) {
    el.classList.add('is-in');
    const rd = parseFloat(el.style.getPropertyValue('--rd')) || 0;
    setTimeout(() => el.removeAttribute('data-reveal'), reduce ? 50 : rd + 1100);
  }
  function popDone(el) {
    el.classList.add('is-in');
    setTimeout(() => el.classList.add('is-done'), reduce ? 50 : el.children.length * 35 + 900);
  }
  if (reduce || !('IntersectionObserver' in window)) {
    revealEls.forEach(revealDone);
    popEls.forEach(popDone);
  } else {
    const ro = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        ro.unobserve(en.target);
        if (en.target.hasAttribute('data-pop')) popDone(en.target); else revealDone(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach((el) => ro.observe(el));
    popEls.forEach((el) => ro.observe(el));
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
     Card do KV: tilt 3D pelo ponteiro (só quando o mouse está perto do card)
     + parallax interno — castelo ao fundo, família à frente.
     No touch, o mesmo efeito acompanha a rolagem (bem mais contido).
     ------------------------------------------------------------------------ */
  const tilt = $('[data-tilt]');
  const tLayers = $$('[data-tilt-depth]').map((el) => ({ el, d: parseFloat(el.dataset.tiltDepth) || 0, last: '' }));
  const sheen = $('.tilt__sheen');
  const T = { tx: 0, ty: 0, tp: 0, sx: 0, sy: 0, sp: 0, cx: 0, cy: 0, cp: 0, last: '', lastS: '' };
  const ptr = { x: -1e5, y: -1e5, in: false };

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || reduce) return;
    ptr.x = e.clientX;
    ptr.y = e.clientY;
    ptr.in = true;
    ticker.wake();
  }, { passive: true });
  document.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget) { ptr.in = false; ticker.wake(); }
  });
  window.addEventListener('scroll', () => ticker.wake(), { passive: true });

  function setT(o, str) {
    if (o.last !== str) { o.el.style.transform = str; o.last = str; }
  }

  function tiltTarget() {
    if (!zr.w) { T.tx = T.ty = T.tp = 0; return; }
    const sy = window.scrollY;
    const top = zr.t - sy;
    if (fine) {
      if (!ptr.in) { T.tx = T.ty = T.tp = 0; return; }
      const cx = zr.l + zr.w / 2;
      const cy = top + zr.h / 2;
      const ex = Math.max(zr.l - ptr.x, 0, ptr.x - (zr.l + zr.w));
      const ey = Math.max(top - ptr.y, 0, ptr.y - (top + zr.h));
      const R = 240 * view.u; // raio de "proximidade" fora do card
      const d = Math.hypot(ex, ey);
      const prox = d >= R ? 0 : 1 - (d / R) * (d / R) * (3 - 2 * d / R); // smoothstep invertido
      T.tx = clamp((ptr.x - cx) / (zr.w / 2), -1, 1) * prox;
      T.ty = clamp((ptr.y - cy) / (zr.h / 2), -1, 1) * prox;
      T.tp = prox;
    } else {
      // touch: o card "olha" levemente para o centro da tela conforme rola
      const c = top + zr.h / 2 - view.h / 2;
      T.tx = 0;
      T.ty = clamp(c / view.h, -1, 1) * 0.9;
      T.tp = 0;
    }
  }

  function tiltTick(dt) {
    if (reduce || !tilt || !liveSet.has(tilt)) return false;
    tiltTarget();
    const f = dt / 16.667;
    // 1º estágio: alvo suavizado · 2º estágio: posição exibida
    const k1 = 1 - Math.pow(1 - 0.14, f);
    const k2 = 1 - Math.pow(1 - 0.075, f);
    T.sx += (T.tx - T.sx) * k1; T.sy += (T.ty - T.sy) * k1; T.sp += (T.tp - T.sp) * k1;
    T.cx += (T.sx - T.cx) * k2; T.cy += (T.sy - T.cy) * k2; T.cp += (T.sp - T.cp) * k2;

    const amp = view.amp;
    const u = view.u;
    const rx = -T.cy * 5 * amp;   // graus
    const ry = T.cx * 7 * amp;
    const str = `rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg) rotate(0.02deg)`;
    if (T.last !== str) { tilt.style.transform = str; T.last = str; }

    for (let i = 0; i < tLayers.length; i++) {
      const L = tLayers[i];
      // castelo vai contra o ponteiro, família vai a favor: sensação de profundidade
      const dir = L.d > 15 ? 1 : -1;
      const x = dir * T.cx * L.d * amp * u;
      const y = dir * T.cy * L.d * 0.7 * amp * u;
      setT(L, `translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0) rotate(0.02deg)`);
    }
    if (sheen) {
      const s = `translate3d(${(T.cx * 22).toFixed(3)}%, ${(T.cy * 22).toFixed(3)}%, 0) rotate(0.02deg)`;
      if (T.lastS !== s) { sheen.style.transform = s; T.lastS = s; }
      sheen.style.opacity = (T.cp * 0.9).toFixed(3);
    }

    const settled =
      Math.abs(T.tx - T.cx) < 0.0005 && Math.abs(T.ty - T.cy) < 0.0005 && Math.abs(T.tp - T.cp) < 0.0005 &&
      Math.abs(T.sx - T.cx) < 0.0005 && Math.abs(T.sy - T.cy) < 0.0005;
    return !settled;
  }
  ticker.add(tiltTick);

  function resetScene() {
    if (tilt) tilt.style.transform = '';
    tLayers.forEach((o) => { o.el.style.transform = ''; o.last = ''; });
    if (sheen) { sheen.style.transform = ''; sheen.style.opacity = ''; }
    T.last = T.lastS = '';
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
        const key = el.parentNode;
        const list = focusGroups.get(key) || [];
        const i = list.indexOf(el);
        if (i > -1) list.splice(i, 1);
        if (en.isIntersecting) list.push(el);
        focusGroups.set(key, list);
        const active = list[list.length - 1];
        if (el !== active) el.classList.remove('is-focus');
        list.forEach((it) => it.classList.toggle('is-focus', it === active));
      });
    }, { rootMargin: '-38% 0px -38% 0px' });
    $$('[data-focus]').forEach((el) => focusIO.observe(el));
  }

  /* ---------------------------------------------------------------------------
     Accordions (Dúvidas e Ganhadores): um aberto por vez em cada grupo
     - abrir e fechar animam juntos, cada um direto à sua altura final: a seção
       não "encolhe e cresce" — vai direto ao tamanho com a nova resposta aberta
     - se o item que fecha já saiu da tela por cima, ele fecha sem animação e a
       rolagem é compensada no mesmo frame: a pergunta clicada não sai do lugar
     ------------------------------------------------------------------------ */
  $$('[data-acc]').forEach((root) => {
    // itens consultados a cada clique: na produção as listas são renderizadas pelo Vue/API
    const items = () => $$('.acc__item', root);
    const setOpen = (item, open) => {
      item.classList.toggle('is-open', open);
      $('.acc__btn', item).setAttribute('aria-expanded', String(open));
    };
    items().forEach((it) => setOpen(it, it.classList.contains('is-open')));

    let t = 0;
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('.acc__btn');
      if (!btn) return;
      const item = btn.closest('.acc__item');
      const open = !item.classList.contains('is-open');
      const ib = item.getBoundingClientRect();
      const topLimit = view.hh * view.u;
      let shift = 0;
      items().forEach((it) => {
        if (it === item || !it.classList.contains('is-open')) return;
        const r = it.getBoundingClientRect();
        const above = r.top < ib.top;
        if (above && (reduce || r.bottom <= topLimit + 40)) {
          it.classList.add('is-instant');
          setOpen(it, false);
          shift += it.getBoundingClientRect().height - r.height;
          void it.offsetWidth;
          it.classList.remove('is-instant');
        } else {
          setOpen(it, false);
        }
      });
      if (shift) { scroller.cancel(); try { window.scrollBy({ top: shift, behavior: 'instant' }); } catch (err) { window.scrollBy(0, shift); } }
      setOpen(item, open);
      clearTimeout(t);
      t = setTimeout(measure, 700);
    });
  });

  /* ---------------------------------------------------------------------------
     "R$1.000" conta de 0 até 1.000 quando o card aparece (uma vez)
     ------------------------------------------------------------------------ */
  (() => {
    const el = $('[data-count]');
    if (!el || reduce || !('IntersectionObserver' in window)) return;
    const end = parseInt(el.dataset.count, 10) || 0;
    const fmt = (n) => 'R$' + n.toLocaleString('pt-BR');
    let start = 0;
    let running = false;
    el.textContent = fmt(0);
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((en) => en.isIntersecting)) return;
      io.disconnect();
      setTimeout(() => { start = performance.now(); running = true; ticker.wake(); }, 350);
    }, { threshold: 0.5 });
    io.observe(el);
    ticker.add((dt, t) => {
      if (!running) return false;
      const p = clamp((t - start) / 1500, 0, 1);
      const e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(Math.round(end * e / 10) * 10);
      if (p >= 1) { el.textContent = fmt(end); running = false; return false; }
      return true;
    });
  })();

  /* ---------------------------------------------------------------------------
     Calendário: marca sorteios já realizados e o próximo (pela data de hoje)
     ------------------------------------------------------------------------ */
  (() => {
    const chips = $$('[data-cal] .chip');
    if (!chips.length) return;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    let next = null;
    chips.forEach((c) => {
      const [y, m, d] = c.dataset.date.split('-').map(Number);
      const t = new Date(y, m - 1, d).getTime();
      if (t < today) c.classList.add('is-past');
      else if (!next) next = c;
    });
    if (next) {
      next.classList.add('is-next');
      const sr = document.createElement('span');
      sr.className = 'sr';
      sr.textContent = ' (próximo sorteio)';
      next.appendChild(sr);
    }
  })();

  /* ---------------------------------------------------------------------------
     Logo do menu: letras separadas para a "onda" do hover
     ------------------------------------------------------------------------ */
  (() => {
    let k = 0;
    $$('.logo__a, .logo__b').forEach((part) => {
      const txt = part.textContent;
      part.textContent = '';
      for (const ch of txt) {
        const s = document.createElement('span');
        s.className = 'logo__ch';
        s.style.setProperty('--k', k++);
        s.textContent = ch;
        part.appendChild(s);
      }
    });
  })();

  /* ---------------------------------------------------------------------------
     Menu mobile
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
    setTimeout(() => doc.classList.add('is-settled'), reduce ? 0 : 2200);
  }
  if (reduce) ready();
  else {
    const imgs = $$('.kv img');
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
      if (menuOpen && window.innerWidth >= 600) closeMenu(false);
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
    if (reduce) {
      resetScene();
      revealEls.forEach((el) => { if (el.isConnected) revealDone(el); });
      popEls.forEach(popDone);
      ready();
    }
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
