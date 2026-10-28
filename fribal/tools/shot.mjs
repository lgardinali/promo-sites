/**
 * Capturas para conferência visual, usando o Chrome já instalado.
 *
 *   node tools/shot.mjs <largura> <arquivo> [--full] [--y=<scroll>] [--sel=<css>] [--dark]
 *
 * Exemplos:
 *   node tools/shot.mjs 1440 desktop.png --full
 *   node tools/shot.mjs 390 mobile-kv.png
 *   node tools/shot.mjs 1440 premios.png --sel=.prize
 */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);

const OUT_DIR = process.env.SHOT_DIR || '.';
const URL = process.env.SITE_URL || 'http://localhost:4321';

const [widthArg, file, ...flags] = process.argv.slice(2);
const width = Number(widthArg) || 1440;
const full = flags.includes('--full');
const scrollY = Number(flags.find((f) => f.startsWith('--y='))?.slice(4)) || 0;
const selector = flags.find((f) => f.startsWith('--sel='))?.slice(6);
const height = Number(flags.find((f) => f.startsWith('--h='))?.slice(4)) || 900;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb'],
});

const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });

// Deixa fontes e primeiras animações assentarem.
await page.evaluate(() => document.fonts.ready);

if (full) {
  // Percorre a página inteira para disparar os reveals e o lazy-loading, e
  // volta ao topo com o parallax zerado — assim a captura mostra o estado
  // "assentado" de cada seção em vez de um instante da animação.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.6;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
    window.scrollTo(0, 0);
  });
  await new Promise((r) => setTimeout(r, 1200));
  await page.evaluate(() => {
    document.querySelectorAll('[data-parallax]').forEach((el) => {
      el.style.setProperty('--parallax', '0px');
    });
  });
} else if (scrollY) {
  await page.evaluate((y) => window.scrollTo(0, y), scrollY);
}

await new Promise((r) => setTimeout(r, 700));

const path = `${OUT_DIR}/${file}`;
if (selector) {
  const el = await page.$(selector);
  await el.screenshot({ path });
} else {
  await page.screenshot({ path, fullPage: full, captureBeyondViewport: full });
}

console.log(path);
await browser.close();
