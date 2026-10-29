// Ajudantes de teste (temporário — removido ao final)
const st = document.createElement('style');
st.id = '__fz';
st.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
document.head.appendChild(st);
document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; });
document.documentElement.classList.add('is-ready');
document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-in'));
const p = document.createElement('div');
p.style.cssText = 'position:absolute;width:calc(var(--u) * 1000);height:0';
document.body.appendChild(p);
const U = p.getBoundingClientRect().width / 1000;
p.remove();
window.__U = U;
window.__m = (secSel, map) => {
  const sec = document.querySelector(secSel).getBoundingClientRect();
  const o = {};
  for (const [k, sel] of Object.entries(map)) {
    const el = document.querySelector(sel);
    if (!el) { o[k] = 'missing'; continue; }
    const r = el.getBoundingClientRect();
    o[k] = [(r.left - sec.left) / U, (r.top - sec.top) / U, r.width / U, r.height / U].map((v) => +v.toFixed(1)).join(',');
  }
  return o;
};
window.__secs = () => [...document.querySelectorAll('main > section, footer')].map((s) => (s.id || 'footer') + ':' + (s.getBoundingClientRect().height / U).toFixed(1));
window.__lines = (sel) => {
  const el = document.querySelector(sel);
  const r = document.createRange();
  r.selectNodeContents(el);
  return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
};
window.__ovf = () => {
  const w = document.documentElement.clientWidth;
  return { sw: document.documentElement.scrollWidth, cw: w, wide: [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.right > w + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.hero__strip, .ttl, .dsc__box, .hero__block, .cards__track, .menu, .deco'); }).slice(0, 6).map((e) => e.className || e.tagName) };
};
export default { U, cw: document.documentElement.clientWidth };
