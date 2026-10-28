/**
 * Executa uma ação quando a transição do elemento termina, com prazo máximo.
 *
 * Depender só de `transitionend` é frágil: o evento não dispara se a transição
 * não chegar a começar, e transições de filhos borbulham e disparariam cedo
 * demais. Aqui o alvo é verificado e há um limite de tempo como rede de
 * segurança — sem ele, um modal poderia ficar preso aberto.
 */
export function afterTransition(el, done, timeout = 800) {
  if (!el) {
    done();
    return;
  }

  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    el.removeEventListener('transitionend', onEnd);
    clearTimeout(timer);
    done();
  };

  const onEnd = (event) => {
    if (event.target === el) finish();
  };

  const timer = setTimeout(finish, timeout);
  el.addEventListener('transitionend', onEnd);
}
