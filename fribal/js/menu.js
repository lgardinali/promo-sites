import { EASE_SLOW } from './easing.js';
import { afterTransition } from './transition.js';

/* ==========================================================================
   Scroll ancorado com a curva "Slow" do Figma
   ========================================================================== */

let scrollRAF = null;

function cancelSmoothScroll() {
  if (scrollRAF !== null) {
    cancelAnimationFrame(scrollRAF);
    scrollRAF = null;
  }
}

/** Limita a posição ao trecho rolável atual. */
function clampScroll(y) {
  return Math.max(0, Math.min(y, document.documentElement.scrollHeight - window.innerHeight));
}

/**
 * Rola até o destino seguindo a curva Slow; qualquer gesto do usuário cancela.
 *
 * `target` pode ser uma função: ela é reavaliada a cada quadro, de modo que
 * imagens que terminam de carregar durante a animação — e empurram o layout —
 * não deixem a página parar alguns pixels fora do lugar.
 */
export function smoothScrollTo(target, { duration = 700, reduced = false } = {}) {
  cancelSmoothScroll();

  const resolve = typeof target === 'function' ? target : () => target;
  const from = window.scrollY;

  if (reduced || Math.abs(clampScroll(resolve()) - from) < 2) {
    window.scrollTo(0, clampScroll(resolve()));
    return;
  }

  const started = performance.now();

  const step = (now) => {
    const t = Math.min((now - started) / duration, 1);
    const to = clampScroll(resolve());
    window.scrollTo(0, from + (to - from) * EASE_SLOW(t));
    scrollRAF = t < 1 ? requestAnimationFrame(step) : null;
  };

  scrollRAF = requestAnimationFrame(step);
}

/** Recuo do topo, para a seção parar logo abaixo do menu fixo. */
function scrollOffset() {
  return parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--scroll-offset')
  ) || 90;
}

/* ==========================================================================
   Menu
   ========================================================================== */

export function initHeader({ reduced }) {
  const header = document.querySelector('[data-header]');
  const burger = document.querySelector('.burger');
  const panel = document.getElementById('menu-mobile');

  /* ---------- menu mobile ---------- */
  function openMenu() {
    if (!panel || !burger) return;
    panel.hidden = false;
    void panel.offsetHeight; // reflow, para a transição de altura acontecer
    panel.classList.add('is-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Fechar menu');
  }

  function closeMenu() {
    if (!panel || !burger || burger.getAttribute('aria-expanded') !== 'true') return;
    panel.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Abrir menu');

    const done = () => { panel.hidden = true; };
    if (reduced) done();
    else afterTransition(panel, done);
  }

  burger?.addEventListener('click', () => {
    if (burger.getAttribute('aria-expanded') === 'true') closeMenu();
    else openMenu();
  });

  /* ---------- links âncora ---------- */
  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-scroll]');
    if (!link) return;

    const hash = link.getAttribute('href');
    if (!hash || !hash.startsWith('#')) return;

    const section = document.querySelector(hash);
    if (!section) return;

    event.preventDefault();
    closeMenu();
    smoothScrollTo(
      () => window.scrollY + section.getBoundingClientRect().top - scrollOffset(),
      { reduced }
    );

    // Mantém o hash na URL sem provocar o salto do navegador.
    history.replaceState(null, '', hash);
  });

  // Qualquer rolagem manual interrompe a animação em curso.
  for (const type of ['wheel', 'touchstart', 'keydown']) {
    window.addEventListener(type, cancelSmoothScroll, { passive: true });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (burger?.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      burger.focus();
    }
  });

  // Fecha ao clicar fora do cabeçalho.
  document.addEventListener('click', (event) => {
    if (burger?.getAttribute('aria-expanded') !== 'true') return;
    if (!header?.contains(event.target)) closeMenu();
  });

  // Ao voltar para desktop, o painel não deve ficar preso aberto.
  window.matchMedia('(min-width: 861px)')
    .addEventListener('change', (event) => { if (event.matches) closeMenu(); });

  initSpy();
}

/**
 * Marca no menu a seção visível: entre as que já passaram pela linha do
 * cabeçalho, a que estiver mais próxima dela.
 *
 * A comparação é por posição na página, não pela ordem do menu — "Ganhadores"
 * aparece depois de "Dúvidas frequentes" na navegação, mas antes dela no
 * documento.
 */
function initSpy() {
  const pairs = [...document.querySelectorAll('[data-spy]')]
    .map((link) => ({ link, section: document.querySelector(link.getAttribute('href')) }))
    .filter((pair) => pair.section);

  if (!pairs.length) return;

  let ticking = false;

  const check = () => {
    ticking = false;

    const line = scrollOffset() + 40;

    let current = null;
    let closest = -Infinity;

    for (const pair of pairs) {
      const top = pair.section.getBoundingClientRect().top;
      if (top <= line && top > closest) {
        closest = top;
        current = pair;
      }
    }

    // antes da primeira seção cruzar a linha, o primeiro item fica ativo
    if (!current) current = pairs[0];

    for (const pair of pairs) {
      pair.link.classList.toggle('is-active', pair === current);
    }
  };

  const request = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(check);
  };

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request, { passive: true });
  check();
}
