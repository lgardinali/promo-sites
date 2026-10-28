/**
 * Entrada gradual dos elementos conforme o scroll.
 *
 * A verificação é feita no scroll (agrupada num requestAnimationFrame) em vez
 * de IntersectionObserver: os blocos altos — o "caderno" das lojas, o bloco de
 * prêmios — nunca atingiriam um threshold razoável em telas pequenas, e a
 * lista encolhe a cada item revelado, então o custo é desprezível.
 */
export function initReveal({ reduced }) {
  let items = [...document.querySelectorAll('.reveal')];
  if (!items.length) return;

  if (reduced) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }

  let ticking = false;

  const check = () => {
    ticking = false;

    // Revela quando o topo do elemento cruza 88% da altura da viewport.
    const limit = window.innerHeight * 0.88;

    items = items.filter((el) => {
      if (el.getBoundingClientRect().top > limit) return true;
      el.classList.add('is-in');
      return false;
    });

    if (!items.length) {
      window.removeEventListener('scroll', request);
      window.removeEventListener('resize', request);
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

  // As fontes e imagens mudam a altura da página depois do primeiro paint.
  document.fonts?.ready.then(check);
  window.addEventListener('load', check, { once: true });
}
