import { initHeader, smoothScrollTo } from './menu.js';
import { initReveal } from './reveal.js';
import { initScrollFx } from './parallax.js';
import { initAccordion } from './accordion.js';
import { initModal } from './modal.js';

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const ctx = { reduced: motionQuery.matches };

/* ==========================================================================
   Molduras com badge encaixado na borda
   O anel é desenhado em CSS e mascarado; o vão precisa acompanhar a largura
   real do badge, que muda com a fonte e o breakpoint.
   ========================================================================== */
function initFrames() {
  const frames = [...document.querySelectorAll('[data-frame]')];
  if (!frames.length) return;

  const sync = (frame) => {
    const badge = frame.querySelector('[data-frame-badge]');
    if (!badge) return;
    // metade da largura do badge + folga de cada lado
    frame.style.setProperty('--frame-gap', `${badge.offsetWidth / 2 + 18}px`);
  };

  frames.forEach(sync);

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const frame = entry.target.closest('[data-frame]');
        if (frame) sync(frame);
      }
    });
    frames.forEach((frame) => {
      const badge = frame.querySelector('[data-frame-badge]');
      if (badge) observer.observe(badge);
    });
  } else {
    window.addEventListener('resize', () => frames.forEach(sync), { passive: true });
  }

  // As fontes só chegam depois do primeiro paint: remede quando carregarem.
  document.fonts?.ready.then(() => frames.forEach(sync));
}

/* ==========================================================================
   Logo da campanha — variante "bouncy"
   Reproduz a troca Default -> Variant2 do componente LOGO CAMPANHA:
   o lettering "presente" cresce e o laço gira -4,11°.
   ========================================================================== */
function initKvLogo() {
  const logo = document.querySelector('[data-kv-logo]');
  if (!logo || ctx.reduced) return;

  // Pop de entrada, uma vez, depois de a página assentar.
  const intro = setTimeout(() => {
    logo.classList.add('is-pop');
    setTimeout(() => logo.classList.remove('is-pop'), 620);
  }, 700);

  const card = logo.closest('.kv__card') || logo;
  card.addEventListener('pointerenter', () => {
    clearTimeout(intro);
    logo.classList.add('is-pop');
  });
  card.addEventListener('pointerleave', () => logo.classList.remove('is-pop'));
}

/* ==========================================================================
   Voltar ao topo
   ========================================================================== */
function initToTop() {
  document.querySelector('[data-to-top]')?.addEventListener('click', () => {
    smoothScrollTo(0, { duration: 900, reduced: ctx.reduced });
  });
}

/* ==========================================================================
   Bootstrap
   ========================================================================== */
function start() {
  initFrames();
  initHeader(ctx);
  initReveal(ctx);
  initScrollFx(ctx);
  initAccordion();
  initModal(ctx);
  initKvLogo();
  initToTop();

  document.documentElement.classList.add('is-ready');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}

// Se a preferência de movimento mudar, recarrega o estado dos reveals.
motionQuery.addEventListener('change', (event) => {
  ctx.reduced = event.matches;
  if (event.matches) {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'));
  }
});
