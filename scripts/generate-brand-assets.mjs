/** Editable SVG masters + deterministic raster exports. Run npm run brand:generate. */
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const root = new URL('../public/', import.meta.url);
const save = (path, data) => writeFile(new URL(path, root), data);
await mkdir(new URL('brand/', root), { recursive: true });
await mkdir(new URL('social/', root), { recursive: true });
const navy = '#0d2638';
const teal = '#76dbc3';
const paper = '#f5f4ee';
const escape = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const text = (x, y, size, value, fill = navy, weight = 400, extra = '') =>
  `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" ${extra}>${escape(value)}</text>`;
const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g font-family="Arial, Helvetica, sans-serif">${body}</g></svg>`;
const mark = (x, y, size, bg = navy) =>
  `<g transform="translate(${x} ${y}) scale(${size / 64})"><rect width="64" height="64" rx="15" fill="${bg}"/><path d="M20 13h20l9 9v28H20z" fill="none" stroke="${paper}" stroke-width="3.5" stroke-linejoin="round"/><path d="M39 13v10h10M14 19v32M27 30h12" fill="none" stroke="${paper}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><path d="m27 40 6 6 13-14" fill="none" stroke="${teal}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></g>`;
const brand = (x, y, size = 40, color = navy) =>
  `${mark(x, y, size)}${text(x + size + 14, y + size * 0.7, size * 0.62, 'ContractLedger AI', color, 700)}`;
// A conceptual workflow illustration, deliberately without fake product measurements.
const record = (
  x,
  y,
  scale = 1,
) => `<g transform="translate(${x} ${y}) scale(${scale})">
<rect x="22" y="-20" width="342" height="326" rx="18" fill="#b9d6cf"/>
<rect width="342" height="326" rx="18" fill="${navy}"/>
<rect x="26" y="28" width="4" height="30" rx="2" fill="${teal}"/>
${text(44, 49, 14, 'THE ACCOUNTABLE RECORD', paper, 700, 'letter-spacing="1.5"')}
<path d="M26 78h290" stroke="#385362"/>
${text(28, 111, 11, '01 / SOURCE', teal, 700, 'letter-spacing="1.8"')}
${text(28, 139, 21, 'A page. A quote.', paper, 600)}
${text(28, 179, 11, '02 / REVIEW', teal, 700, 'letter-spacing="1.8"')}
${text(28, 207, 21, 'A human decision.', paper, 600)}
${text(28, 247, 11, '03 / REGISTER', teal, 700, 'letter-spacing="1.8"')}
${text(28, 275, 21, 'A traceable record.', paper, 600)}
<circle cx="304" cy="269" r="14" fill="${teal}"/><path d="m297 269 5 5 9-10" fill="none" stroke="${navy}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
</g>`;
const footer = (w, h, pad = 56) =>
  `<path d="M${pad} ${h - 83}H${w - pad}" stroke="#c5d0cc"/>${text(pad, h - 40, 14, 'SELINA ARMSTRONG  /  PORTFOLIO PROJECT', navy, 600, 'letter-spacing="1.2"')}${text(w - pad, h - 40, 14, 'contractledger.selinaq.com', navy, 400, 'text-anchor="end"')}`;
const wide = (w, h) =>
  svg(
    w,
    h,
    `<rect width="${w}" height="${h}" fill="${paper}"/><rect x="${w - 420}" width="420" height="${h - 84}" fill="#e1e9e3"/>${brand(56, 48)}${text(56, 175, 13, 'AI-ASSISTED CONTRACT & SUPPLIER OPERATIONS', navy, 700, 'letter-spacing="1.5"')}${text(52, 257, 64, 'From contracts', navy, 700, 'letter-spacing="-2.5"')}${text(52, 329, 64, 'to accountable', navy, 700, 'letter-spacing="-2.5"')}${text(52, 401, 64, 'records.', navy, 700, 'letter-spacing="-2.5"')}${text(56, 452, 20, 'Source-traceable. Human-verified. Rule-driven.')}${record(w - 410, 159, 0.99)}${footer(w, h)}`,
  );
const social = (w, h, zh = false) =>
  svg(
    w,
    h,
    `<rect width="${w}" height="${h}" fill="${paper}"/><path d="M780 0h300v${h - 84}H780z" fill="#e1e9e3"/>${brand(64, 56, 48)}${text(64, 188, 15, 'AI-ASSISTED CONTRACT & SUPPLIER OPERATIONS', navy, 700, 'letter-spacing="1.6"')}${text(59, 288, zh ? 76 : 86, zh ? '让合同变成' : 'From contracts', navy, 700, 'letter-spacing="-3"')}${text(59, 386, zh ? 76 : 86, zh ? '可追溯的记录。' : 'to accountable', navy, 700, 'letter-spacing="-3"')}${zh ? '' : text(59, 484, 86, 'records.', navy, 700, 'letter-spacing="-3"')}${text(64, zh ? 465 : 548, 24, zh ? 'AI 辅助提取 · 人工核验 · 规则驱动' : 'Source-traceable. Human-verified. Rule-driven.')}${record(64, h === 1080 ? 624 : 720, h === 1080 ? 0.92 : 1.38)}${text(h === 1080 ? 444 : 602, h === 1080 ? 684 : 816, 14, 'BUILT FOR REVIEW', navy, 700, 'letter-spacing="1.5"')}${text(h === 1080 ? 444 : 602, h === 1080 ? 728 : 860, 26, 'Contracts & suppliers', navy, 600)}${text(h === 1080 ? 444 : 602, h === 1080 ? 770 : 904, 23, 'Approvals & obligations')}${text(h === 1080 ? 444 : 602, h === 1080 ? 812 : 948, 23, 'Evidence & audit history')}${text(h === 1080 ? 444 : 602, h === 1080 ? 873 : 1024, 17, 'Portfolio demo · Fictional data', '#45616b')}${footer(w, h, 64)}`,
  );
const banner = svg(
  1584,
  396,
  `<rect width="1584" height="396" fill="${navy}"/><path d="M430 0h6v396h-6z" fill="${teal}"/>${mark(100, 100, 130)}${brand(498, 47, 38, paper)}${text(495, 175, 58, 'From contracts to', paper, 700, 'letter-spacing="-1.7"')}${text(495, 243, 58, 'accountable records.', paper, 700, 'letter-spacing="-1.7"')}${text(498, 305, 21, 'Source-traceable. Human-verified. Rule-driven.', teal)}${text(498, 359, 15, 'SELINA ARMSTRONG  /  PORTFOLIO PROJECT', paper, 500, 'letter-spacing="1.5"')}`,
);
const assets = [
  ['contractledger-og', wide(1200, 630)],
  ['github-social', wide(1280, 640)],
  ['social-square', social(1080, 1080)],
  ['social-portrait', social(1080, 1350)],
  ['social-square-zh', social(1080, 1080, true)],
  ['linkedin-banner', banner],
];
for (const [name, source] of assets) {
  await save(`social/${name}.svg`, source);
  await sharp(Buffer.from(source))
    .png()
    .toFile(new URL(`social/${name}.png`, root).pathname);
}
await sharp(Buffer.from(assets[0][1]))
  .jpeg({ quality: 92, mozjpeg: true })
  .toFile(new URL('og.jpg', root).pathname);
const icon = svg(64, 64, mark(0, 0, 64));
await save('favicon.svg', icon);
await save('brand/mark.svg', icon);
await save('brand/wordmark.svg', svg(490, 80, brand(8, 8, 64)));
await save('brand/wordmark-on-dark.svg', svg(490, 80, brand(8, 8, 64, paper)));
await save(
  'brand/mark-monochrome.svg',
  icon
    .replaceAll(teal, navy)
    .replaceAll(paper, navy)
    .replace(`<rect width="64" height="64" rx="15" fill="${navy}"/>`, ''),
);
for (const [name, size] of [
  ['favicon-16.png', 16],
  ['favicon-32.png', 32],
  ['favicon-48.png', 48],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  await sharp(Buffer.from(icon))
    .resize(size, size)
    .png()
    .toFile(new URL(name, root).pathname);
}
const maskable = svg(
  512,
  512,
  `<rect width="512" height="512" fill="${navy}"/>${mark(80, 80, 352)}`,
);
await sharp(Buffer.from(maskable))
  .png()
  .toFile(new URL('icon-maskable-512.png', root).pathname);
// ICO embeds PNG payloads in a standard multi-size ICONDIR container.
const sizes = [16, 32, 48];
const pngs = await Promise.all(
  sizes.map((s) => sharp(Buffer.from(icon)).resize(s, s).png().toBuffer()),
);
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (let i = 0; i < sizes.length; i++) {
  const p = 6 + 16 * i;
  header[p] = sizes[i];
  header[p + 1] = sizes[i];
  header.writeUInt16LE(1, p + 4);
  header.writeUInt16LE(32, p + 6);
  header.writeUInt32LE(pngs[i].length, p + 8);
  header.writeUInt32LE(offset, p + 12);
  offset += pngs[i].length;
}
await save('favicon.ico', Buffer.concat([header, ...pngs]));
console.log(
  `Generated ${assets.length} social designs, editable wordmarks, favicon family and app icons.`,
);
