(() => {
  'use strict';

  const doc = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const mqDesk = matchMedia('(min-width: 768px)');
  const mqGrid = matchMedia('(min-width: 1024px)');
  const mqFine = matchMedia('(hover: hover) and (pointer: fine)');
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const reduce = () => mqReduce.matches;
  const SITE = window.SITE || {};

  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Largura útil da viewport (sem scrollbar) ---------- */
  const setVw = () => {
    const w = doc.clientWidth || innerWidth;
    doc.style.setProperty('--vw', `${w}px`);
    doc.style.setProperty('--vwn', w);
  };
  setVw();
  new ResizeObserver(setVw).observe(doc);

  /* ---------- Links configuráveis ---------- */
  const links = SITE.links || {};
  $$('[data-link]').forEach((a) => {
    const url = links[a.dataset.link];
    if (url && url !== '#') {
      a.href = url;
    } else {
      a.addEventListener('click', (e) => e.preventDefault());
    }
  });

  /* =========================================================
     Scroll suave (inércia no mouse) + scroll animado para âncoras
     ========================================================= */
  const Scroller = (() => {
    const smoothWheel = mqFine.matches && !reduce();
    let target = scrollY;
    let current = scrollY;
    let raf = 0;
    let last = 0;
    let locked = false;
    let tween = null;
    const max = () => doc.scrollHeight - innerHeight;

    const canScrollInside = (start, dy) => {
      for (let el = start instanceof Element ? start : null; el && el !== document.body && el !== doc; el = el.parentElement) {
        if (el.scrollHeight <= el.clientHeight + 1) continue;
        const oy = getComputedStyle(el).overflowY;
        if (oy !== 'auto' && oy !== 'scroll') continue;
        if ((dy < 0 && el.scrollTop > 0) || (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1)) return true;
      }
      return false;
    };

    const loop = (now) => {
      const dt = Math.min(64, now - last || 16.7);
      last = now;
      if (tween) {
        const t = clamp((now - tween.t0) / tween.dur, 0, 1);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        current = tween.from + (tween.to - tween.from) * e;
        target = current;
        if (t >= 1) tween = null;
      } else {
        const f = 1 - Math.pow(0.9, dt / 16.7);
        current += (target - current) * f;
        if (Math.abs(target - current) < 0.4) current = target;
      }
      window.scrollTo(0, current);
      raf = tween || current !== target ? requestAnimationFrame(loop) : 0;
    };
    const start = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      tween = null;
      current = target = scrollY;
    };

    if (smoothWheel) {
      addEventListener('wheel', (e) => {
        if (locked || e.ctrlKey || e.defaultPrevented) return;
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        if (canScrollInside(e.target, e.deltaY)) return;
        e.preventDefault();
        const d = e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? innerHeight : 1);
        if (tween) tween = null;
        if (!raf) current = target = scrollY;
        target = clamp(target + d, 0, max());
        start();
      }, { passive: false });
    }
    addEventListener('scroll', () => { if (!raf) current = target = scrollY; }, { passive: true });
    ['touchstart', 'keydown', 'mousedown'].forEach((ev) => addEventListener(ev, () => { if (tween) stop(); }, { passive: true }));

    return {
      to(y) {
        y = clamp(Math.round(y), 0, max());
        if (reduce()) { window.scrollTo(0, y); return; }
        const from = scrollY;
        const dist = Math.abs(y - from);
        if (dist < 2) return;
        tween = { from, to: y, t0: performance.now(), dur: clamp(dist * 0.45, 650, 1500) };
        current = from;
        start();
      },
      lock(v) {
        locked = v;
        if (v) stop();
      },
    };
  })();

  /* ---------- Âncoras internas ---------- */
  const nav = $('.nav');
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    closeMenu();
    const y = id === 'inicio' || id === 'topo' ? 0 : el.getBoundingClientRect().top + scrollY;
    Scroller.to(y);
    if (id !== 'conteudo') history.replaceState(null, '', id === 'inicio' ? location.pathname + location.search : `#${id}`);
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  });

  /* =========================================================
     Menu: estado compacto, progresso, scrollspy, menu mobile
     ========================================================= */
  const hero = $('.hero');
  const toTop = $('.to-top');
  const prizes = $('.prizes');
  const plates = $$('.plate');
  let ticking = false;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };
  function update() {
    ticking = false;
    const y = scrollY;
    const maxY = doc.scrollHeight - innerHeight;
    const p = maxY > 0 ? clamp(y / maxY, 0, 1) : 0;
    nav.classList.toggle('is-compact', y > 40);
    nav.style.setProperty('--progress', p.toFixed(4));
    toTop.classList.toggle('is-visible', y > innerHeight * 0.8);
    toTop.style.setProperty('--ring', (100 - p * 100).toFixed(2));
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  update();

  const spyLinks = $$('[data-spy-link]');
  const spyIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const id = e.target.dataset.spy;
      spyLinks.forEach((a) => {
        const on = a.dataset.spyLink === id;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-50% 0px -50% 0px' });
  $$('[data-spy]').forEach((s) => spyIO.observe(s));

  const toggle = $('.nav__toggle');
  const mmenu = $('#menu-mobile');
  function openMenu() {
    mmenu.classList.add('is-open');
    mmenu.inert = false;
    mmenu.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Fechar menu');
    doc.classList.add('is-locked');
    Scroller.lock(true);
  }
  function closeMenu() {
    if (!mmenu.classList.contains('is-open')) return;
    mmenu.classList.remove('is-open');
    mmenu.inert = true;
    mmenu.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menu');
    if (!$('dialog[open]')) {
      doc.classList.remove('is-locked');
      Scroller.lock(false);
    }
  }
  toggle.addEventListener('click', () => (mmenu.classList.contains('is-open') ? closeMenu() : openMenu()));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mmenu.classList.contains('is-open')) {
      closeMenu();
      toggle.focus();
    }
  });
  mqGrid.addEventListener('change', closeMenu);

  /* =========================================================
     Títulos: divide em palavras para a revelação em máscara
     ========================================================= */
  $$('[data-split]').forEach((el) => {
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(' '));
              return;
            }
            const w = document.createElement('span');
            w.className = 'w';
            const wi = document.createElement('span');
            wi.className = 'wi';
            wi.textContent = part;
            wi.style.setProperty('--wi', i++);
            w.appendChild(wi);
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') {
          walk(n);
        }
      });
    };
    walk(el);
  });

  /* =========================================================
     Seções visíveis (pausa loops fora da tela)
     ========================================================= */
  const secIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      e.target.classList.toggle('is-inview', e.isIntersecting);
      if (e.target === prizes && !e.isIntersecting && tapSelected) {
        tapSelected = false;
        focusPrize(null);
      }
    });
  }, { rootMargin: '10% 0px' });
  $$('.section').forEach((s) => secIO.observe(s));

  /* =========================================================
     Revelação no scroll + contadores (após carregar as fontes)
     ========================================================= */
  // Depois que a entrada termina (.is-done) o elemento larga os estilos de revelação,
  // para que as transições de hover do próprio componente voltem a valer.
  const reveal = (el) => {
    if (el.classList.contains('is-in')) return;
    el.classList.add('is-in');
    const delay = (parseFloat(el.style.getPropertyValue('--i')) || 0) * 90;
    setTimeout(() => el.classList.add('is-done'), delay + 1100);
  };
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const carousel = e.target.closest('[data-carousel]');
      const group = carousel ? $$('[data-reveal]', carousel) : [e.target];
      group.forEach((el) => {
        reveal(el);
        revealIO.unobserve(el);
      });
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });

  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      countIO.unobserve(e.target);
      const el = e.target;
      const end = Number(el.dataset.count);
      const t0 = performance.now() + 250;
      const dur = 1300;
      const step = (now) => {
        const t = clamp((now - t0) / dur, 0, 1);
        el.textContent = Math.round(end * (1 - Math.pow(1 - t, 4)));
        if (t < 1) requestAnimationFrame(step);
        else {
          el.style.width = '';
          el.style.display = '';
        }
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.9 });

  const ready = () => {
    if (doc.classList.contains('is-ready')) return;
    doc.classList.add('is-ready');
    $$('[data-reveal]').forEach((el) => {
      if (hero.contains(el) && scrollY < innerHeight * 0.5) reveal(el);
      else revealIO.observe(el);
    });
    if (!reduce()) {
      $$('[data-count]').forEach((el) => {
        el.style.display = 'inline-block';
        el.style.width = `${el.getBoundingClientRect().width}px`;
        el.textContent = '0';
        countIO.observe(el);
      });
    }
  };
  Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]).then(ready);

  /* =========================================================
     Hover "no centro da tela" para telas de toque
     ========================================================= */
  if (!mqFine.matches) {
    const centerIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.target.classList.toggle('is-center', e.isIntersecting));
    }, { rootMargin: '-42% 0px -42% 0px' });
    $$('[data-center]').forEach((el) => {
      if (!el.classList.contains('plate')) centerIO.observe(el);
    });
  }

  /* =========================================================
     KV: balanço contínuo do fundo e do logo (+ parallax de scroll)

     Um único transform por camada, recalculado a cada quadro a partir de senos
     contínuos: x e y andam juntos, sem "degraus". translate3d com valores
     fracionados + micro-giro de 0,02° fazem o navegador desenhar a camada em
     posição de subpixel, em vez de encaixá-la no pixel inteiro.
     ========================================================= */
  (() => {
    const drift = $('.hero__drift', hero);
    const logo = $('.hero__logo-img', hero);
    if (!drift || !logo || reduce()) return;
    const TAU = Math.PI * 2;
    let visible = false, raf = 0, last = 0, T = 0, hh = 1, amp = 1;

    const measure = () => {
      hh = hero.offsetHeight || 1;
      amp = mqDesk.matches ? clamp(innerWidth / 1920, 0.55, 1.25) : 0.55;
    };
    measure();
    addEventListener('resize', measure);

    const apply = () => {
      // rolagem: o fundo e o logo descem um pouco mais devagar que a página
      const hs = clamp(scrollY / hh, 0, 1);
      const s = 1.04 + 0.02 * Math.sin(TAU * T / 28);
      const bx = 9 * amp * Math.sin(TAU * T / 19);
      const by = 6 * amp * Math.sin(TAU * T / 23) + hs * 220;
      drift.style.transform = `translate3d(${bx.toFixed(3)}px, ${by.toFixed(3)}px, 0) scale3d(${s.toFixed(5)}, ${s.toFixed(5)}, 1) rotate(0.02deg)`;

      const lx = 5 * amp * Math.sin(TAU * T / 9.1);
      const ly = 9 * amp * Math.sin(TAU * T / 6.3) + hs * 120;
      const lr = 0.02 + 0.45 * Math.sin(TAU * T / 10.7);
      logo.style.transform = `translate3d(${lx.toFixed(3)}px, ${ly.toFixed(3)}px, 0) rotate(${lr.toFixed(4)}deg)`;
    };
    const frame = (now) => {
      const dt = last ? Math.min(64, now - last) : 16.667;
      last = now;
      T += dt / 1000;
      apply();
      raf = visible ? requestAnimationFrame(frame) : 0;
    };

    // Só anima (e mantém as camadas na GPU) enquanto a hero está na tela.
    new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      hero.classList.toggle('is-live', visible);
      if (visible && !raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    }, { rootMargin: '10% 0px' }).observe(hero);
    apply();
  })();

  /* =========================================================
     Botões magnéticos + cards com inclinação 3D
     ========================================================= */
  if (mqFine.matches && !reduce()) {
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${((e.clientX - r.left - r.width / 2) * 0.16).toFixed(1)}px`);
        el.style.setProperty('--my', `${((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1)}px`);
      });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--mx', '0px');
        el.style.setProperty('--my', '0px');
      });
    });

    // A subida do card é uma transition de CSS (translate); a inclinação é suavizada
    // aqui, em duas etapas, para nunca reiniciar nem competir com a subida.
    $$('[data-tilt]').forEach((card) => {
      let gx = 0, gy = 0, sx = 0, sy = 0, cx = 0, cy = 0, raf = 0, last = 0;
      const frame = (now) => {
        const f = (last ? Math.min(64, now - last) : 16.667) / 16.667;
        last = now;
        const k1 = 1 - Math.pow(1 - 0.16, f);
        const k2 = 1 - Math.pow(1 - 0.09, f);
        sx += (gx - sx) * k1; sy += (gy - sy) * k1;
        cx += (sx - cx) * k2; cy += (sy - cy) * k2;
        const settled = Math.abs(gx - cx) < 0.005 && Math.abs(gy - cy) < 0.005
          && Math.abs(gx - sx) < 0.005 && Math.abs(gy - sy) < 0.005;
        if (settled) { sx = cx = gx; sy = cy = gy; }
        card.style.transform = cx || cy
          ? `perspective(1000px) rotateX(${cx.toFixed(3)}deg) rotateY(${cy.toFixed(3)}deg)`
          : '';
        if (settled) { raf = 0; last = 0; } else raf = requestAnimationFrame(frame);
      };
      const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };
      card.addEventListener('pointermove', (e) => {
        if (!mqGrid.matches) return;
        const r = card.getBoundingClientRect();
        gy = ((e.clientX - r.left) / r.width - 0.5) * 8;
        gx = (0.5 - (e.clientY - r.top) / r.height) * 6;
        wake();
      });
      card.addEventListener('pointerleave', () => {
        gx = gy = 0;
        wake();
      });
    });
  }

  /* =========================================================
     Como participar: carrossel (abaixo de 1024px): arrastar + card ativo (mobile)
     Toque usa a rolagem nativa; com o mouse o arrasto segue o ponteiro e, ao soltar,
     o encaixe (scroll-snap) do CSS leva ao card mais próximo.
     ========================================================= */
  $$('[data-carousel]').forEach((track) => {
    const cards = Array.from(track.children);
    const hint = $('.how__hint');
    let down = false, moved = false, sx = 0, sl = 0, raf = 0;

    // Card "da vez" (levantado) só no mobile; no tablet vários cards ficam à vista.
    const pick = () => {
      raf = 0;
      if (mqDesk.matches) {
        cards.forEach((c) => c.classList.remove('is-active'));
        track.classList.remove('has-active');
        return;
      }
      const tr = track.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
      let best = cards[0];
      let bd = Infinity;
      cards.forEach((c) => {
        const d = Math.abs(c.getBoundingClientRect().left - tr.left - pad);
        if (d < bd) { bd = d; best = c; }
      });
      cards.forEach((c) => c.classList.toggle('is-active', c === best));
      track.classList.add('has-active');
    };

    track.addEventListener('scroll', () => {
      if (!raf) raf = requestAnimationFrame(pick);
      if (track.scrollLeft > 12 && hint) hint.classList.add('is-used');
    }, { passive: true });

    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || mqGrid.matches) return;
      down = true;
      moved = false;
      sx = e.clientX;
      sl = track.scrollLeft;
    });
    addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 5) {
        moved = true;
        track.classList.add('is-dragging');
      }
      if (moved) track.scrollLeft = sl - dx;
    });
    addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      track.classList.remove('is-dragging');
    });
    track.addEventListener('click', (e) => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    }, true);

    mqDesk.addEventListener('change', pick);
    pick();
  });

  /* =========================================================
     Prêmios: holofote no prêmio da placa / da imagem
     ========================================================= */
  const coords = (p) => (mqDesk.matches ? p.dataset.d : p.dataset.m).split(',').map(Number);
  let activePrize = null;
  function focusPrize(key) {
    if (key === activePrize) return;
    activePrize = key;
    plates.forEach((p) => p.classList.toggle('is-on', p.dataset.prize === key));
    if (!key) {
      prizes.style.setProperty('--so', 0);
      return;
    }
    const plate = plates.find((p) => p.dataset.prize === key);
    const [x, y, rw, rh] = coords(plate);
    prizes.style.setProperty('--sx', `${x}%`);
    prizes.style.setProperty('--sy', `${y}%`);
    prizes.style.setProperty('--rw', `${rw}%`);
    prizes.style.setProperty('--rh', `${rh}%`);
    prizes.style.setProperty('--so', 1);
  }
  const placeHotspots = () => {
    $$('.hotspot').forEach((h) => {
      const plate = plates.find((p) => p.dataset.prize === h.dataset.prize);
      const [x, y, rw, rh] = plate.dataset.d.split(',').map(Number);
      h.style.setProperty('--hx', `${x}%`);
      h.style.setProperty('--hy', `${y}%`);
      h.style.setProperty('--hw', `${rw}%`);
      h.style.setProperty('--hh', `${rh}%`);
      h.addEventListener('pointerenter', () => focusPrize(h.dataset.prize));
      h.addEventListener('pointerleave', () => focusPrize(null));
    });
  };
  placeHotspots();
  // Mouse: hover. Toque: só ao TOCAR na placa (o evento click não dispara ao rolar a tela).
  // Tocar de novo na mesma placa, ou fora das placas, desmarca.
  let tapSelected = false;
  plates.forEach((p) => {
    p.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') focusPrize(p.dataset.prize); });
    p.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') focusPrize(null); });
    p.addEventListener('click', (e) => {
      if (e.pointerType === 'mouse' || (e.pointerType === undefined && mqFine.matches)) return;
      tapSelected = activePrize !== p.dataset.prize;
      focusPrize(tapSelected ? p.dataset.prize : null);
    });
  });
  document.addEventListener('click', (e) => {
    if (!tapSelected || e.target.closest('.plate')) return;
    tapSelected = false;
    focusPrize(null);
  });
  mqDesk.addEventListener('change', () => {
    const k = activePrize;
    activePrize = null;
    focusPrize(k);
  });

  /* =========================================================
     Dúvidas frequentes (acordeão)
     ========================================================= */
  $$('.faq__q').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq__item');
      const open = !item.classList.contains('is-open');
      $$('.faq__item.is-open').forEach((i) => {
        if (i === item) return;
        i.classList.remove('is-open');
        $('.faq__q', i).setAttribute('aria-expanded', 'false');
      });
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  /* =========================================================
     Ganhadores: abas + busca
     ========================================================= */
  (() => {
    const data = SITE.ganhadores || {};
    const list = $('.winners__list');
    const input = $('.winners .search__input');
    const empty = $('.winners__empty');
    const tabsWrap = $('.winners__tabs');
    const tabs = $$('.winners__tab');
    const panel = $('#winners-panel');
    let current = 'premios';
    let timer = 0;

    const row = (w, i, animate) => `
      <li class="winner${animate ? ' is-new' : ''}" style="--ri:${i}">
        <picture><source media="(min-width: 768px)" srcset="assets/img/avatar-d.svg"><img class="winner__avatar" src="assets/img/avatar-m.svg" width="61" height="61" alt=""></picture>
        <div class="winner__who"><p class="winner__name">${esc(w.nome)}</p><p class="winner__cpf">CPF: ${esc(w.cpf)}</p></div>
        <div class="winner__prize"><p class="winner__label">Prêmio</p><p class="winner__item">${esc(w.premio)}</p></div>
      </li>`;

    const render = (animate = true) => {
      const q = norm(input.value);
      const rows = (data[current] || []).filter((w) => !q || norm(w.nome).includes(q) || norm(w.premio).includes(q));
      list.innerHTML = rows.map((w, i) => row(w, Math.min(i, 10), animate)).join('');
      list.scrollTop = 0;
      empty.hidden = rows.length > 0;
    };

    const select = (i) => {
      tabs.forEach((t, j) => {
        const on = i === j;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      panel.setAttribute('aria-labelledby', tabs[i].id);
      current = tabs[i].dataset.tab;
      render();
    };

    tabs.forEach((t, i) => t.addEventListener('click', () => select(i)));
    tabsWrap.addEventListener('keydown', (e) => {
      const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      let i = tabs.findIndex((t) => t.classList.contains('is-active'));
      if (e.key in keys) i = (i + keys[e.key] + tabs.length) % tabs.length;
      else if (e.key === 'Home') i = 0;
      else if (e.key === 'End') i = tabs.length - 1;
      else return;
      e.preventDefault();
      select(i);
      tabs[i].focus();
    });
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(render, 140);
    });
    if (data.premios) render(false);
  })();

  /* =========================================================
     Popups (lojas participantes / marcas parceiras)
     ========================================================= */
  let lastFocus = null;
  function openModal(id) {
    const dlg = document.getElementById(id);
    if (!dlg || dlg.open) return;
    lastFocus = document.activeElement;
    closeMenu();
    dlg.showModal();
    doc.classList.add('is-locked');
    Scroller.lock(true);
  }
  function closeModal(dlg) {
    if (!dlg.open || dlg.classList.contains('is-closing')) return;
    const box = $('.modal__box', dlg);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      dlg.classList.remove('is-closing');
      dlg.close();
      doc.classList.remove('is-locked');
      Scroller.lock(false);
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    };
    if (reduce()) { finish(); return; }
    dlg.classList.add('is-closing');
    box.addEventListener('animationend', (e) => { if (e.target === box) finish(); });
    setTimeout(finish, 450);
  }
  $$('[data-modal-open]').forEach((b) => b.addEventListener('click', () => openModal(b.dataset.modalOpen)));
  $$('dialog.modal').forEach((dlg) => {
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeModal(dlg);
    });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) closeModal(dlg); });
    $$('[data-modal-close]', dlg).forEach((b) => b.addEventListener('click', () => closeModal(dlg)));
  });

  /* Lojas (nome + CNPJ) */
  (() => {
    const lojas = SITE.lojas || [];
    const search = $('[data-store-search]');
    const listEl = $('[data-store-list]');
    const countEl = $('[data-store-count]');
    const emptyEl = $('[data-store-empty]');
    const digits = (s) => String(s || '').replace(/\D/g, '');
    const onlyNumeric = (s) => /^[\d.\-/\s]+$/.test(s);
    const index = lojas.map((l) => ({ l, n: norm(l.nome), d: digits(l.cnpj) }));
    let timer = 0;

    const tpl = (l, i) => `
      <li class="store" style="--ri:${Math.min(i, 14)}">
        <h3 class="store__name">${esc(l.nome)}</h3>
        <p class="store__cnpj"><span>CNPJ</span> ${esc(l.cnpj)}</p>
      </li>`;

    const render = () => {
      const raw = search.value.trim();
      const q = norm(raw);
      const qd = onlyNumeric(raw) ? digits(raw) : '';
      const rows = index.filter((x) => !q || x.n.includes(q) || (qd && x.d.includes(qd))).map((x) => x.l);
      listEl.innerHTML = rows.map(tpl).join('');
      countEl.innerHTML = rows.length ? `<strong>${rows.length}</strong> ${rows.length === 1 ? 'loja encontrada' : 'lojas encontradas'}` : '';
      emptyEl.hidden = rows.length > 0;
    };
    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(render, 140);
    });
    $('[data-store-reset]').addEventListener('click', () => {
      search.value = '';
      render();
      search.focus();
    });
    render();
  })();

  /* Marcas */
  (() => {
    const marcas = SITE.marcas || [];
    $('[data-brand-list]').innerHTML = marcas.map((m, i) => {
      const inner = m.logo
        ? `<img src="${esc(m.logo)}" alt="${esc(m.nome)}" loading="lazy">`
        : `<span class="brand__name">${esc(m.nome)}</span>`;
      return m.url
        ? `<li><a class="brand" style="--ri:${i}" href="${esc(m.url)}" target="_blank" rel="noopener">${inner}</a></li>`
        : `<li class="brand" style="--ri:${i}">${inner}</li>`;
    }).join('');
  })();
})();
