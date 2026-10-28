/* ==========================================================================
   VERDE PREMIADO — ITOGRASS · interações (JS nativo, zero dependências)
   ========================================================================== */
(() => {
  'use strict';
  window.__itoReady = true;

  /* ------------------------------------------------------------------------
     Configuração
     ------------------------------------------------------------------------ */
  const CONFIG = {
    cadastroUrl: '#',   // URL da página de cadastro (botões "CADASTRE-SE AGORA")
    loginUrl: '#',      // URL de login/cadastro (botão do menu)
    smoothScroll: true, // rolagem suave com inércia (desktop com mouse)
  };

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const html = document.documentElement;
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqFine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = () => mqReduce.matches;
  const NAV_H = 70;

  /* ------------------------------------------------------------------------
     Links configuráveis
     ------------------------------------------------------------------------ */
  $$('[data-link="cadastro"]').forEach((a) => { a.href = CONFIG.cadastroUrl; });
  $$('[data-link="login"]').forEach((a) => { a.href = CONFIG.loginUrl; });

  /* ------------------------------------------------------------------------
     Rolagem suave (inércia na roda do mouse) + âncoras
     ------------------------------------------------------------------------ */
  // Versão leve: inércia curta (~0,35s), só para roda de mouse. Trackpads (que já têm
  // inércia própria), aparelhos modestos e quedas de quadros voltam à rolagem nativa.
  const Scroll = (() => {
    const lowEnd = (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2;
    let enabled = CONFIG.smoothScroll && mqFine.matches && !reduced() && !lowEnd;
    const EASE = 0.2; // fração do caminho percorrida por quadro (60fps)
    let target = window.scrollY;
    let current = target;
    let raf = 0;
    let last = 0;
    let active = false;
    let slowFrames = 0;
    let trackpadUntil = 0;
    const maxY = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    function stop() { cancelAnimationFrame(raf); raf = 0; last = 0; active = false; }
    function disable() { stop(); enabled = false; html.classList.remove('has-smooth'); }

    function step(now) {
      const dt = last ? now - last : 16.667;
      last = now;
      // página pesada: vários quadros acima de ~30fps → desliga e volta ao nativo
      if (dt > 34) { if (++slowFrames >= 6) { disable(); return; } } else if (slowFrames > 0) slowFrames--;
      const k = 1 - Math.pow(1 - EASE, Math.min(64, dt) / 16.667);
      current += (target - current) * k;
      if (Math.abs(target - current) < 0.5) current = target;
      window.scrollTo(0, current);
      if (current !== target) raf = requestAnimationFrame(step);
      else stop();
    }
    function start() {
      active = true;
      if (!raf) raf = requestAnimationFrame(step);
    }
    // deixa rolar nativamente dentro de áreas roláveis (ex.: lista de ganhadores)
    function innerCanScroll(el, dy) {
      while (el && el !== document.body) {
        if (el.hasAttribute && el.hasAttribute('data-scroll-inner')) {
          const max = el.scrollHeight - el.clientHeight;
          if (max > 1 && ((dy > 0 && el.scrollTop < max - 1) || (dy < 0 && el.scrollTop > 0))) return true;
        }
        el = el.parentElement;
      }
      return false;
    }

    if (enabled) {
      html.classList.add('has-smooth');
      window.addEventListener('wheel', (e) => {
        if (!enabled || e.ctrlKey || e.defaultPrevented || document.body.classList.contains('is-locked')) return;
        // trackpad: passos pequenos em pixels ou rolagem nos dois eixos → deixa o nativo
        const now = performance.now();
        if (e.deltaMode === 0 && (e.deltaX !== 0 || Math.abs(e.deltaY) < 40)) trackpadUntil = now + 1500;
        if (now < trackpadUntil) { if (active) stop(); return; }
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        if (innerCanScroll(e.target, e.deltaY)) return;
        e.preventDefault();
        let dy = e.deltaY;
        if (e.deltaMode === 1) dy *= 16;
        else if (e.deltaMode === 2) dy *= window.innerHeight;
        if (!active) current = target = window.scrollY;
        target = clamp(target + dy, 0, maxY());
        start();
      }, { passive: false });
      // teclado / barra de rolagem / busca da página: sincroniza
      window.addEventListener('scroll', () => { if (!active) current = target = window.scrollY; }, { passive: true });
      window.addEventListener('keydown', () => { if (active) stop(); });
    }

    function to(y) {
      y = clamp(Math.round(y), 0, maxY());
      if (!enabled) {
        window.scrollTo({ top: y, behavior: reduced() ? 'auto' : 'smooth' });
        return;
      }
      if (!active) current = window.scrollY;
      target = y;
      start();
    }
    return { to };
  })();

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const hash = a.getAttribute('href');
    if (hash === '#') { e.preventDefault(); return; } // links provisórios
    const el = document.getElementById(hash.slice(1));
    if (!el) return;
    e.preventDefault();
    Menu.close();
    const y = hash === '#home' ? 0 : el.getBoundingClientRect().top + window.scrollY - NAV_H + 1;
    Scroll.to(y);
    history.replaceState(null, '', hash);
    // acessibilidade: leva o foco do teclado para a seção de destino
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  });

  /* ------------------------------------------------------------------------
     Menu: estado ao rolar, barra de progresso e seção ativa
     ------------------------------------------------------------------------ */
  const nav = $('.nav');
  const progress = $('.nav__progress span');
  let scrollTicking = false;
  const scrollHandlers = [];
  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      scrollTicking = false;
      const y = window.scrollY;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      nav.classList.toggle('is-scrolled', y > 8);
      progress.style.setProperty('--p', (y / max).toFixed(4));
      scrollHandlers.forEach((fn) => fn(y));
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  const spyLinks = $$('[data-spy]');
  const spyIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const id = en.target.id;
      spyLinks.forEach((l) => {
        const on = l.dataset.spy === id;
        l.classList.toggle('is-active', on);
        if (on) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach((s) => spyIO.observe(s));

  /* ------------------------------------------------------------------------
     Menu mobile
     ------------------------------------------------------------------------ */
  const Menu = (() => {
    const btn = $('.nav__burger');
    const panel = $('#menu-mobile');
    panel.inert = true;
    const isOpen = () => panel.classList.contains('is-open');
    function open() {
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'Fechar menu');
      panel.classList.add('is-open');
      panel.setAttribute('aria-hidden', 'false');
      panel.inert = false;
      document.body.classList.add('is-locked');
    }
    function close() {
      if (!isOpen()) return;
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Abrir menu');
      panel.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
      panel.inert = true;
      document.body.classList.remove('is-locked');
    }
    btn.addEventListener('click', () => (isOpen() ? close() : open()));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) { close(); btn.focus(); } });
    matchMedia('(min-width: 1280px)').addEventListener('change', (e) => { if (e.matches) close(); });
    return { close };
  })();

  /* ------------------------------------------------------------------------
     Títulos: palavras sobem de dentro de uma máscara
     ------------------------------------------------------------------------ */
  $$('[data-split]').forEach((el) => {
    let wi = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const w = document.createElement('span');
            w.className = 'split-w';
            const i = document.createElement('span');
            i.textContent = part;
            i.style.setProperty('--wi', wi++);
            w.appendChild(i);
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) {
          walk(n);
        }
      });
    };
    walk(el);
  });

  /* ------------------------------------------------------------------------
     Revelação gradual no scroll
     ------------------------------------------------------------------------ */
  const revealEls = $$('[data-reveal], [data-split]');
  if (reduced() || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-in'));
  } else {
    const rIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); rIO.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    revealEls.forEach((el) => rIO.observe(el));
  }

  /* Pausa animações contínuas das seções fora da tela (economia de CPU/bateria) */
  const offIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => en.target.classList.toggle('is-off', !en.isIntersecting));
  }, { rootMargin: '120px 0px' });
  $$('.hero, .sec').forEach((s) => offIO.observe(s));

  /* ------------------------------------------------------------------------
     HERO — entrada + parallax pelo mouse (desktop) / loop (toque, via CSS)
     ------------------------------------------------------------------------ */
  const hero = $('[data-hero]');
  if (hero) {
    // Entrada: espera as imagens principais (máx. 1.6s) e dispara a animação
    const keyImgs = $$('.hero__bg img, .hl--ito img, .hl--stack img', hero);
    const ready = Promise.all(keyImgs.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())));
    const go = () => requestAnimationFrame(() => {
      hero.classList.add('is-ready');
      setTimeout(() => hero.classList.add('is-settled'), 2600);
    });
    Promise.race([ready, new Promise((r) => setTimeout(r, 1600))]).then(go);

    // Parallax pelo mouse: a posição do Figma é o limite "mais para cima".
    // Eixo Y: as camadas só descem. Eixo X: a grama esquerda só sai para a esquerda
    // e a direita só para a direita. --ax/--ay = amplitude (px do desktop).
    if (mqFine.matches && !reduced()) {
      const layers = $$('[data-plx]', hero).map((el) => ({
        el,
        ax: parseFloat(el.style.getPropertyValue('--ax')) || 0,
        ay: parseFloat(el.style.getPropertyValue('--ay')) || 0,
        pm: el.dataset.pm || '',
        text: el.hasAttribute('data-text'),
      }));
      // unidade do frame + fator de amplitude: a composição do tablet é ~82% da do
      // desktop e a do mobile ~50% (as sobras do fundo no CSS acompanham esses limites)
      let unit = 1;
      let amp = 1;
      const measure = () => {
        const w = window.innerWidth;
        amp = w < 700 ? 0.5 : w < 1280 ? 0.82 : 1;
        unit = hero.offsetHeight / (w < 700 ? 808.5 : w < 1280 ? 762 : 860);
      };
      measure();
      window.addEventListener('resize', measure);

      let gx = 0; let gy = 0;        // alvo bruto (posição do mouse)
      let sx = 0; let sy = 0;        // 1ª etapa: alvo suavizado
      let cx = 0; let cy = 0;        // 2ª etapa: posição exibida
      let inside = false;
      let lastInput = performance.now();
      let raf = 0; let last = 0; let visible = false;
      const IDLE = 5000; // sem mouse por ~5s: a "respiração" termina e a cena para na posição do Figma

      const apply = () => {
        const s = unit * amp;
        for (let i = 0; i < layers.length; i++) {
          const L = layers[i];
          let x = cx * L.ax;
          if (L.pm === 'l') x = Math.min(0, cx) * L.ax;
          else if (L.pm === 'r') x = Math.max(0, cx) * L.ax;
          const y = Math.max(0, cy) * L.ay;
          // translate3d + micro-giro (0.02deg): a camada é desenhada em posição de subpixel,
          // sem "encaixar" no pixel inteiro (o que fazia o movimento andar em degraus).
          // O texto fica sem giro para continuar nítido.
          L.el.style.transform = `translate3d(${(x * s).toFixed(3)}px, ${(y * s).toFixed(3)}px, 0)${L.text ? '' : ' rotate(0.02deg)'}`;
        }
      };
      const frame = (now) => {
        const dt = last ? Math.min(64, now - last) : 16.667;
        last = now;
        const idle = !inside && now - lastInput > IDLE;
        let tx = 0; let ty = 0;
        if (inside) { tx = gx; ty = gy; } else if (!idle) {
          // "respiração" suave enquanto o mouse está fora da hero
          const t = now / 1000;
          tx = Math.sin(t * 0.45) * 0.3;
          ty = ((Math.sin(t * 0.7 - Math.PI / 2) + 1) / 2) * 0.35;
        }
        // Suavização em duas etapas: o mouse anda em passos de 1px, ora em x, ora em y.
        // Com uma etapa só, cada passo muda a direção da velocidade na hora (x, depois y…);
        // com duas, a velocidade varia de forma contínua e o movimento sai na diagonal real.
        const f = dt / 16.667;
        const k1 = 1 - Math.pow(1 - 0.14, f);
        const k2 = 1 - Math.pow(1 - 0.075, f);
        sx += (tx - sx) * k1; sy += (ty - sy) * k1;
        cx += (sx - cx) * k2; cy += (sy - cy) * k2;
        const settled = (inside || idle)
          && Math.abs(tx - sx) < 0.0005 && Math.abs(ty - sy) < 0.0005
          && Math.abs(tx - cx) < 0.0005 && Math.abs(ty - cy) < 0.0005;
        if (settled) { sx = cx = tx; sy = cy = ty; }
        apply();
        if (settled || !visible) { raf = 0; return; }
        raf = requestAnimationFrame(frame);
      };
      const wake = () => {
        lastInput = performance.now();
        if (visible && !raf) { last = 0; raf = requestAnimationFrame(frame); }
      };

      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        gx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
        gy = clamp((e.clientY - r.top) / r.height, 0, 1);
        inside = true;
        wake();
      });
      hero.addEventListener('pointerleave', () => { inside = false; wake(); });
      // Camadas ficam na GPU enquanto a hero está na tela e são liberadas ao sair dela
      new IntersectionObserver(([en]) => {
        visible = en.isIntersecting;
        hero.classList.toggle('is-live', visible);
        if (visible) wake();
      }).observe(hero);
    }
  }

  /* ------------------------------------------------------------------------
     Selos: o anel gira sempre; acelera suavemente no hover
     ------------------------------------------------------------------------ */
  $$('.seal').forEach((seal) => {
    const ring = $('.seal__ring', seal);
    let rate = 1; let goal = 1; let raf = 0;
    const tick = () => {
      rate += (goal - rate) * 0.07;
      const anim = ring.getAnimations ? ring.getAnimations()[0] : null;
      if (anim) anim.playbackRate = rate;
      raf = Math.abs(goal - rate) > 0.01 ? requestAnimationFrame(tick) : 0;
    };
    const set = (r) => { goal = r; if (!raf) raf = requestAnimationFrame(tick); };
    const trigger = seal.closest('.pr__card') || seal;
    trigger.addEventListener('pointerenter', () => set(4));
    trigger.addEventListener('pointerleave', () => set(1));
  });

  /* ------------------------------------------------------------------------
     Parallax de scroll dos elementos decorativos (folhas, tickets)
     ------------------------------------------------------------------------ */
  if (!reduced()) {
    const items = $$('[data-speed]').map((el) => ({ el, s: parseFloat(el.dataset.speed) || 0, sec: el.closest('section') }));
    const update = () => {
      const vh = window.innerHeight;
      items.forEach((it) => {
        if (it.sec.classList.contains('is-off')) return;
        const r = it.sec.getBoundingClientRect();
        const c = r.top + r.height / 2 - vh / 2;
        it.el.style.transform = `translate3d(0, ${(-c * it.s).toFixed(1)}px, 0)`;
      });
    };
    scrollHandlers.push(update);
    update();
  }

  /* ------------------------------------------------------------------------
     Contador "21.600"
     ------------------------------------------------------------------------ */
  // Um número "fantasma" invisível reserva a largura final: o bloco não muda de
  // tamanho durante a contagem e continua centralizado (antes, no mobile, a largura
  // medida no meio da animação de entrada deslocava o conjunto).
  $$('[data-count]').forEach((el) => {
    const end = parseInt(el.dataset.count, 10);
    const fmt = (n) => n.toLocaleString('pt-BR');
    const finalTxt = el.textContent.trim();
    const ghost = document.createElement('span');
    ghost.className = 'pr__num-ghost tt';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.textContent = finalTxt;
    const live = document.createElement('span');
    live.className = 'pr__num-live tt';
    live.textContent = finalTxt;
    el.classList.remove('tt');
    el.replaceChildren(ghost, live);
    if (reduced()) return;
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const dur = 2000;
      const run = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(2, -10 * p);
        live.textContent = fmt(Math.round(end * (p === 1 ? 1 : e)));
        if (p < 1) requestAnimationFrame(run);
      };
      requestAnimationFrame(run);
    }, { threshold: 0.6 });
    io.observe(el);
  });

  /* ------------------------------------------------------------------------
     Botões magnéticos (seguem levemente o cursor)
     ------------------------------------------------------------------------ */
  if (mqFine.matches && !reduced()) {
    $$('.magnetic').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) / r.width;
        const y = (e.clientY - (r.top + r.height / 2)) / r.height;
        b.style.setProperty('--mgx', `${(x * 12).toFixed(2)}px`);
        b.style.setProperty('--mgy', `${(y * 8).toFixed(2)}px`);
      });
      b.addEventListener('pointerleave', () => {
        b.style.setProperty('--mgx', '0px');
        b.style.setProperty('--mgy', '0px');
      });
    });
  }

  /* ------------------------------------------------------------------------
     Dúvidas frequentes — só um aberto por vez
     ------------------------------------------------------------------------ */
  // Com duas colunas, fechar uma pergunta e abrir outra na coluna ao lado fazia a
  // seção encolher e crescer de novo. Agora a altura do conjunto vai direto para o
  // tamanho final (medido numa cópia invisível), num único movimento.
  const faqCols = $('.faq__cols');
  const faqItems = $$('.faq__item', faqCols);
  const faqFinalHeight = (openItem) => {
    const clone = faqCols.cloneNode(true);
    $$('.faq__item', clone).forEach((it, i) => it.classList.toggle('is-open', faqItems[i] === openItem));
    clone.removeAttribute('style');
    clone.classList.remove('is-sizing');
    clone.setAttribute('aria-hidden', 'true');
    clone.style.cssText = 'position:absolute;left:0;right:0;top:0;visibility:hidden;pointer-events:none';
    faqCols.parentElement.appendChild(clone);
    const h = clone.offsetHeight;
    clone.remove();
    return h;
  };
  let faqTimer = 0;
  faqItems.forEach((item) => {
    const btn = $('.faq__q', item);
    btn.addEventListener('click', () => {
      const target = item.classList.contains('is-open') ? null : item;
      const from = faqCols.offsetHeight;
      const to = faqFinalHeight(target);
      faqCols.style.height = `${from}px`;
      faqCols.classList.add('is-sizing');
      void faqCols.offsetHeight;
      faqItems.forEach((it) => {
        const on = it === target;
        it.classList.toggle('is-open', on);
        $('.faq__q', it).setAttribute('aria-expanded', String(on));
      });
      faqCols.style.height = `${to}px`;
      clearTimeout(faqTimer);
      faqTimer = setTimeout(() => { faqCols.classList.remove('is-sizing'); faqCols.style.height = ''; }, 680);
    });
  });

  /* ------------------------------------------------------------------------
     GANHADORES
     ------------------------------------------------------------------------ */
  const gw = (() => {
    const list = $('#gw-list');
    if (!list) return;
    const listWrap = $('.gw__listwrap');
    const input = $('#gw-q');
    const note = $('.gw__note');
    const status = $('#gw-status');
    const src = window.ITOGRASS_GANHADORES || { ordem: 'asc', meses: [] };
    const params = new URLSearchParams(location.search);
    const preview = params.get('preview') === 'ganhadores';

    let meses = (src.meses || []).map((m) => ({ ...m, ganhadores: (m.ganhadores || []).slice() }));
    if (preview) {
      // Pré-visualização do layout (igual ao Figma): Mês 01 e 02 premiados, Mês 03 em contagem
      const fake = () => [1, 2, 3].map(() => ({ nome: 'Nome Do Ganhador', cpf: '###.###.###-##', premio: 'Lorem ipsum dolor sit amet' }));
      const soon = new Date(Date.now() + ((12 * 24 + 5) * 3600 + 23 * 60 + 41) * 1000).toISOString();
      meses = meses.map((m) => {
        if (m.mes <= 2) return { ...m, ganhadores: fake() };
        if (m.mes === 3) return { ...m, apuracao: soon, ganhadores: [] };
        return { ...m, ganhadores: [] };
      });
    }

    const pad = (n) => String(n).padStart(2, '0');
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmtDate = (iso) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return 'DD/MM/AAAA';
      return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    const initials = (name) => name.trim().split(/\s+/).filter(Boolean).map((p) => p[0]).filter((c) => /[\p{L}]/u.test(c)).slice(0, 2).join('').toUpperCase();
    const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

    // destaca o termo buscado (ignorando acentos e maiúsculas)
    function highlight(text, q) {
      if (!q) return esc(text);
      const map = [];
      let n = '';
      for (let i = 0; i < text.length; i++) {
        const c = norm(text[i]);
        for (let j = 0; j < c.length; j++) { n += c[j]; map.push(i); }
      }
      const at = n.indexOf(q);
      if (at < 0) return esc(text);
      const s = map[at];
      const e = map[at + q.length - 1] + 1;
      return `${esc(text.slice(0, s))}<mark>${esc(text.slice(s, e))}</mark>${esc(text.slice(e))}`;
    }

    // Regra de exibição: meses premiados + o próximo mês com contagem regressiva
    function visibleMonths() {
      const sorted = meses.slice().sort((a, b) => a.mes - b.mes);
      const out = [];
      for (const m of sorted) {
        if (m.ganhadores.length) out.push({ ...m, state: 'done' });
        else { out.push({ ...m, state: 'next' }); break; }
      }
      return out;
    }

    const rowTpl = (g, q) => `
      <li class="gm__row">
        <span class="gm__av" aria-hidden="true">${esc(initials(g.nome || '') || '•')}</span>
        <span class="gm__info">
          <span class="gm__name">${highlight(g.nome || '', q)}</span>
          <span class="gm__cpf">CPF: ${highlight(g.cpf || '', q)}</span>
          <span class="gm__prize">Prêmio: ${highlight(g.premio || '', q)}</span>
        </span>
        <span class="gm__tk"><img src="assets/img/ticket-ganhador.webp" alt="" width="990" height="595" loading="lazy" decoding="async"></span>
      </li>`;

    const doneTpl = (m, rows, open, q) => `
      <div class="gm${open ? ' is-open' : ''}" data-mes="${m.mes}">
        <button class="gm__head" type="button" id="gm-h${m.mes}" aria-expanded="${open}" aria-controls="gm-b${m.mes}">
          <span class="gm__hd">
            <span class="gm__t">Mês ${pad(m.mes)}</span>
            <span class="gm__s">Apuração em ${fmtDate(m.apuracao)} · ${pad(m.ganhadores.length)} ganhadores</span>
          </span>
          <i class="pm" aria-hidden="true"></i>
        </button>
        <div class="gm__body" id="gm-b${m.mes}" role="region" aria-labelledby="gm-h${m.mes}">
          <div class="gm__body-in"><ul class="gm__rows">${rows.map((g) => rowTpl(g, q)).join('')}</ul></div>
        </div>
      </div>`;

    const nextTpl = (m) => `
      <div class="gm gm--next" data-mes="${m.mes}">
        <div class="gm__head">
          <span class="gm__hd">
            <span class="gm__t">Mês ${pad(m.mes)}</span>
            <span class="gm__s">Apuração em ${fmtDate(m.apuracao)} · 00 ganhadores</span>
          </span>
          <div class="gm__cd" role="timer" aria-label="Contagem regressiva para a apuração do Mês ${pad(m.mes)}" data-target="${esc(m.apuracao)}">
            <span class="cd__box"><span class="cd__v" data-u="d">00</span><span class="cd__l">DIAS</span></span>
            <span class="cd__box"><span class="cd__v" data-u="h">00</span><span class="cd__l">HORAS</span></span>
            <span class="cd__box"><span class="cd__v" data-u="m">00</span><span class="cd__l">MIN</span></span>
            <span class="cd__box"><span class="cd__v" data-u="s">00</span><span class="cd__l">SEG</span></span>
          </div>
        </div>
      </div>`;

    let openMes = null;
    let query = '';

    function render() {
      const months = visibleMonths();
      const done = months.filter((m) => m.state === 'done');
      if (openMes === null) openMes = done.length ? (preview ? done[0].mes : done[done.length - 1].mes) : -1;
      let htmlStr = '';
      if (query) {
        const q = norm(query);
        const hits = done
          .map((m) => ({ m, rows: m.ganhadores.filter((g) => norm(`${g.nome} ${g.cpf} ${g.premio}`).includes(q)) }))
          .filter((x) => x.rows.length);
        htmlStr = hits.length
          ? hits.map((x) => doneTpl(x.m, x.rows, true, q)).join('')
          : `<p class="gw__empty">Nenhum ganhador encontrado para “${esc(query)}”.</p>`;
        const total = hits.reduce((n, x) => n + x.rows.length, 0);
        if (status) status.textContent = total ? `${total} ganhador${total > 1 ? 'es' : ''} encontrado${total > 1 ? 's' : ''}.` : 'Nenhum ganhador encontrado.';
      } else {
        if (status) status.textContent = '';
        const ordered = src.ordem === 'desc' ? months.slice().reverse() : months;
        htmlStr = ordered.map((m) => (m.state === 'done' ? doneTpl(m, m.ganhadores, m.mes === openMes, '') : nextTpl(m))).join('');
      }
      list.innerHTML = htmlStr;
      if (note) note.hidden = Boolean(done.length || query);
      bindMonths();
      startCountdown();
      bar.observe();
    }

    function bindMonths() {
      $$('.gm', list).forEach((gm) => {
        const head = $('button.gm__head', gm);
        if (!head) return;
        head.addEventListener('click', () => {
          const willOpen = !gm.classList.contains('is-open');
          if (!query) {
            $$('.gm.is-open', list).forEach((o) => { o.classList.remove('is-open'); $('button.gm__head', o).setAttribute('aria-expanded', 'false'); });
            openMes = willOpen ? Number(gm.dataset.mes) : -1;
          } else if (!willOpen) {
            gm.classList.remove('is-open'); head.setAttribute('aria-expanded', 'false'); return;
          }
          if (willOpen) { gm.classList.add('is-open'); head.setAttribute('aria-expanded', 'true'); }
        });
      });
    }

    // Contagem regressiva do próximo sorteio
    let cdTimer = 0;
    function startCountdown() {
      clearInterval(cdTimer);
      const cd = $('.gm__cd', list);
      if (!cd) return;
      const target = new Date(cd.dataset.target).getTime();
      const els = { d: $('[data-u="d"]', cd), h: $('[data-u="h"]', cd), m: $('[data-u="m"]', cd), s: $('[data-u="s"]', cd) };
      const tick = (first) => {
        const diff = target - Date.now();
        if (!Number.isFinite(target) || diff <= 0) {
          clearInterval(cdTimer);
          cd.outerHTML = '<span class="gm__wait">Apuração em andamento</span>';
          return;
        }
        const s = Math.floor(diff / 1000);
        const v = { d: pad(Math.floor(s / 86400)), h: pad(Math.floor((s % 86400) / 3600)), m: pad(Math.floor((s % 3600) / 60)), s: pad(s % 60) };
        Object.keys(v).forEach((k) => {
          const el = els[k];
          if (el.textContent === v[k]) return;
          el.textContent = v[k];
          if (!first && !reduced()) { el.classList.remove('is-tick'); void el.offsetWidth; el.classList.add('is-tick'); }
        });
      };
      tick(true);
      cdTimer = setInterval(() => tick(false), 1000);
    }

    // Barra de rolagem personalizada (trilho #edf1e8 · alça #6dab30, como no Figma)
    const bar = (() => {
      const track = $('.gw__bar', listWrap);
      const thumb = $('.gw__thumb', listWrap);
      const ro = new ResizeObserver(() => update());
      let thumbH = 140;
      function update() {
        const sh = list.scrollHeight;
        const ch = list.clientHeight;
        const can = sh > ch + 2;
        listWrap.classList.toggle('no-scroll', !can);
        if (!can) return;
        const th = track.clientHeight;
        const pxUnit = parseFloat(getComputedStyle(track).width) / 13 || 1;
        thumbH = Math.min(th * 0.6, Math.max(48, 140 * Math.min(1, pxUnit)));
        thumb.style.height = `${thumbH}px`;
        const maxT = th - thumbH;
        thumb.style.transform = `translateY(${((list.scrollTop / (sh - ch)) * maxT).toFixed(1)}px)`;
      }
      function observe() {
        ro.disconnect();
        ro.observe(list);
        Array.from(list.children).forEach((c) => ro.observe(c));
        update();
      }
      list.addEventListener('scroll', update, { passive: true });
      // arrastar a alça
      let startY = 0; let startTop = 0;
      thumb.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        thumb.setPointerCapture(e.pointerId);
        thumb.classList.add('is-drag');
        startY = e.clientY; startTop = list.scrollTop;
      });
      thumb.addEventListener('pointermove', (e) => {
        if (!thumb.classList.contains('is-drag')) return;
        const maxT = track.clientHeight - thumbH;
        const ratio = (list.scrollHeight - list.clientHeight) / Math.max(1, maxT);
        list.scrollTop = startTop + (e.clientY - startY) * ratio;
      });
      const endDrag = () => thumb.classList.remove('is-drag');
      thumb.addEventListener('pointerup', endDrag);
      thumb.addEventListener('pointercancel', endDrag);
      // clicar no trilho
      track.addEventListener('pointerdown', (e) => {
        if (e.target === thumb) return;
        const r = track.getBoundingClientRect();
        const p = clamp((e.clientY - r.top - thumbH / 2) / Math.max(1, r.height - thumbH), 0, 1);
        list.scrollTo({ top: p * (list.scrollHeight - list.clientHeight), behavior: reduced() ? 'auto' : 'smooth' });
      });
      return { observe, update };
    })();

    // Busca
    let debounce = 0;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        query = input.value.trim();
        list.scrollTop = 0;
        render();
      }, 140);
    });

    render();
    return { render };
  })();
  void gw;
})();
