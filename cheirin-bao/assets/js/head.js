/* ==========================================================================
   Carregado no <head>, de forma síncrona (é pequeno e fica em cache):
   prepara o estado antes da 1ª pintura e cuida da transição entre páginas.
   ========================================================================== */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');

  /* Relógio comum: os loops decorativos (flutuar/zoom) ficam na mesma fase em
     todas as páginas, então o banner compartilhado não "pula" na troca. */
  root.style.setProperty('--clock', -(Date.now() % 86400000) + 'ms');

  var KEY = 'cb-shared-banner';
  var BANNER_PAGES = /(como-participar|duvidas-frequentes|lojas-participantes|ganhadores|cadastro)\.html$/;

  function store(v) { try { sessionStorage.setItem(KEY, v); } catch (e) {} }
  function take() {
    try { var v = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); return v; } catch (e) { return null; }
  }
  function banner() { return document.querySelector('.page-banner'); }
  function header() { return document.querySelector('.site-header'); }

  /* O banner só é compartilhado se estiver ao menos metade visível */
  function bannerShareable() {
    var b = banner();
    return !!b && window.scrollY < b.offsetHeight * 0.5;
  }
  function pageHasBanner(href) {
    // com âncora (#regulamento etc.) a página nova abre rolada: banner fora da tela
    try { var u = new URL(href, location.href); return !u.hash && BANNER_PAGES.test(u.pathname); } catch (e) { return false; }
  }

  /* Chegou de uma página com o mesmo banner visível: ele não se re-anima */
  if (take() === '1') root.classList.add('from-banner');

  /* API usada pelo fallback em main.js (navegadores sem View Transitions) */
  window.CBTransition = {
    shareBannerWith: function (href) {
      var share = bannerShareable() && pageHasBanner(href);
      store(share ? '1' : '0');
      return share;
    },
  };

  /* ---------- View Transitions entre documentos ---------- */

  // Página que sai: decide o que fica fixo antes do snapshot
  window.addEventListener('pageswap', function (e) {
    if (!e.viewTransition) return;
    var to = e.activation && e.activation.entry ? e.activation.entry.url : null;
    var share = bannerShareable() && (!to || pageHasBanner(to));
    var b = banner();
    if (b) b.style.viewTransitionName = share ? '' : 'none';
    if (share) root.classList.add('vt-leaving'); // banner sem paralaxe no snapshot
    // menu mobile aberto: o header fica por baixo dele, então entra no crossfade geral
    var menu = document.getElementById('mobile-menu');
    var h = header();
    if (h) h.style.viewTransitionName = menu && parseFloat(getComputedStyle(menu).opacity) > 0.02 ? 'none' : '';
    store(share ? '1' : '0');
  });

  // Página que entra
  window.addEventListener('pagereveal', function (e) {
    if (!e.viewTransition) return;
    var b = banner();
    if (b && !(root.classList.contains('from-banner') && bannerShareable())) b.style.viewTransitionName = 'none';
    e.viewTransition.finished.then(function () {
      if (b) b.style.viewTransitionName = '';
    }, function () {});
  });

  // Voltar pelo histórico (bfcache): limpa estados de saída
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    root.classList.remove('vt-leaving', 'is-leaving', 'keep-banner');
    var b = banner(), h = header();
    if (b) b.style.viewTransitionName = '';
    if (h) h.style.viewTransitionName = '';
  });
})();
