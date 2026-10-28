/**
 * Captura os estados interativos para conferência: hovers, accordion aberto,
 * menu mobile, modal de cadastro e a variante "bouncy" do logo.
 *
 *   node tools/states.mjs
 */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);

const OUT = process.env.SHOT_DIR || '.';
const URL = process.env.SITE_URL || 'http://localhost:4321';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb'],
});

async function page(width, height = 900) {
  const p = await browser.newPage();
  await p.setViewport({ width, height, deviceScaleFactor: 1 });
  await p.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
  await p.evaluate(() => document.fonts.ready);
  // percorre a página para disparar reveals e lazy-loading
  await p.evaluate(async () => {
    const step = window.innerHeight * 0.7;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 70));
    }
  });
  return p;
}

/** Rola até o elemento e o centraliza, sem a animação de scroll da página. */
async function focusOn(p, selector, extra = 0) {
  await p.evaluate((sel, ex) => {
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect();
    window.scrollTo(0, window.scrollY + r.top - window.innerHeight / 2 + r.height / 2 + ex);
  }, selector, extra);
  await wait(500);
}

/* ---------- desktop: hovers ---------- */
{
  const p = await page(1440);

  await focusOn(p, '.step');
  await p.hover('.step:nth-child(2)');
  await wait(600);
  await p.screenshot({ path: `${OUT}/s-step-hover.png`, clip: await clipOf(p, '.steps', 40) });

  await focusOn(p, '.winners__grid');
  await p.hover('.winner:nth-child(2)');
  await wait(600);
  await p.screenshot({ path: `${OUT}/s-winner-hover.png`, clip: await clipOf(p, '.winners__grid', 30) });

  await focusOn(p, '.frame--participar .btn--cta');
  await p.hover('.frame--participar .btn--cta');
  await wait(400);
  await p.screenshot({ path: `${OUT}/s-cta-hover.png`, clip: await clipOf(p, '.frame--participar .btn--cta', 40) });

  // menu: hover num item + estado "grudado"
  await p.evaluate(() => window.scrollTo(0, 600));
  await wait(500);
  await p.hover('.nav__link:nth-child(1)');
  await p.hover('[href="#premios"].nav__link');
  await wait(500);
  await p.screenshot({ path: `${OUT}/s-menu-hover.png`, clip: { x: 0, y: 600, width: 1440, height: 90 } });

  // logo da campanha na variante bouncy
  await p.evaluate(() => window.scrollTo(0, 0));
  await wait(400);
  await p.hover('.kv__card');
  await wait(800);
  await p.screenshot({ path: `${OUT}/s-logo-pop.png`, clip: await clipOf(p, '.kv-logo', 30) });

  // accordion: abre o terceiro item
  await focusOn(p, '.faq__list');
  await p.click('#faq-q3');
  await wait(700);
  await p.screenshot({ path: `${OUT}/s-faq-open.png`, clip: await clipOf(p, '.faq__list', 20) });

  // modal
  await p.click('.btn-login');
  await wait(900);
  await p.screenshot({ path: `${OUT}/s-modal.png` });

  await p.close();
}

/* ---------- mobile: menu aberto ---------- */
{
  const p = await page(390, 844);
  await p.evaluate(() => window.scrollTo(0, 0));
  await wait(300);
  await p.click('.burger');
  await wait(900);
  await p.screenshot({ path: `${OUT}/s-menu-mobile.png` });
  await p.close();
}

/* ---------- movimento reduzido ---------- */
{
  const p = await browser.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  await wait(600);
  await p.screenshot({ path: `${OUT}/s-reduced-motion.png` });
  await p.close();
}

async function clipOf(p, selector, pad = 0) {
  return p.evaluate((sel, padding) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    // page.screenshot({clip}) usa coordenadas do documento, não da viewport
    return {
      x: Math.max(0, r.x + window.scrollX - padding),
      y: Math.max(0, r.y + window.scrollY - padding),
      width: r.width + padding * 2,
      height: r.height + padding * 2,
    };
  }, selector, pad);
}

console.log('estados capturados em', OUT);
await browser.close();
