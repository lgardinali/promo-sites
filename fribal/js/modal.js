/**
 * Modal de cadastro (nó 32:329 do Figma), aberto por todos os CTAs
 * "Cadastre-se" e pelo botão de login.
 *
 * Cuida do foco: prende o Tab dentro do diálogo enquanto ele está aberto e
 * devolve o foco ao elemento que o abriu no fechamento.
 */

import { afterTransition } from './transition.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function initModal({ reduced }) {
  const modal = document.getElementById('modal-cadastro');
  if (!modal) return;

  const dialog = modal.querySelector('.modal__dialog');
  let lastFocused = null;

  function open(trigger) {
    lastFocused = trigger || document.activeElement;

    modal.hidden = false;
    document.body.classList.add('is-locked');
    void modal.offsetHeight; // reflow para disparar a transição
    modal.classList.add('is-open');

    (dialog?.querySelector(FOCUSABLE) || dialog)?.focus({ preventScroll: true });
  }

  function close() {
    if (modal.hidden) return;

    modal.classList.remove('is-open');
    document.body.classList.remove('is-locked');

    const finish = () => { modal.hidden = true; };
    if (reduced) finish();
    else afterTransition(dialog, finish);

    lastFocused?.focus({ preventScroll: true });
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-open-modal]')) {
      event.preventDefault();
      open(event.target.closest('[data-open-modal]'));
      return;
    }
    if (event.target.closest('[data-close-modal]')) {
      event.preventDefault();
      close();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (modal.hidden) return;

    if (event.key === 'Escape') {
      close();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = [...(dialog?.querySelectorAll(FOCUSABLE) || [])]
      .filter((el) => el.offsetParent !== null);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}
