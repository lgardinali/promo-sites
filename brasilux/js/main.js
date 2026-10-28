/* ==========================================================================
   Comportamentos da casca: menu, ancoras, scrollspy, luz dos cards e
   botao de voltar ao topo.
   ========================================================================== */

(function () {
  const lenis = window.Motion && window.Motion.lenis;
  const header = document.getElementById("header");
  const nav = document.getElementById("nav");
  const burger = document.getElementById("burger");
  const toTop = document.getElementById("to-top");
  const navLinks = $$("[data-nav]");

  const headerH = () => (header ? header.offsetHeight : 70);

  /* ---------------------------------------------------------------------
     Rolagem ate uma ancora
     --------------------------------------------------------------------- */

  function scrollTo(target, opts = {}) {
    if (lenis) {
      lenis.scrollTo(target, { offset: -headerH(), duration: 1.2, ...opts });
    } else if (typeof target === "number") {
      window.scrollTo({ top: target, behavior: "smooth" });
    } else {
      const y = target.getBoundingClientRect().top + window.scrollY - headerH();
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }

  document.addEventListener("click", (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute("href");
    if (id === "#" || id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;

    e.preventDefault();
    closeMenu();
    scrollTo(target);
  });

  /* ---------------------------------------------------------------------
     Menu mobile
     --------------------------------------------------------------------- */

  $$(".nav__item").forEach((li, i) => li.style.setProperty("--i", i));

  function openMenu() {
    nav.classList.add("is-open");
    burger.setAttribute("aria-expanded", "true");
    burger.setAttribute("aria-label", "Fechar menu");
    document.body.classList.add("is-locked");
    lenis && lenis.stop();
  }

  function closeMenu() {
    if (!nav.classList.contains("is-open")) return;
    nav.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-label", "Abrir menu");
    document.body.classList.remove("is-locked");
    lenis && lenis.start();
  }

  if (burger) {
    burger.addEventListener("click", () => {
      nav.classList.contains("is-open") ? closeMenu() : openMenu();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  // Ao voltar para o desktop o painel nao deve continuar preso.
  window.matchMedia("(min-width: 1025px)").addEventListener("change", (e) => {
    if (e.matches) closeMenu();
  });

  /* ---------------------------------------------------------------------
     Estado do cabecalho e botao de topo
     --------------------------------------------------------------------- */

  function onScroll() {
    const y = window.scrollY;
    header && header.classList.toggle("is-stuck", y > 80);
    if (toTop) {
      const limit = (document.body.scrollHeight - window.innerHeight) * 0.6;
      toTop.classList.toggle("is-visible", y > limit);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (toTop) toTop.addEventListener("click", () => scrollTo(0, { offset: 0 }));

  /* ---------------------------------------------------------------------
     Altura do fundo animado

     O plano de luzes cobre a pagina inteira, mas com altura propria em vez
     de acompanhar o conteudo. Abrir uma duvida anima a altura da pagina; se
     o plano seguisse isso, os quatro gradientes seriam redimensionados e
     re-rasterizados 60x por segundo. Com o debounce, a altura e reescrita
     uma vez so, depois que a animacao termina.
     --------------------------------------------------------------------- */

  const aurora = document.querySelector(".aurora");

  if (aurora) {
    let pending;
    let applied = 0;

    const syncAurora = () => {
      // O plano nao comeca no topo do documento (a margem do KV desce o body),
      // entao a altura e medida a partir de onde ele realmente esta.
      const top = aurora.getBoundingClientRect().top + window.scrollY;
      const h = Math.round(document.documentElement.scrollHeight - top);
      // A margem evita um laco: o proprio plano conta para a altura rolavel.
      if (Math.abs(h - applied) < 4) return;
      applied = h;
      document.documentElement.style.setProperty("--aurora-h", `${h}px`);
    };

    const scheduleSync = () => {
      clearTimeout(pending);
      pending = setTimeout(syncAurora, 200);
    };

    syncAurora();
    window.addEventListener("load", syncAurora);
    window.addEventListener("resize", scheduleSync);
    if ("ResizeObserver" in window) new ResizeObserver(scheduleSync).observe(document.body);

    // O acordeao e a unica coisa que anima a altura da pagina. Ancorar no fim
    // da transicao garante que a medida seja a final, e nao um valor colhido
    // no meio do movimento.
    const faq = document.getElementById("faq");
    if (faq) {
      faq.addEventListener("transitionend", (e) => {
        if (e.propertyName === "grid-template-rows") scheduleSync();
      });
    }
  }

  /* ---------------------------------------------------------------------
     Scrollspy — marca a secao visivel no menu
     --------------------------------------------------------------------- */

  const sections = navLinks
    .map((link) => document.getElementById(link.dataset.nav))
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          navLinks.forEach((link) =>
            link.classList.toggle("is-active", link.dataset.nav === entry.target.id)
          );
        });
      },
      // Faixa estreita no meio da tela: so uma secao "vence" por vez.
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach((s) => spy.observe(s));
  }

})();
