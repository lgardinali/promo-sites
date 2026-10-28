/* ==========================================================================
   Motion — Lenis + GSAP ScrollTrigger.

   Duas convencoes cobrem quase tudo:
     data-reveal="up|left|mask"   entrada ao aparecer na viewport
     data-parallax="0.2"          deslocamento proporcional ao scroll
     data-mouse="12"              deslocamento maximo em px seguindo o cursor

   As curvas replicam as molas do prototipo do Figma: "Slow" (power4.out) e
   "Bouncy" (back.out), com 300ms e 600ms de duracao.
   ========================================================================== */

window.Motion = (function () {
  /* Scroll suave (Lenis) — desligado por padrao.
     Ele reescreve a posicao do scroll a cada quadro; no Chromium isso custa
     pouco, mas no Firefox derruba os fps de forma perceptivel, e o scroll
     nativo de la ja e suave. Com ele desligado nada mais muda: o parallax e
     os reveals continuam pelo ScrollTrigger (que interpola sozinho via
     `scrub`) e as ancoras usam o `scroll-behavior: smooth` do CSS.
     Basta trocar para `true` para ter a inercia de volta. */
  const SMOOTH_SCROLL = false;

  const root = document.documentElement;
  const hasGsap = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Sem GSAP a pagina precisa voltar a ser visivel: base.css esconde os
  // elementos de reveal enquanto .has-motion estiver presente.
  if (!hasGsap || reduced) {
    root.classList.remove("has-motion");
    return { lenis: null, reduced: true };
  }

  gsap.registerPlugin(ScrollTrigger);

  const EASE_SLOW = "power4.out";
  const EASE_BOUNCY = "back.out(1.7)";
  const D_FAST = 0.3;
  const D_SLOW = 0.6;

  /* ======================================================================
     Scroll suave
     ====================================================================== */

  let lenis = null;

  if (SMOOTH_SCROLL && typeof Lenis !== "undefined") {
    lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
    });

    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* ======================================================================
     Reveals
     ====================================================================== */

  function initReveals() {
    // Ao terminar: marca o elemento (o CSS assume o estado final) e so entao
    // apaga os estilos inline. Assim nada volta a saltar e os hovers, que
    // tambem usam transform, deixam de brigar com o inline do GSAP.
    const settle = (el) => () => {
      el.classList.add("is-revealed");
      gsap.set(el, { clearProps: "all" });
    };

    gsap.utils.toArray("[data-reveal]").forEach((el) => {
      const kind = el.dataset.reveal;
      const delay = parseFloat(el.dataset.revealDelay || 0);
      const trigger = { trigger: el, start: "top 88%", once: true };

      if (kind === "mask") {
        const lines = el.querySelectorAll(".mask-line > span");
        gsap.set(el, { opacity: 1 });
        gsap.to(lines, {
          y: "0%",
          duration: D_SLOW,
          ease: EASE_SLOW,
          stagger: 0.08,
          delay,
          scrollTrigger: trigger,
          onComplete: () => {
            el.classList.add("is-revealed");
            gsap.set(lines, { clearProps: "all" });
            gsap.set(el, { clearProps: "all" });
          },
        });
        return;
      }

      gsap.to(el, {
        opacity: 1,
        x: 0,
        y: 0,
        duration: D_SLOW,
        ease: EASE_SLOW,
        delay,
        scrollTrigger: trigger,
        onComplete: settle(el),
      });
    });
  }

  /* ======================================================================
     Parallax simples (elementos que nao seguem o cursor)
     ====================================================================== */

  function initParallax() {
    gsap.utils.toArray("[data-parallax]").forEach((el) => {
      if (el.hasAttribute("data-kv-in")) return; // tratado pelo motor do KV
      const factor = parseFloat(el.dataset.parallax) || 0;
      const parent = el.parentElement;

      gsap.fromTo(
        el,
        { yPercent: -factor * 12 },
        {
          yPercent: factor * 12,
          ease: "none",
          scrollTrigger: { trigger: parent, start: "top bottom", end: "bottom top", scrub: 1 },
        }
      );
    });
  }

  /* ======================================================================
     KV — motor de camadas

     Intro, parallax de scroll e parallax de mouse escrevem em canais
     separados de um mesmo estado; um unico rAF compoe o transform final.
     Sem isso as tres animacoes brigariam pela mesma propriedade.
     (O `translate: -50% -50%` que centraliza as camadas fica no CSS e
     compoe com o transform, entao nao entra nesta conta.)
     ====================================================================== */

  function initKv() {
    const stage = document.querySelector(".kv__stage");
    if (!stage) return;

    const layers = gsap.utils.toArray("[data-kv-in]").map((el) => ({
      el,
      parallax: parseFloat(el.dataset.parallax || 0),
      mouse: parseFloat(el.dataset.mouse || 0),
      // "no-up": a arte encosta numa borda do frame (a Renata embaixo, o selo
      // em cima). Sem o trava, qualquer deslocamento negativo revelaria o
      // corte da imagem.
      noUp: el.dataset.clamp === "no-up",
      introX: 0, introY: 0,
      scrollY: 0,
      mx: 0, my: 0,     // alvo
      cx: 0, cy: 0,     // atual (interpolado)
    }));

    const byName = (name) => layers.find((l) => l.el.dataset.kvIn === name);

    function write(l) {
      let y = l.introY + l.scrollY + l.cy;
      // A entrada pode empurrar para cima de proposito; o trava so vale
      // depois que a intro termina.
      if (l.noUp && !intro.isActive() && y < 0) y = 0;
      l.el.style.transform =
        `translate3d(${(l.introX + l.cx).toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    }

    /* --- entrada --- */
    const intro = gsap.timeline({ defaults: { duration: D_SLOW, ease: EASE_SLOW } });

    function enter(name, from, ease) {
      const l = byName(name);
      if (!l) return;
      gsap.set(l.el, { opacity: 0 });
      Object.assign(l, from);
      write(l);
      intro.to(l.el, { opacity: 1, duration: D_SLOW }, "<0.08")
           .to(l, { introX: 0, introY: 0, ease: ease || EASE_SLOW, onUpdate: () => write(l) }, "<");
    }

    gsap.set(".kv__bg", { scale: 1.06 });
    intro.to(".kv__bg", { scale: 1, duration: 1.4, ease: EASE_SLOW }, 0);

    enter("logo", { introY: -40 });
    enter("produtos", { introX: 60 });
    enter("motos", { introX: 80 });
    enter("renata", { introX: -60 });
    enter("box", { introY: 30 });
    enter("produto", { introY: 40 });
    enter("selo", { introY: -70 }, EASE_BOUNCY);

    intro.from(".kv__actions .btn", { opacity: 0, y: 24, duration: D_SLOW, ease: EASE_BOUNCY, stagger: 0.1, clearProps: "transform" }, "<0.1");
    intro.from(".kv__scroll", { opacity: 0, duration: D_FAST }, "-=0.2");

    /* --- parallax de scroll --- */
    ScrollTrigger.create({
      trigger: ".kv",
      start: "top top",
      end: "bottom top",
      scrub: 1,
      onUpdate: (self) => {
        layers.forEach((l) => {
          l.scrollY = self.progress * l.parallax * 260;
          write(l);
        });
      },
    });

    /* --- parallax de mouse --- */
    const fine = window.matchMedia("(pointer: fine)");
    let raf = null;
    let active = false;

    function loop() {
      let moving = false;
      layers.forEach((l) => {
        if (!l.mouse) return;
        l.cx += (l.mx - l.cx) * 0.08;
        l.cy += (l.my - l.cy) * 0.08;
        if (Math.abs(l.mx - l.cx) > 0.05 || Math.abs(l.my - l.cy) > 0.05) moving = true;
        write(l);
      });
      raf = moving ? requestAnimationFrame(loop) : null;
    }

    function kick() {
      if (!raf) raf = requestAnimationFrame(loop);
    }

    function onMouse(e) {
      const r = stage.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      layers.forEach((l) => {
        l.mx = -nx * l.mouse;
        l.my = -ny * l.mouse;
      });
      kick();
    }

    function onLeave() {
      layers.forEach((l) => { l.mx = 0; l.my = 0; });
      kick();
    }

    function bindMouse(on) {
      if (on === active) return;
      active = on;
      if (on) {
        window.addEventListener("mousemove", onMouse, { passive: true });
        document.addEventListener("mouseleave", onLeave);
      } else {
        window.removeEventListener("mousemove", onMouse);
        document.removeEventListener("mouseleave", onLeave);
        onLeave();
      }
    }

    bindMouse(fine.matches);
    fine.addEventListener("change", (e) => bindMouse(e.matches));
  }

  /* ======================================================================
     Ganhadores — a linha se desenha e os marcadores acendem
     ====================================================================== */

  function initTimeline() {
    const rail = document.getElementById("timeline-progress");
    const wrap = document.getElementById("timeline");
    if (!rail || !wrap) return;

    gsap.to(rail, {
      scaleY: 1,
      ease: "none",
      scrollTrigger: { trigger: wrap, start: "top 72%", end: "bottom 85%", scrub: 0.6 },
    });

    gsap.utils.toArray(".draw").forEach((draw) => {
      ScrollTrigger.create({
        trigger: draw,
        start: "top 72%",
        once: true,
        onEnter: () => draw.classList.add("is-lit"),
      });
    });
  }

  /* ======================================================================
     Contagem dos valores do vendedor
     ====================================================================== */

  function initCounters() {
    gsap.utils.toArray("[data-count]").forEach((el) => {
      const target = Number(el.dataset.count);
      const state = { v: 0 };
      gsap.to(state, {
        v: target,
        duration: D_SLOW,
        ease: EASE_SLOW,
        onUpdate: () => { el.textContent = String(Math.round(state.v)); },
        scrollTrigger: { trigger: el, start: "top 90%", once: true },
      });
    });
  }

  /* ====================================================================== */

  initReveals();
  initParallax();
  initKv();
  initTimeline();
  initCounters();

  window.addEventListener("load", () => ScrollTrigger.refresh());

  return { lenis, reduced: false };
})();
