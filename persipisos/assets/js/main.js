/* =============================================================================
   PERSIPISOS — interações e animações
   JavaScript nativo, zero dependências.

   01. Helpers
   02. Scroll reveal (entrada gradual dos elementos)
   03. Header: estado "stuck", barra de progresso e link ativo
   04. Drawer mobile
   05. Accordion de dúvidas frequentes
   06. Busca nas dúvidas
   07. Botão "voltar ao topo"
   ========================================================================== */
(function () {
  "use strict";

  /* ============================ 01. HELPERS ============================ */
  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduceMotion = motionQuery.matches;
  motionQuery.addEventListener("change", function (e) { reduceMotion = e.matches; });

  /* scrollingElement é mais confiável que window.scrollY em webviews e
     navegadores com emulação de viewport, onde scrollY pode vir defasado. */
  function scrollTop() {
    var se = document.scrollingElement || document.documentElement;
    return se.scrollTop || window.scrollY || 0;
  }

  /* Agrupa leituras de scroll num único rAF para não travar a rolagem. */
  var scrollTasks = [];
  var ticking = false;
  function onScroll(fn) { scrollTasks.push(fn); }
  function runScrollTasks() {
    var y = scrollTop();
    for (var i = 0; i < scrollTasks.length; i++) scrollTasks[i](y);
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(runScrollTasks); }
  }, { passive: true });

  /* ========================= 02. SCROLL REVEAL ========================= */
  (function scrollReveal() {
    var items = $$(".reveal");
    if (!items.length) return;

    // Sem IntersectionObserver (ou com movimento reduzido): mostra tudo.
    if (!("IntersectionObserver" in window) || reduceMotion) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    items.forEach(function (el) {
      var delay = parseInt(el.getAttribute("data-delay"), 10);
      if (delay) el.style.setProperty("--reveal-delay", delay + "ms");
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -60px 0px", threshold: 0 });

    items.forEach(function (el) { io.observe(el); });

    // Rede de segurança: depois que fontes e imagens assentam o layout, garante
    // que nada que já esteja na viewport tenha ficado invisível.
    window.addEventListener("load", function () {
      items.forEach(function (el) {
        if (el.classList.contains("is-visible")) return;
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) {
          el.classList.add("is-visible");
          io.unobserve(el);
        }
      });
    });
  })();

  /* ============ 03. HEADER: STUCK + PROGRESSO + LINK ATIVO ============ */
  (function headerBehaviour() {
    var header = $("#header");
    var bar = $("#scrollBar");

    if (header) {
      onScroll(function (y) { header.classList.toggle("is-stuck", y > 8); });
    }

    if (bar) {
      onScroll(function (y) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        var pct = max > 0 ? (y / max) * 100 : 0;
        bar.style.width = Math.min(100, Math.max(0, pct)).toFixed(2) + "%";
      });
    }

    // Marca o link do menu correspondente à seção visível.
    var links = $$(".nav__link");
    if (!links.length || !("IntersectionObserver" in window)) return;

    var byId = {};
    var sections = [];
    links.forEach(function (link) {
      var id = (link.getAttribute("href") || "").replace("#", "");
      var section = id && document.getElementById(id);
      if (!section) return;
      byId[id] = link;
      sections.push(section);
    });

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = byId[entry.target.id];
        if (!link) return;
        if (entry.isIntersecting) {
          links.forEach(function (l) { l.classList.remove("is-active"); });
          link.classList.add("is-active");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });

    sections.forEach(function (s) { spy.observe(s); });
  })();

  /* ========================== 04. DRAWER MOBILE ========================== */
  (function mobileDrawer() {
    var burger = $("#burger");
    var drawer = $("#mobileMenu");
    if (!burger || !drawer) return;

    var panel = $(".drawer__panel", drawer);
    var lastFocused = null;
    var closeTimer = null;

    // Índices para a entrada escalonada dos itens.
    $$(".drawer__list li", drawer).forEach(function (li, i) { li.style.setProperty("--i", i); });
    var cta = $(".drawer__cta", drawer);
    if (cta) cta.style.setProperty("--i", $$(".drawer__list li", drawer).length);

    function focusables() {
      return $$("a[href], button:not([disabled])", panel)
        .filter(function (el) { return el.offsetParent !== null; });
    }

    function open() {
      window.clearTimeout(closeTimer);
      lastFocused = document.activeElement;
      drawer.hidden = false;
      // Força um reflow para que a transição de entrada seja aplicada.
      void drawer.offsetWidth;
      drawer.classList.add("is-open");
      burger.setAttribute("aria-expanded", "true");
      burger.setAttribute("aria-label", "Fechar menu");
      document.body.style.overflow = "hidden";
      var first = focusables()[0];
      if (first) first.focus();
      document.addEventListener("keydown", onKeydown);
    }

    function close() {
      drawer.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-label", "Abrir menu");
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeydown);
      if (lastFocused && lastFocused.focus) lastFocused.focus();
      closeTimer = window.setTimeout(function () { drawer.hidden = true; }, reduceMotion ? 0 : 600);
    }

    function onKeydown(e) {
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "Tab") return;

      var list = focusables();
      if (!list.length) return;
      var first = list[0];
      var last = list[list.length - 1];

      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    burger.addEventListener("click", function () {
      if (drawer.classList.contains("is-open")) close(); else open();
    });

    $$("[data-close-drawer]", drawer).forEach(function (el) {
      el.addEventListener("click", close);
    });

    // Fecha ao navegar para uma âncora.
    $$("a[href^='#']", drawer).forEach(function (a) {
      a.addEventListener("click", close);
    });

    // Se voltar ao desktop com o menu aberto, fecha para não travar o scroll.
    window.matchMedia("(min-width: 1024px)").addEventListener("change", function (e) {
      if (e.matches && drawer.classList.contains("is-open")) close();
    });
  })();

  /* ====================== 05. ACCORDION DE DÚVIDAS ====================== */
  (function faqAccordion() {
    var triggers = $$(".faq__trigger");
    if (!triggers.length) return;

    // true = apenas uma dúvida aberta por vez (comportamento do layout no Figma).
    var SINGLE_OPEN = true;

    triggers.forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        var item = trigger.closest(".faq__item");
        var isOpen = trigger.getAttribute("aria-expanded") === "true";

        if (SINGLE_OPEN && !isOpen) {
          triggers.forEach(function (other) {
            if (other === trigger) return;
            other.setAttribute("aria-expanded", "false");
            var otherItem = other.closest(".faq__item");
            if (otherItem) otherItem.classList.remove("is-open");
          });
        }

        trigger.setAttribute("aria-expanded", isOpen ? "false" : "true");
        if (item) item.classList.toggle("is-open", !isOpen);
      });
    });
  })();

  /* ======================== 06. BUSCA NAS DÚVIDAS ======================== */
  (function faqSearch() {
    var input = $("#faqSearch");
    var list = $("#faqList");
    var empty = $("#faqEmpty");
    if (!input || !list) return;

    var items = $$(".faq__item", list);

    // Remove acentos para que "duvida" encontre "dúvida".
    function normalize(str) {
      return str.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    }

    var cache = items.map(function (item) {
      return { el: item, text: normalize(item.textContent || "") };
    });

    var debounce;
    input.addEventListener("input", function () {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(function () {
        var term = normalize(input.value);
        var found = 0;

        cache.forEach(function (entry) {
          var match = !term || entry.text.indexOf(term) !== -1;
          entry.el.hidden = !match;
          if (match) found++;
          // Fecha itens filtrados para não deixar painéis abertos escondidos.
          if (!match) {
            entry.el.classList.remove("is-open");
            var t = $(".faq__trigger", entry.el);
            if (t) t.setAttribute("aria-expanded", "false");
          }
        });

        if (empty) empty.hidden = found !== 0;
      }, 140);
    });
  })();

  /* ======================== 07. VOLTAR AO TOPO ======================== */
  (function backToTop() {
    var btn = $("#toTop");
    if (!btn) return;

    onScroll(function (y) { btn.classList.toggle("is-visible", y > window.innerHeight * 0.8); });

    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  })();

  // Estado inicial (quando a página abre já rolada, ex.: reload ou âncora).
  window.requestAnimationFrame(runScrollTasks);
})();
