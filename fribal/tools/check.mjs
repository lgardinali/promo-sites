/**
 * Verificação automática: erros de console, requisições falhas, peso da
 * página, acessibilidade básica e ausência de scroll horizontal.
 *
 *   node tools/check.mjs
 */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);

const URL = process.env.SITE_URL || 'http://localhost:4321';
const WIDTHS = [2560, 1920, 1440, 1280, 1024, 900, 768, 430, 390, 360, 320];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--disable-gpu', '--hide-scrollbars'],
});

let failures = 0;
const fail = (msg) => { failures++; console.log(`  FALHA  ${msg}`); };
const ok = (msg) => console.log(`  ok     ${msg}`);

/* ---------- 1. console, rede e peso ---------- */
{
  const p = await browser.newPage();
  const errors = [];
  const bad = [];
  let bytes = 0;

  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  p.on('requestfailed', (r) => bad.push(`${r.url()} (${r.failure()?.errorText})`));
  p.on('response', async (r) => {
    if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
    const len = Number(r.headers()['content-length'] || 0);
    bytes += len;
  });

  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.evaluate(async () => {
    const step = window.innerHeight * 0.7;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
  });
  await wait(1200);

  console.log('\nCONSOLE E REDE');
  errors.length ? errors.forEach((e) => fail(e)) : ok('sem erros nem avisos de console');
  bad.length ? bad.forEach((b) => fail(`recurso: ${b}`)) : ok('nenhuma requisição falhou');
  ok(`peso total transferido (página inteira, sem cache): ${kb(bytes)}`);

  const broken = await p.evaluate(() =>
    [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
  broken.length ? broken.forEach((b) => fail(`imagem quebrada: ${b}`)) : ok('todas as imagens carregaram');

  await p.close();
}

/* ---------- 2. sem scroll horizontal em nenhuma largura ---------- */
console.log('\nSCROLL HORIZONTAL');
for (const width of WIDTHS) {
  const p = await browser.newPage();
  await p.setViewport({ width, height: 900 });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
  await wait(300);

  const res = await p.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    culprits: [...document.querySelectorAll('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.right > document.documentElement.clientWidth + 2 && getComputedStyle(el).position !== 'fixed';
      })
      .slice(0, 4)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}`),
  }));

  if (res.scrollW > res.clientW + 1) {
    fail(`${width}px: scrollWidth ${res.scrollW} > ${res.clientW} — ${res.culprits.join(', ')}`);
  } else {
    ok(`${width}px sem transbordo`);
  }
  await p.close();
}

/* ---------- 3. acessibilidade básica ---------- */
{
  console.log('\nACESSIBILIDADE');
  const p = await browser.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL, { waitUntil: 'networkidle0' });

  const a11y = await p.evaluate(() => ({
    lang: document.documentElement.lang,
    h1: document.querySelectorAll('h1').length,
    imgsSemAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).length,
    linksSemNome: [...document.querySelectorAll('a, button')]
      .filter((el) => !el.textContent.trim() && !el.getAttribute('aria-label') && !el.querySelector('img[alt]:not([alt=""])'))
      .length,
    accordionsComAria: document.querySelectorAll('.faq__q[aria-expanded][aria-controls]').length,
    landmarks: ['header', 'main', 'footer', 'nav'].filter((t) => document.querySelector(t)).join(','),
    skipLink: !!document.querySelector('.skip-link'),
  }));

  a11y.lang === 'pt-BR' ? ok('lang="pt-BR"') : fail(`lang inesperado: ${a11y.lang}`);
  a11y.h1 === 1 ? ok('exatamente um <h1>') : fail(`${a11y.h1} elementos <h1>`);
  a11y.imgsSemAlt === 0 ? ok('todas as imagens têm alt') : fail(`${a11y.imgsSemAlt} imagens sem alt`);
  a11y.linksSemNome === 0 ? ok('todo link/botão tem nome acessível') : fail(`${a11y.linksSemNome} sem nome acessível`);
  a11y.accordionsComAria === 5 ? ok('5 accordions com aria-expanded/controls') : fail(`accordions com ARIA: ${a11y.accordionsComAria}`);
  ok(`landmarks: ${a11y.landmarks}`);
  a11y.skipLink ? ok('skip link presente') : fail('sem skip link');

  // navegação por teclado: Esc fecha o modal e devolve o foco
  const esconde = () => p.evaluate(() => document.getElementById('modal-cadastro').hidden);

  await p.click('.btn-login');
  await wait(500);
  (await esconde()) ? fail('modal não abriu ao clicar em Login/Cadastro') : ok('modal abre pelo botão de login');

  await p.keyboard.press('Escape');
  await wait(1000);
  (await esconde()) ? ok('modal fecha com Esc') : fail('modal continua aberto depois do Esc');

  const focoVolta = await p.evaluate(() => document.activeElement.classList.contains('btn-login'));
  focoVolta ? ok('foco volta para o gatilho ao fechar') : fail('foco não retornou ao gatilho');

  await p.close();
}

/* ---------- 4. sem JS o conteúdo continua visível ---------- */
{
  console.log('\nSEM JAVASCRIPT');
  const p = await browser.newPage();
  await p.setJavaScriptEnabled(false);
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL, { waitUntil: 'networkidle0' });

  const visivel = await p.evaluate(() => {
    const alvos = ['.step', '.winner', '.prize', '.notebook', '.faq__list'];
    return alvos.every((s) => {
      const el = document.querySelector(s);
      return el && getComputedStyle(el).opacity === '1';
    });
  });
  visivel ? ok('conteúdo visível sem JavaScript') : fail('conteúdo fica invisível sem JavaScript');
  await p.close();
}

/* ---------- 5. navegação por âncora e scrollspy ---------- */
{
  console.log('\nNAVEGAÇÃO');
  const p = await browser.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await wait(400);

  const alvos = [['#duvidas', 'Dúvidas frequentes'], ['#premios', 'Prêmios'], ['#ganhadores', 'Ganhadores']];

  for (const [hash, label] of alvos) {
    await p.click(`.nav__link[href="${hash}"]`);
    await wait(1200);

    const r = await p.evaluate((h) => ({
      top: Math.round(document.querySelector(h).getBoundingClientRect().top),
      ativo: document.querySelector('.nav__link.is-active')?.getAttribute('href'),
    }), hash);

    // com --scroll-offset de 90px a seção deve parar logo abaixo do menu
    Math.abs(r.top - 90) < 6
      ? ok(`${label}: alinhado abaixo do menu (top ${r.top}px)`)
      : fail(`${label}: top ${r.top}px, esperado ~90px`);

    r.ativo === hash ? ok(`${label}: item marcado como ativo`) : fail(`${label}: ativo é ${r.ativo}`);
  }
  await p.close();
}

console.log(failures ? `\n${failures} falha(s)\n` : '\nTudo certo\n');
await browser.close();
process.exit(failures ? 1 : 0);
