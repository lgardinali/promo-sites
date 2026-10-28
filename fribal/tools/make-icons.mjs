/**
 * Gera os favicons (a partir do nó 7:850 do Figma) e a imagem de
 * compartilhamento (Open Graph), compondo as peças exportadas do design.
 * Uso: npm run build:icons
 */
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const RAW = 'assets/raw';
const ICONS = 'assets/icons';
const IMG = 'assets/img';

const BROWN = '#a33f17';

/* --------------------------------------------------------------------------
   Logo da campanha composto num canvas transparente de 500 x 354,
   nas mesmas proporções do componente LOGO CAMPANHA.
   -------------------------------------------------------------------------- */
async function campaignLogo(width) {
  const scale = width / 500.077;
  const height = Math.round(354 * scale);

  const layer = async (file, x, y, w) => ({
    input: await sharp(`${RAW}/${file}`)
      .resize({ width: Math.round(w * scale) })
      .toBuffer(),
    left: Math.round(x * scale),
    top: Math.round(y * scale),
  });

  return sharp({
    create: { width: Math.round(width), height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      await layer('kv-laco.png', 185.1, 0, 130.173),
      await layer('kv-sempre.png', 76.18, 87.78, 339.864),
      await layer('kv-presente.png', 0, 146.26, 500.077),
      await layer('kv-selo.png', 80.09, 278.25, 365.834),
    ])
    .png()
    .toBuffer();
}

/* --------------------------------------------------------------------------
   Favicon — moldura marrom arredondada, fundo padronado e o laço ao centro
   -------------------------------------------------------------------------- */
async function favicon(size) {
  const k = size / 128;                 // o desenho original tem 128 px
  const border = Math.round(7 * k);
  const radius = Math.round(36 * k);

  // O fundo é o padrão bege ampliado, alinhado à esquerda (como no Figma).
  const background = await sharp(`${RAW}/bg-pattern-light.png`)
    .resize({ width: Math.round(size * 3.0242), height: size, fit: 'cover', position: 'left top' })
    .extract({ left: 0, top: 0, width: size, height: size })
    .toBuffer();

  const bow = await sharp(`${RAW}/kv-laco.png`)
    .resize({ width: Math.round(86.305 * k) })
    .toBuffer();

  const frame = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
       <rect x="${border / 2}" y="${border / 2}"
             width="${size - border}" height="${size - border}"
             rx="${radius}" fill="none" stroke="${BROWN}" stroke-width="${border}"/>
     </svg>`
  );

  const mask = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
       <rect width="${size}" height="${size}" rx="${radius}" fill="#fff"/>
     </svg>`
  );

  return sharp(background)
    .composite([
      { input: bow, left: Math.round(13.85 * k), top: Math.round(38.66 * k) },
      { input: frame },
      { input: mask, blend: 'dest-in' },
    ])
    .png()
    .toBuffer();
}

/* --------------------------------------------------------------------------
   Imagem de compartilhamento 1200 x 630
   -------------------------------------------------------------------------- */
async function ogImage() {
  const W = 1200;
  const H = 630;

  const background = await sharp(`${RAW}/bg-pattern-light.png`)
    .resize({ width: W, height: H, fit: 'cover' })
    .toBuffer();

  const photo = await sharp(`${RAW}/personagens.png`)
    .resize({ height: Math.round(H * 0.94) })
    .toBuffer();
  const photoMeta = await sharp(photo).metadata();

  const logo = await campaignLogo(430);
  const logoMeta = await sharp(logo).metadata();

  return sharp(background)
    .composite([
      { input: photo, left: W - photoMeta.width + 40, top: H - photoMeta.height },
      { input: logo, left: 78, top: Math.round((H - logoMeta.height) / 2) - 20 },
    ])
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(`${IMG}/og-image.jpg`);
}

/* -------------------------------------------------------------------------- */

async function run() {
  await mkdir(ICONS, { recursive: true });

  const sizes = [
    [16, 'favicon-16.png'],
    [32, 'favicon-32.png'],
    [180, 'apple-touch-icon.png'],
    [192, 'icon-192.png'],
    [512, 'icon-512.png'],
  ];

  for (const [size, name] of sizes) {
    await sharp(await favicon(size)).toFile(`${ICONS}/${name}`);
    console.log(`  ${name}`);
  }

  await ogImage();
  console.log('  og-image.jpg');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
