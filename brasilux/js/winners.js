/* ==========================================================================
   Ganhadores — mapa do Brasil clicavel + busca.

   O SVG do mapa (assets/icons/brazil-map.svg) tem 27 <path data-uf="UF">,
   um por estado + DF. Ele e injetado no DOM (nao usado como <img>) porque
   precisa ser estilizado e receber clique por estado.

   Dois filtros convivem sobre a mesma lista de ganhadores:
     - clique no mapa  -> filtra por UF
     - campo de busca  -> filtra por texto (nome, CPF, premio, estado)
   Os dois se combinam (E logico); a paleta do mapa reflete sempre a
   distribuicao completa dos dados, independente da busca.
   ========================================================================== */

(function () {
  const mapHost = document.getElementById("brazil-map");
  const list = document.getElementById("winners");
  if (!mapHost || !list) return;

  const draws = Array.from(list.children);
  const people = Array.from(list.querySelectorAll(".winner"));

  const searchInput = document.getElementById("winners-search");
  const clearBtn = document.getElementById("winners-clear");
  const empty = document.getElementById("winners-empty");
  const filterChip = document.getElementById("winners-filter");
  const filterState = document.getElementById("winners-filter-state");
  const filterClear = document.getElementById("winners-filter-clear");
  const totalEl = document.getElementById("map-total");
  const legendMax = document.getElementById("map-legend-max");

  let activeUf = null;

  /* ---------------------------------------------------------------------
     Contagem por estado, a partir dos proprios ganhadores renderizados.
     --------------------------------------------------------------------- */

  const counts = {};
  let total = 0;
  people.forEach((li) => {
    const uf = li.dataset.uf;
    if (!uf) return;
    counts[uf] = (counts[uf] || 0) + 1;
    total++;
  });
  const maxCount = Math.max(0, ...Object.values(counts));

  if (totalEl) {
    totalEl.textContent = `Temos um total de ${total} ${total === 1 ? "ganhador" : "ganhadores"} no Brasil.`;
  }
  if (legendMax) legendMax.textContent = String(maxCount);

  /* ---------------------------------------------------------------------
     Mapa — busca o SVG, injeta, colore e liga os cliques
     --------------------------------------------------------------------- */

  function colorFor(count) {
    if (!count) return "rgba(255, 255, 255, 0.06)";
    const t = maxCount > 1 ? count / maxCount : 1;
    const alpha = 0.35 + t * 0.55;
    return `rgba(188, 255, 0, ${alpha.toFixed(2)})`;
  }

  fetch("assets/icons/brazil-map.svg")
    .then((res) => (res.ok ? res.text() : Promise.reject(res.status)))
    .then((svg) => {
      mapHost.innerHTML = svg;
      const svgEl = mapHost.querySelector("svg");
      if (svgEl) {
        svgEl.setAttribute("role", "presentation");
        svgEl.setAttribute("focusable", "false");
      }

      mapHost.querySelectorAll("path[data-uf]").forEach((path) => {
        const uf = path.dataset.uf;
        const n = counts[uf] || 0;
        const name = UF_NAMES[uf] || uf;

        path.classList.add("map__state");
        path.style.fill = colorFor(n);
        path.setAttribute("tabindex", "0");
        path.setAttribute("role", "button");
        path.setAttribute("aria-pressed", "false");
        path.setAttribute("aria-label", `${name}: ${n} ${n === 1 ? "ganhador" : "ganhadores"}`);

        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = `${name} — ${n} ${n === 1 ? "ganhador" : "ganhadores"}`;
        path.appendChild(title);

        path.addEventListener("click", () => toggleUf(uf));
        path.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleUf(uf);
          }
        });
      });
    })
    .catch(() => {
      // Sem o mapa a pagina continua utilizavel: busca e lista seguem ativas.
      mapHost.hidden = true;
    });

  function syncMapSelection() {
    mapHost.querySelectorAll("path[data-uf]").forEach((path) => {
      const isActive = path.dataset.uf === activeUf;
      path.classList.toggle("is-active", isActive);
      path.setAttribute("aria-pressed", String(isActive));
    });
  }

  /* ---------------------------------------------------------------------
     Filtro por estado
     --------------------------------------------------------------------- */

  function toggleUf(uf) {
    activeUf = activeUf === uf ? null : uf;
    syncMapSelection();

    if (filterChip) filterChip.hidden = !activeUf;
    if (filterState) filterState.textContent = activeUf ? UF_NAMES[activeUf] || activeUf : "";

    applyFilters();
  }

  if (filterClear) {
    filterClear.addEventListener("click", () => {
      activeUf = null;
      syncMapSelection();
      if (filterChip) filterChip.hidden = true;
      applyFilters();
    });
  }

  /* ---------------------------------------------------------------------
     Busca por texto — mesma normalizacao acento-insensivel do FAQ.
     --------------------------------------------------------------------- */

  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  function applyFilters() {
    const term = norm((searchInput && searchInput.value.trim()) || "");
    let shown = 0;

    people.forEach((li) => {
      const matchesUf = !activeUf || li.dataset.uf === activeUf;
      const matchesTerm = !term || norm(li.dataset.search || "").includes(term);
      const visible = matchesUf && matchesTerm;
      li.hidden = !visible;
      if (visible) shown++;
    });

    draws.forEach((draw) => {
      const anyVisible = Array.from(draw.querySelectorAll(".winner")).some((li) => !li.hidden);
      draw.hidden = !anyVisible;
    });

    if (empty) empty.hidden = shown > 0;
    if (clearBtn) clearBtn.hidden = !term;
  }

  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        searchInput.value = "";
        applyFilters();
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      applyFilters();
      searchInput.focus();
    });
  }
})();
