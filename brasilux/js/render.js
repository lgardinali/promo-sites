/* ==========================================================================
   Renderizacao do conteudo de data.js para o DOM.
   Roda antes de qualquer script de comportamento, para que carrossel, FAQ e
   motion ja encontrem os elementos prontos.
   ========================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Escapa texto vindo de dados antes de entrar em innerHTML. */
function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function html(target, markup) {
  if (target) target.innerHTML = markup;
}

/* -------------------------------------------------------------------------
   Menu
   ------------------------------------------------------------------------- */
function renderNav() {
  html(
    $("#nav-list"),
    NAV.map(
      (item) => `
      <li class="nav__item">
        <a class="nav__link" href="#${item.id}" data-nav="${item.id}">
          <span>${esc(item.label)}</span>
        </a>
      </li>`
    ).join("")
  );
}

/* -------------------------------------------------------------------------
   Como participar
   ------------------------------------------------------------------------- */
function renderSteps() {
  html(
    $("#steps"),
    STEPS.map(
      (step, i) => `
      <li class="step" data-reveal="up" data-reveal-delay="${i * 0.12}">
        <span class="step__num">${esc(step.number)}</span>
        <h3 class="step__title">${step.title.map((l) => `<span>${esc(l)}</span>`).join("")}</h3>
        <p class="step__text">${esc(step.text)}</p>
      </li>`
    ).join("")
  );
}

/* -------------------------------------------------------------------------
   Premios — itens do carrossel e cards do vendedor
   ------------------------------------------------------------------------- */
function renderPrizes() {
  html(
    $("#carousel-track"),
    PRIZES.map(
      (prize, i) => `
      <li class="prize" data-index="${i}" aria-roledescription="slide"
          aria-label="${i + 1} de ${PRIZES.length}: ${esc(prize.title)}">
        <span class="prize__badge"><b>${esc(prize.qty)}</b></span>
        <h3 class="prize__title">${esc(prize.title)}</h3>
        <p class="prize__sub">${esc(prize.subtitle)}</p>
        <div class="prize__media">
          <img src="${esc(prize.img)}" alt="${esc(prize.alt)}" loading="lazy" decoding="async"
               style="--scale:${prize.scale};--bleed:${prize.bleed}">
        </div>
      </li>`
    ).join("")
  );

  html(
    $("#carousel-dots"),
    PRIZES.map(
      (prize, i) => `
      <button class="carousel__dot" type="button" data-go="${i}"
              aria-label="Ver ${esc(prize.title)}"></button>`
    ).join("")
  );

  const money = (list) =>
    list
      .map(
        (item, i) => `
      <li class="seller__card" data-reveal="up" data-reveal-delay="${i * 0.1}">
        <p class="seller__value">
          <span class="seller__amount"><span class="seller__currency">R$</span><span class="seller__num" data-count="${item.value}">${item.value}</span> ${esc(item.unit)}</span>
          <span class="seller__label">${item.label.map((l) => `<span>${esc(l)}</span>`).join("")}</span>
        </p>
        <p class="seller__note">${esc(item.note)}</p>
      </li>`
      )
      .join("");

  html($("#seller"), money(SELLER_PRIZES));

  const legal = $("#prizes-legal");
  if (legal) legal.textContent = LEGAL_NOTE;

  const kvLegal = $("#kv-legal");
  if (kvLegal) kvLegal.textContent = LEGAL_NOTE;
}

/* -------------------------------------------------------------------------
   Duvidas frequentes
   ------------------------------------------------------------------------- */
function renderFaq() {
  html(
    $("#faq"),
    FAQ.map(
      (item, i) => `
      <li class="faq__item" data-reveal="up" data-reveal-delay="${Math.min(i, 5) * 0.06}">
        <h3 class="faq__heading">
          <button class="faq__trigger" type="button" id="faq-btn-${i}"
                  aria-expanded="false" aria-controls="faq-panel-${i}">
            <span class="faq__num">${String(i + 1).padStart(2, "0")}.</span>
            <span class="faq__q" data-q>${esc(item.q)}</span>
            <span class="faq__icon" aria-hidden="true">
              <img src="assets/icons/chevron.svg" alt="" width="11" height="22">
            </span>
          </button>
        </h3>
        <div class="faq__panel" id="faq-panel-${i}" role="region" aria-labelledby="faq-btn-${i}">
          <div class="faq__panel-inner"><p>${esc(item.a)}</p></div>
        </div>
      </li>`
    ).join("")
  );
}

/* -------------------------------------------------------------------------
   Ganhadores
   ------------------------------------------------------------------------- */
function renderWinners() {
  html(
    $("#winners"),
    WINNERS.map(
      (draw) => `
      <li class="draw" data-reveal="left">
        <span class="draw__dot" aria-hidden="true"></span>
        <div class="draw__body">
          <div class="draw__head">
            <h3 class="draw__name">${esc(draw.draw)}</h3>
            <span class="draw__date">${esc(draw.date)}</span>
          </div>
          <ul class="draw__people">
            ${draw.people
              .map(
                (p) => `
              <li class="winner" data-uf="${esc(p.uf)}" data-search="${esc(`${p.name} ${p.cpf} ${p.prize} ${UF_NAMES[p.uf] || ""}`)}">
                <img class="winner__avatar" src="assets/icons/avatar-ganhador.svg" alt=""
                     width="44" height="44" loading="lazy" aria-hidden="true">
                <span class="winner__id">
                  <b class="winner__name">${esc(p.name)}</b>
                  <span class="winner__cpf">CPF: ${esc(p.cpf)}</span>
                </span>
                <span class="winner__prize">Prêmio: ${esc(p.prize)}</span>
              </li>`
              )
              .join("")}
          </ul>
        </div>
      </li>`
    ).join("")
  );
}

/* -------------------------------------------------------------------------
   Rodape
   ------------------------------------------------------------------------- */
function renderFooter() {
  html(
    $("#footer-cols"),
    FOOTER.columns
      .map(
        (col) => `
      <nav class="footer__col" aria-label="${esc(col.title)}">
        <h3 class="footer__col-title">${esc(col.title)}</h3>
        <ul>
          ${col.links
            .map((l) => `<li><a class="footer__link" href="${esc(l.href)}"><span>${esc(l.label)}</span></a></li>`)
            .join("")}
        </ul>
      </nav>`
      )
      .join("")
  );

  html(
    $("#social"),
    FOOTER.social
      .map(
        (s) => `
      <li>
        <a class="social__link" href="${esc(s.href)}" aria-label="${esc(s.name)}">
          <img src="assets/icons/${esc(s.icon)}.svg" alt="" width="32" height="32">
        </a>
      </li>`
      )
      .join("")
  );

  const legal = $("#footer-legal");
  if (legal) legal.textContent = FOOTER.legal;
}

renderNav();
renderSteps();
renderPrizes();
renderFaq();
renderWinners();
renderFooter();
