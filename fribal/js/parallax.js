/**
 * Efeitos ligados ao scroll, todos num único loop de requestAnimationFrame:
 * barra de progresso, estado fixo do cabeçalho, botão "voltar ao topo" e
 * parallax. Um loop só evita concorrência entre listeners e mantém as
 * leituras de layout agrupadas.
 */
export function initScrollFx({ reduced }) {
  const bar = document.querySelector('[data-progress-bar]');
  const header = document.querySelector('[data-header]');
  const toTop = document.querySelector('[data-to-top]');

  const desktop = window.matchMedia('(min-width: 768px)');
  let layers = [];

  const collect = () => {
    layers = (reduced || !desktop.matches)
      ? []
      : [...document.querySelectorAll('[data-parallax]')].map((el) => ({
          el,
          rate: parseFloat(el.dataset.parallax) || 0.1,
        }));

    // Ao desligar o parallax, zera o deslocamento que tenha ficado aplicado.
    if (!layers.length) {
      document.querySelectorAll('[data-parallax]').forEach((el) => {
        el.style.setProperty('--parallax', '0px');
      });
    }
  };

  collect();
  desktop.addEventListener('change', collect);

  let ticking = false;

  const update = () => {
    ticking = false;

    const y = window.scrollY;
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;

    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
    if (header) header.classList.toggle('is-stuck', y > 80);
    if (toTop) toTop.classList.toggle('is-visible', y > vh * 0.7);

    for (const layer of layers) {
      const rect = layer.el.getBoundingClientRect();
      if (rect.bottom < -240 || rect.top > vh + 240) continue;

      // Deslocamento proporcional à distância do centro do elemento até o
      // centro da viewport: zero quando está centralizado.
      const distance = rect.top + rect.height / 2 - vh / 2;
      layer.el.style.setProperty('--parallax', `${(-distance * layer.rate).toFixed(1)}px`);
    }
  };

  const request = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request, { passive: true });
  update();
}
