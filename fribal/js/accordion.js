/**
 * Accordion das dúvidas frequentes.
 *
 * Abre um item por vez, como no layout do Figma. A animação de altura é
 * feita em CSS (grid-template-rows: 0fr -> 1fr), então aqui só cuidamos do
 * estado e do ARIA.
 */
export function initAccordion() {
  const items = [...document.querySelectorAll('.faq__item')];
  if (!items.length) return;

  const setOpen = (item, open) => {
    const button = item.querySelector('.faq__q');
    item.classList.toggle('is-open', open);
    button?.setAttribute('aria-expanded', String(open));
  };

  // Garante que o estado inicial do HTML e o do ARIA batem.
  for (const item of items) {
    setOpen(item, item.classList.contains('is-open'));
  }

  for (const item of items) {
    const button = item.querySelector('.faq__q');
    if (!button) continue;

    button.addEventListener('click', () => {
      const willOpen = !item.classList.contains('is-open');
      for (const other of items) setOpen(other, other === item && willOpen);
    });
  }
}
