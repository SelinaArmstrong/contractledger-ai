/** Integration checks over rendered HTTP responses, not source-code snapshots. */
import assert from 'node:assert/strict';
import sharp from 'sharp';

const base = new URL(process.argv[2] || 'http://127.0.0.1:3011');
const canonicalOrigin = new URL(
  process.argv[3] || 'https://contractledger.selinaq.com',
).origin;
let checks = 0;
async function request(path) {
  const response = await fetch(new URL(path, base), {
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.status, 200, `${path}: HTTP 200`);
  return response;
}
const decode = (s) =>
  s
    .replaceAll('&amp;', '&')
    .replaceAll('&#x27;', "'")
    .replaceAll('&quot;', '"');
function attrs(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, k, v]) => [k, decode(v)]),
  );
}
function meta(html, key) {
  return [...html.matchAll(/<meta\s[^>]*>/g)]
    .map(([tag]) => attrs(tag))
    .find((a) => a.name === key || a.property === key)?.content;
}
for (const [path, canonicalPath, index] of [
  ['/', '/', true],
  ['/about', '/about', true],
  ['/?view=contracts', '/', false],
  ['/?login=1', '/', false],
  ['/?auth_error=invalid', '/', false],
  ['/about?utm_source=linkedin', '/about', true],
]) {
  const html = await (await request(path)).text();
  const links = [...html.matchAll(/<link\s[^>]*>/g)].map(([tag]) => attrs(tag));
  const canonical = links.filter((a) => a.rel === 'canonical');
  assert.equal(canonical.length, 1, `${path}: one canonical`);
  assert.equal(
    new URL(canonical[0].href).href,
    canonicalOrigin + canonicalPath,
  );
  assert.equal(
    meta(html, 'robots')?.split(',')[0].trim(),
    index ? 'index' : 'noindex',
    `${path}: robots`,
  );
  assert.equal(
    new URL(meta(html, 'og:url')).href,
    canonicalOrigin + canonicalPath,
  );
  assert.equal(
    meta(html, 'og:image'),
    `${canonicalOrigin}/social/contractledger-og.png`,
  );
  assert.equal(meta(html, 'og:image:width'), '1200');
  assert.equal(meta(html, 'og:image:height'), '630');
  assert.equal(meta(html, 'twitter:card'), 'summary_large_image');
  assert.ok(meta(html, 'og:image:alt'));
  assert.ok(meta(html, 'description')?.length > 80);
  assert.ok(links.some((a) => a.rel === 'icon' && a.href === '/favicon.svg'));
  if (path === '/about' || path === '/') {
    const data = [
      ...html.matchAll(
        /<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs,
      ),
    ].map((m) => JSON.parse(m[1]));
    assert.ok(data.length, `${path}: server-rendered structured data`);
    if (path === '/about') {
      assert.equal([...html.matchAll(/<h1[\s>]/g)].length, 1);
      assert.ok(html.includes('What is ContractLedger AI?'));
      assert.ok(
        data.some((d) =>
          d['@graph']?.some((e) => e['@type'] === 'SoftwareApplication'),
        ),
      );
    } else assert.ok(data.some((d) => d['@type'] === 'WebSite'));
  }
  checks++;
  console.log(`PASS page ${path}`);
}
const robots = await (await request('/robots.txt')).text();
assert.ok(robots.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`));
assert.ok(robots.includes('Disallow: /api/'));
assert.ok(robots.includes('Disallow: /demo-documents/'));
assert.ok(!robots.includes('Disallow: /?'));
const sitemap = await (await request('/sitemap.xml')).text();
assert.deepEqual(
  [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]),
  [canonicalOrigin + '/', canonicalOrigin + '/about'],
);
const manifest = await (await request('/manifest.webmanifest')).json();
assert.equal(manifest.name, 'ContractLedger AI');
for (const icon of manifest.icons) {
  const data = await (await request(icon.src)).arrayBuffer();
  const m = await sharp(Buffer.from(data)).metadata();
  assert.equal(`${m.width}x${m.height}`, icon.sizes);
}
for (const [path, width, height] of [
  ['/favicon-16.png', 16, 16],
  ['/favicon-32.png', 32, 32],
  ['/favicon-48.png', 48, 48],
  ['/apple-touch-icon.png', 180, 180],
  ['/social/contractledger-og.png', 1200, 630],
  ['/og.jpg', 1200, 630],
  ['/social/github-social.png', 1280, 640],
  ['/social/social-square.png', 1080, 1080],
  ['/social/social-portrait.png', 1080, 1350],
  ['/social/social-square-zh.png', 1080, 1080],
  ['/social/linkedin-banner.png', 1584, 396],
]) {
  const response = await request(path);
  assert.ok(
    response.headers.get('content-type')?.startsWith('image/'),
    `${path}: image content type`,
  );
  const metadata = await sharp(
    Buffer.from(await response.arrayBuffer()),
  ).metadata();
  assert.equal(metadata.width, width, path);
  assert.equal(metadata.height, height, path);
  checks++;
}
const ico = Buffer.from(await (await request('/favicon.ico')).arrayBuffer());
assert.equal(ico.readUInt16LE(2), 1);
assert.equal(ico.readUInt16LE(4), 3);
const favicon = await (await request('/favicon.svg')).text();
assert.ok(favicon.includes('<svg'));
console.log(
  `PASS ${checks} page/image cases, robots, sitemap, manifest icons and ICO container.`,
);
