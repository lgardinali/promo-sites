import sharp from 'sharp';
const [src, left, top, width, height, out, scale] = process.argv.slice(2);
const p = sharp(src).extract({ left:+left, top:+top, width:+width, height:+height });
if (scale) p.resize({ width: Math.round(+width * +scale) });
await p.toFile(out);
console.log(out);
