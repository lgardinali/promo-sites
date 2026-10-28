/* ==========================================================================
   Duvidas frequentes — acordeao (um aberto por vez) + busca com realce.
   ========================================================================== */

(function () {
  const list = document.getElementById("faq");
  const input = document.getElementById("faq-search");
  const clearBtn = document.getElementById("faq-clear");
  const empty = document.getElementById("faq-empty");
  if (!list) return;

  const items = Array.from(list.children);
  const triggers = items.map((li) => li.querySelector(".faq__trigger"));

  /* ---------------------------------------------------------------------
     Acordeao
     --------------------------------------------------------------------- */

  function open(index, force) {
    items.forEach((li, i) => {
      const isOpen = i === index ? (force ?? !li.classList.contains("is-open")) : false;
      li.classList.toggle("is-open", isOpen);
      triggers[i].setAttribute("aria-expanded", String(isOpen));
    });
  }

  triggers.forEach((btn, i) => btn.addEventListener("click", () => open(i)));

  // Setas navegam entre as perguntas, como num conjunto de abas.
  list.addEventListener("keydown", (e) => {
    const i = triggers.indexOf(document.activeElement);
    if (i < 0) return;
    const visible = triggers.filter((t) => !t.closest(".faq__item").hidden);
    const pos = visible.indexOf(triggers[i]);
    let next = null;
    if (e.key === "ArrowDown") next = visible[(pos + 1) % visible.length];
    if (e.key === "ArrowUp") next = visible[(pos - 1 + visible.length) % visible.length];
    if (e.key === "Home") next = visible[0];
    if (e.key === "End") next = visible[visible.length - 1];
    if (next) { e.preventDefault(); next.focus(); }
  });

  // O Figma mostra a primeira duvida ja aberta.
  open(0, true);

  /* ---------------------------------------------------------------------
     Busca
     --------------------------------------------------------------------- */

  /** Remove acentos para que "duvida" encontre "dúvida". */
  const norm = (s) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  function highlight(el, original, term) {
    if (!term) {
      el.textContent = original;
      return;
    }
    const haystack = norm(original);
    const needle = norm(term);
    let out = "";
    let from = 0;
    let at = haystack.indexOf(needle, from);
    while (at !== -1) {
      out += escapeHtml(original.slice(from, at));
      out += `<mark>${escapeHtml(original.slice(at, at + term.length))}</mark>`;
      from = at + term.length;
      at = haystack.indexOf(needle, from);
    }
    out += escapeHtml(original.slice(from));
    el.innerHTML = out;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  function filter(term) {
    const t = term.trim();
    const needle = norm(t);
    let shown = 0;

    items.forEach((li, i) => {
      const source = FAQ[i];
      const hit =
        !needle ||
        norm(source.q).includes(needle) ||
        norm(source.a).includes(needle);

      li.hidden = !hit;
      if (hit) shown++;
      highlight(li.querySelector("[data-q]"), source.q, t);
    });

    if (empty) empty.hidden = shown > 0;
    if (clearBtn) clearBtn.hidden = !t;

    // Com uma busca ativa, abrir o unico resultado poupa um clique.
    if (needle && shown === 1) {
      open(items.findIndex((li) => !li.hidden), true);
    }
  }

  if (input) {
    input.addEventListener("input", () => filter(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { input.value = ""; filter(""); }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      input.value = "";
      filter("");
      input.focus();
    });
  }
})();
