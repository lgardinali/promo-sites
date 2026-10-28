/* ==========================================================================
   Carrossel de premios — coverflow com loop infinito.

   A posicao de cada item e uma funcao continua da distancia ate o centro,
   e nao um conjunto de estados discretos. Isso faz o arraste acompanhar o
   dedo com a mesma formula usada no snap, sem "pulo" ao soltar.
   ========================================================================== */

(function () {
  const root = document.getElementById("carousel");
  const track = document.getElementById("carousel-track");
  if (!root || !track) return;

  const viewport = root.querySelector(".carousel__viewport");
  const items = Array.from(track.children);
  const dots = Array.from(root.querySelectorAll(".carousel__dot"));
  const live = document.getElementById("carousel-live");
  const halo = root.querySelector(".carousel__halo");
  const n = items.length;
  if (!n) return;

  // Abre no item marcado como featured (as motos, como no Figma).
  let active = Math.max(0, PRIZES.findIndex((p) => p.featured));

  // Em telas estreitas as setas ficam sobre as bordas do palco e cobririam
  // qualquer "espiada" dos vizinhos. O Figma mobile mostra so o item central,
  // entao os laterais somem em vez de virar uma fatia atras da seta.
  const soloView = window.matchMedia("(max-width: 520px)");
  let spacing = 0;
  let dragging = false;
  let pointerId = null;
  let startX = 0;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  let dragFrac = 0;

  /* ---------------------------------------------------------------------
     Geometria
     --------------------------------------------------------------------- */

  function measure() {
    // offsetWidth ignora a escala aplicada pelo transform, ao contrario do
    // getBoundingClientRect: e a largura "de projeto" do item.
    const w = items[0].offsetWidth || 300;
    // Passo do carrossel proporcional ao item, calibrado para o vizinho
    // encostar no central sem cobri-lo (no Figma, 420 de passo para um item
    // central de 529 e vizinhos de 301).
    spacing = w * 0.83;
  }

  /** Menor distancia com sinal entre um item e o centro, considerando o loop. */
  function wrap(delta) {
    let d = delta;
    while (d > n / 2) d -= n;
    while (d < -n / 2) d += n;
    return d;
  }

  function apply(offsetFrac = 0) {
    items.forEach((item, i) => {
      const p = wrap(i - active - offsetFrac);
      const abs = Math.abs(p);

      // Quando um item cruza a emenda do loop (de +2 para -2, por exemplo),
      // a transicao o faria atravessar a tela inteira por tras dos outros.
      // Nesse quadro ele e teleportado, sem transicao.
      const jumped = item._p !== undefined && Math.abs(p - item._p) > n / 2;
      item._p = p;
      if (jumped) item.style.transition = "none";

      // 0.6 por passo: mesma hierarquia entre central e vizinho do Figma
      // (301 / 529 = 0.57), com uma folga para o vizinho seguir legivel.
      const scale = Math.pow(0.6, abs);
      const opacity = soloView.matches
        ? Math.max(0, 1 - abs * 2)
        : abs <= 1
          ? 1 - 0.25 * abs
          : Math.max(0, 0.75 - 0.4 * (abs - 1));
      const blur = Math.min(2, abs * 0.75);
      const rotate = Math.max(-20, Math.min(20, -p * 14));

      item.style.setProperty("--x", `${p * spacing}px`);
      item.style.setProperty("--s", scale.toFixed(4));
      item.style.setProperty("--o", opacity.toFixed(3));
      item.style.setProperty("--b", `${blur.toFixed(2)}px`);
      item.style.setProperty("--ry", `${rotate.toFixed(2)}deg`);
      item.style.setProperty("--z", String(100 - Math.round(abs * 10)));

      const isCenter = abs < 0.5;
      item.classList.toggle("is-active", isCenter);
      item.setAttribute("aria-hidden", opacity < 0.05 ? "true" : "false");

      // Reflow forcado antes de devolver a transicao: sem ele o navegador
      // agruparia as duas escritas e o teleporte voltaria a ser animado.
      if (jumped) {
        void item.offsetWidth;
        item.style.transition = "";
      }
    });
  }

  function syncChrome() {
    dots.forEach((dot, i) => {
      if (i === active) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
    if (live) live.textContent = `${PRIZES[active].title}, ${active + 1} de ${n}`;
    if (halo) {
      // Reinicia a respiracao do halo a cada troca, marcando o novo item.
      halo.style.animation = "none";
      void halo.offsetWidth;
      halo.style.animation = "";
    }
  }

  function goTo(index) {
    // Caminha pelo lado mais curto do circulo.
    active = (((index % n) + n) % n);
    apply();
    syncChrome();
  }

  function step(dir) {
    goTo(active + dir);
  }

  /* ---------------------------------------------------------------------
     Arraste (mouse, caneta e toque pelo mesmo caminho)
     --------------------------------------------------------------------- */

  function onDown(e) {
    if (e.button != null && e.button !== 0) return;
    dragging = true;
    pointerId = e.pointerId;
    startX = lastX = e.clientX;
    lastT = performance.now();
    velocity = 0;
    dragFrac = 0;
    track.classList.add("is-dragging");
    viewport.classList.add("is-dragging");
    viewport.setPointerCapture?.(pointerId);
  }

  function onMove(e) {
    if (!dragging || e.pointerId !== pointerId) return;
    const now = performance.now();
    const dt = now - lastT;
    if (dt > 0) velocity = (e.clientX - lastX) / dt;
    lastX = e.clientX;
    lastT = now;

    dragFrac = -(e.clientX - startX) / spacing;
    apply(dragFrac);
  }

  function onUp(e) {
    if (!dragging || (e.pointerId != null && e.pointerId !== pointerId)) return;
    dragging = false;
    track.classList.remove("is-dragging");
    viewport.classList.remove("is-dragging");
    viewport.releasePointerCapture?.(pointerId);

    // Um flick curto conta tanto quanto arrastar meio slide.
    const flick = Math.abs(velocity) > 0.45 ? Math.sign(velocity) * -1 : 0;
    let delta = Math.round(dragFrac);
    if (delta === 0 && flick !== 0 && Math.abs(dragFrac) > 0.04) delta = flick;
    if (delta === 0 && Math.abs(dragFrac) > 0.22) delta = Math.sign(dragFrac);

    dragFrac = 0;
    goTo(active + delta);
  }

  /* ---------------------------------------------------------------------
     Ligacoes
     --------------------------------------------------------------------- */

  viewport.addEventListener("pointerdown", onDown);
  viewport.addEventListener("pointermove", onMove);
  viewport.addEventListener("pointerup", onUp);
  viewport.addEventListener("pointercancel", onUp);
  viewport.addEventListener("lostpointercapture", onUp);
  viewport.addEventListener("dragstart", (e) => e.preventDefault());

  root.querySelector(".carousel__arrow--prev").addEventListener("click", () => step(-1));
  root.querySelector(".carousel__arrow--next").addEventListener("click", () => step(1));

  dots.forEach((dot) => dot.addEventListener("click", () => goTo(Number(dot.dataset.go))));

  // Clicar num item lateral o traz para o centro; um arraste nao dispara isso.
  items.forEach((item, i) => {
    item.addEventListener("click", () => {
      if (Math.abs(lastX - startX) > 6) return;
      if (i !== active) goTo(i);
    });
  });

  root.setAttribute("tabindex", "0");
  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
  });

  let resizeRaf;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => { measure(); apply(); });
  });

  soloView.addEventListener("change", () => apply());

  measure();
  apply();
  syncChrome();

  // As artes entram com tamanho intrinseco variavel; remede quando chegarem.
  window.addEventListener("load", () => { measure(); apply(); });
})();
