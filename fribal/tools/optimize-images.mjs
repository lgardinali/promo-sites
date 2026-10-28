/**
 * Otimiza os PNGs exportados do Figma (assets/raw) para assets/img.
 * Gera WebP em 1x e 2x mais um fallback PNG/JPG comprimido.
 * Uso: npm run build:img
 */
import { mkdir, readdir, copyFile, stat, rm } from 'node:fs/promises';
import { join, parse } from 'node:path';
import sharp from 'sharp';

const RAW = 'assets/raw';
const OUT_IMG = 'assets/img';
const OUT_SVG = 'assets/svg';

// largura de referencia (1x) de cada imagem, tirada do layout do Figma.
// o 2x sai do dobro, limitado ao tamanho original do arquivo.
const PLAN = {
  'bg-pattern-light': { w: 1920, fallback: 'jpg', quality: 72 },
  'bg-pattern-warm':  { w: 1920, fallback: 'jpg', quality: 72 },
  'strip-brown':      { w: 1952, fallback: 'jpg', quality: 78 },
  'personagens':      { w: 900,  fallback: 'png', quality: 82 },
  'kv-sempre':        { w: 340,  fallback: 'png', quality: 90 },
  'kv-presente':      { w: 580,  fallback: 'png', quality: 90 },
  'kv-selo':          { w: 366,  fallback: 'png', quality: 90 },
  'kv-laco':          { w: 170,  fallback: 'png', quality: 92 },
  'logo-fribal-neg':  { w: 180,  fallback: 'png', quality: 92 },
  'premio-motos':     { w: 520,  fallback: 'png', quality: 84 },
  'premio-carro':     { w: 500,  fallback: 'png', quality: 84 },
  'laco-fita-tag':    { w: 1100, fallback: 'png', quality: 80 },
};

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

async function run() {
  // recomeça do zero para não deixar variantes de execuções anteriores
  await rm(OUT_IMG, { recursive: true, force: true });
  await rm(OUT_SVG, { recursive: true, force: true });
  await mkdir(OUT_IMG, { recursive: true });
  await mkdir(OUT_SVG, { recursive: true });

  const files = await readdir(RAW);
  let rawTotal = 0;
  let outTotal = 0;

  for (const file of files) {
    const { name, ext } = parse(file);
    const src = join(RAW, file);
    rawTotal += (await stat(src)).size;

    // SVGs sao apenas copiados: ja sao vetoriais e leves.
    if (ext === '.svg') {
      const dest = join(OUT_SVG, file);
      await copyFile(src, dest);
      outTotal += (await stat(dest)).size;
      continue;
    }

    const cfg = PLAN[name];
    if (!cfg) {
      console.warn(`  ! sem plano de otimizacao para ${file}, copiando como esta`);
      const dest = join(OUT_IMG, file);
      await copyFile(src, dest);
      outTotal += (await stat(dest)).size;
      continue;
    }

    const meta = await sharp(src).metadata();

    // fallback primeiro: é a referência de tamanho para decidir sobre o WebP
    const fbDest = join(OUT_IMG, `${name}.${cfg.fallback}`);
    const pipeline = sharp(src).resize({ width: Math.round(cfg.w), withoutEnlargement: true });
    if (cfg.fallback === 'jpg') {
      await pipeline.jpeg({ quality: cfg.quality, mozjpeg: true }).toFile(fbDest);
    } else {
      await pipeline.png({ compressionLevel: 9, palette: true, quality: cfg.quality }).toFile(fbDest);
    }
    const fbSize = (await stat(fbDest)).size;
    outTotal += fbSize;

    const widths = [cfg.w, Math.min(cfg.w * 2, meta.width)];
    const sizes = [];

    for (let i = 0; i < widths.length; i++) {
      const width = Math.round(widths[i]);
      const suffix = i === 0 ? '' : '@2x';
      const dest = join(OUT_IMG, `${name}${suffix}.webp`);

      await sharp(src)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: cfg.quality, effort: 6 })
        .toFile(dest);

      const size = (await stat(dest)).size;

      // Em desenhos de cor chapada o PNG paletizado costuma vencer o WebP.
      // Nesses casos o arquivo extra só pesaria no repositório.
      if (i === 0 && size >= fbSize) {
        await rm(dest);
        sizes.push('webp descartado (maior que o fallback)');
        break;
      }

      outTotal += size;
      sizes.push(`${width}px ${kb(size)}`);
    }

    console.log(`  ${name.padEnd(20)} ${cfg.fallback} ${kb(fbSize)}  |  ${sizes.join('  |  ')}`);
  }

  console.log(`\n  bruto: ${kb(rawTotal)}  ->  otimizado: ${kb(outTotal)}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
