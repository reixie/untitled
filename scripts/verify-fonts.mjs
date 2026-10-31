/* global document, getComputedStyle, NodeFilter, requestAnimationFrame, performance */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, URL } from 'node:url';

// Run by hand; tooling is deliberately external to package.json and the build.
assert.ok(
  process.env.PLAYWRIGHT_MODULE,
  'Set PLAYWRIGHT_MODULE to an external Playwright index.mjs',
);
assert.ok(
  process.env.FONT_BEFORE_DIR,
  'Set FONT_BEFORE_DIR to an unchanged production build',
);
const engine = process.env.FONT_BROWSER ?? 'chromium';
const playwright = await import(
  pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href
);
const launchBrowser = () =>
  playwright[engine].launch({
    ...(process.env.BROWSER_EXECUTABLE
      ? { executablePath: process.env.BROWSER_EXECUTABLE }
      : {}),
    headless: true,
  });
const browser = await launchBrowser();
const output = resolve(
  process.env.FONT_EVIDENCE_DIR ?? 'docs/font-optimization',
);
await mkdir(output, { recursive: true });
const routes = [
  '/',
  '/articles/design-the-second-attempt/',
  '/work/accord/',
  '/work/pascal/',
];
const sha = (s) => createHash('sha256').update(s).digest('hex');

function fixture(head, kind) {
  const content = {
    core: '<p>ASCII 0123456789 “quotes” ‘apostrophes’ – dash — dash … ellipsis • bullet ‐ hyphen ← back ↗ link</p><strong>Medium AVATAR To Wa 0123 “quotes”</strong>',
    regular:
      '<p id="accent">café déjà naïve ÀV ÁV ÄV ÅV ĀV Tó Tō Tö “Á” ¤¦§¨¯²³´¸¹</p>',
    medium:
      '<p id="accent" style="font-weight:500">café déjà naïve ÀV ÁV ÄV ÅV ĀV Tó Tō Tö “Á” ¤¦§¨¯²³´¸¹</p>',
    cjk: '<p lang="zh"><span id="cjk">中文漢字日本語한글</span></p>',
    typography: `<h1>Typography and component settings</h1>
      <p>AVATAR To Wa fi fl ffi ff office -> <- &lt;=&gt; 0123456789.</p>
      <p><em>Italic follows the existing font-synthesis:none behavior. <strong>Bold inside italics: AVATAR café</strong></em></p>
      <p><code>const café = &quot;ÀV&quot;; // system monospace, 0123456789 -&gt;</code></p>
      <pre><code>function example(value) {\n  return value ?? '漢字';\n}</code></pre>
      <p id="accent">café déjà naïve ÀV ÁV ÄV ÅV ĀV Tó Tō Tö “Á” ¤¦§¨¯²³´¸¹</p>
      <p style="font-weight:500">café déjà naïve ÀV ÁV ÄV ÅV ĀV Tó Tō Tö “Á” ¤¦§¨¯²³´¸¹</p>
      <button style="font-size:13px;font-weight:500;letter-spacing:-.011em">Component override — café 0123456789</button>
      <p style="font-weight:400"><em style="font-weight:500">Inline weight inside an italic override</em></p>
      <p style="font-size:32px">ÀV ÁV ÄV ÅV ĀV Tó Tō Tö “Á” café</p>
      <p style="hyphens:auto;max-width:7em" lang="en">characteristically internationalization extraordinary representation</p>
      <p>Explicit U+2010: extra‐ordinary; soft hyphen: extra&shy;ordinary; © × ÷ £.</p>
      <ul><li>Generated bullet marker</li></ul>
      <p id="cjk" lang="zh">中文漢字 日本語 한글 <span lang="en">Latin remains Inter.</span></p>
      ${[400, 500]
        .map(
          (weight) =>
            `<p style="font-weight:${weight}">${Array.from(
              { length: 224 },
              (_, i) => i + 0xa0,
            )
              .filter((cp) => cp !== 0xad)
              .map(
                (cp) =>
                  `A${String.fromCodePoint(cp)}V T${String.fromCodePoint(cp)}o`,
              )
              .join(' · ')}</p>`,
        )
        .join('')}`,
  }[kind];
  return `<!doctype html><html lang="en">${head}<body><main style="display:block;max-width:600px;margin:0 auto;padding:64px 24px;overflow-wrap:anywhere"><article class="prose">${content}</article></main></body></html>`;
}

async function serve(root) {
  root = resolve(root);
  const article = await readFile(
    resolve(root, 'articles/design-the-second-attempt/index.html'),
    'utf8',
  );
  const head = article.match(/<head>[\s\S]*?<\/head>/)[0];
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/__font-proof/')) {
        const kind = url.pathname.split('/')[2];
        assert.ok(
          ['core', 'regular', 'medium', 'cjk', 'typography'].includes(kind),
        );
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(fixture(head, kind));
        return;
      }
      let path = resolve(root, '.' + decodeURIComponent(url.pathname));
      assert.ok(path === root || path.startsWith(root + sep));
      if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
      const data = await readFile(path);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader(
        'Content-Type',
        {
          '.html': 'text/html; charset=utf-8',
          '.css': 'text/css',
          '.js': 'text/javascript',
          '.woff2': 'font/woff2',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
        }[extname(path)] ?? 'application/octet-stream',
      );
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

const settle = async (page) => {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map(async (img) => {
        img.loading = 'eager';
        await img.decode();
      }),
    );
    await new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(done)),
    );
  });
  // Responsive image candidate changes and native scroll snap can complete
  // after decode()/layout. Give the compositor its final paint in both builds.
  await page.waitForTimeout(250);
  await page.evaluate(async () => {
    await Promise.all([...document.images].map((img) => img.decode()));
    await new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(done)),
    );
  });
};

// All text nodes, including hidden tabs; computed style catches local and inline
// overrides. Pseudo content is audited separately, including generated markers.
const census = (page) =>
  page.evaluate(() => {
    const groups = new Map();
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    let node;
    while ((node = walker.nextNode())) {
      const el = node.parentElement;
      if (
        !el ||
        /^(SCRIPT|STYLE)$/.test(el.tagName) ||
        !node.textContent.trim()
      )
        continue;
      const c = getComputedStyle(el);
      const settings = Object.fromEntries(
        [
          'fontFamily',
          'fontWeight',
          'fontStyle',
          'fontSize',
          'fontStretch',
          'fontVariationSettings',
          'fontFeatureSettings',
          'fontVariant',
          'fontKerning',
          'fontOpticalSizing',
          'fontSynthesis',
          'hyphens',
          'textTransform',
          'letterSpacing',
        ].map((k) => [k, c[k]]),
      );
      const key = JSON.stringify(settings);
      if (!groups.has(key))
        groups.set(key, { settings, characters: new Set(), examples: [] });
      const group = groups.get(key);
      for (const char of node.textContent) group.characters.add(char);
      if (group.examples.length < 4)
        group.examples.push({
          tag: el.tagName,
          class: el.className,
          inline: el.getAttribute('style'),
          text: node.textContent.trim().slice(0, 100),
        });
    }
    const pseudo = [];
    for (const el of document.querySelectorAll('*')) {
      for (const selector of ['::before', '::after', '::marker']) {
        const c = getComputedStyle(el, selector);
        if (c.content && !['none', 'normal', '""'].includes(c.content))
          pseudo.push({
            tag: el.tagName,
            selector,
            content: c.content,
            font: c.font,
          });
      }
    }
    return {
      text: document.body.textContent.replace(/\s+/g, ' ').trim(),
      groups: [...groups.values()].map((g) => ({
        ...g,
        characters: [...g.characters].sort().join(''),
      })),
      pseudo,
      preloads: [...document.querySelectorAll('link[as="font"]')].map((l) =>
        l.getAttribute('href'),
      ),
      faces: [...document.fonts].map((f) => ({
        family: f.family,
        style: f.style,
        weight: f.weight,
        display: f.display,
        unicodeRange: f.unicodeRange,
        status: f.status,
      })),
      resources: performance
        .getEntriesByType('resource')
        .filter((r) => /\.woff2(?:$|\?)/.test(r.name))
        .map((r) => ({
          file: new URL(r.name).pathname,
          bytes: r.decodedBodySize,
          transferBytes: r.transferSize,
        })),
      images: [...document.images].map((img) => ({
        source: new URL(img.currentSrc).pathname,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      })),
    };
  });

const geometry = (page) =>
  page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    const result = [];
    let node;
    while ((node = walker.nextNode())) {
      if (
        !node.textContent.trim() ||
        /^(SCRIPT|STYLE)$/.test(node.parentElement.tagName)
      )
        continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      result.push({
        text: node.textContent,
        rects: [...range.getClientRects()].map((r) => [
          r.x,
          r.y,
          r.width,
          r.height,
        ]),
      });
    }
    return result;
  });

const before = await serve(process.env.FONT_BEFORE_DIR);
let after;
try {
  if (process.env.FONT_AUDIT_ONLY === '1') {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 900 },
      reducedMotion: 'reduce',
    });
    const pages = [];
    for (const route of routes) {
      const page = await context.newPage();
      await page.goto(before.url + route);
      await settle(page);
      pages.push({ route, ...(await census(page)) });
      await page.close();
    }
    await writeFile(
      resolve(output, 'usage.json'),
      JSON.stringify({ browser: browser.version(), engine, pages }, null, 2) +
        '\n',
    );
    console.log(
      'Baseline usage audited:',
      pages.map((p) => ({
        route: p.route,
        bytes: p.resources.reduce((a, r) => a + r.bytes, 0),
        preloads: p.preloads,
      })),
    );
    await context.close();
  } else {
    after = await serve(process.env.FONT_AFTER_DIR ?? 'dist');
    const report = {
      engine,
      browser: browser.version(),
      comparisons: [],
      network: [],
      errors: [],
    };
    await browser.close();
    const shots = resolve(output, 'screenshots');
    await mkdir(shots, { recursive: true });
    const cases = [];
    for (const route of routes)
      for (const width of [375, 1200])
        for (const colorScheme of ['light', 'dark'])
          cases.push({ route, width, colorScheme, dpr: 1 });
    for (const width of [375, 1200])
      for (const colorScheme of ['light', 'dark'])
        cases.push({ route: '/', width, colorScheme, dpr: 1, selected: true });
    for (const width of [375, 1200])
      for (const colorScheme of ['light', 'dark'])
        for (const dpr of [1, 2])
          cases.push({
            route: '/__font-proof/typography/',
            width,
            colorScheme,
            dpr,
          });
    // Separate cold contexts prove per-weight conditional downloads and CJK fallback.
    for (const kind of ['core', 'regular', 'medium', 'cjk'])
      cases.push({
        route: `/__font-proof/${kind}/`,
        width: 1200,
        colorScheme: 'light',
        dpr: 1,
        networkOnly: true,
      });
    for (const test of cases) {
      const id = `${test.route.replaceAll('/', '_') || 'home'}${test.selected ? 'selected' : ''}-${test.width}-${test.colorScheme}-${test.dpr}x`;
      if (
        process.env.FONT_CASE_FILTER &&
        !id.includes(process.env.FONT_CASE_FILTER)
      )
        continue;
      const samples = [];
      // Isolate native glyph/compositor caches between DPR/theme cases. HTTP
      // caches are also cold: both samples use separate contexts and origins.
      const caseBrowser = await launchBrowser();
      try {
        for (const [label, server] of [
          ['before', before],
          ['after', after],
        ]) {
          const context = await caseBrowser.newContext({
            viewport: { width: test.width, height: 900 },
            deviceScaleFactor: test.dpr,
            colorScheme: test.colorScheme,
            reducedMotion: 'reduce',
            serviceWorkers: 'block',
          });
          const page = await context.newPage();
          page.on('pageerror', (e) =>
            report.errors.push({ id, label, error: e.message }),
          );
          page.on('requestfailed', (r) =>
            report.errors.push({
              id,
              label,
              url: r.url().replace(server.url, ''),
              error: r.failure()?.errorText,
            }),
          );
          await page.goto(server.url + test.route, {
            waitUntil: 'networkidle',
          });
          if (test.selected)
            await page.getByRole('tab', { name: 'Selected work' }).click();
          await page.mouse.move(0, 0);
          await settle(page);
          // A stable page-height viewport loads/decode all lazy images and avoids
          // fullPage's temporary width change interacting with native scroll snap.
          const height = await page.evaluate(
            () => document.documentElement.scrollHeight,
          );
          await page.setViewportSize({ width: test.width, height });
          await settle(page);
          const usage = await census(page);
          const layout = await geometry(page);
          const file = `${id}-${label}.png`;
          if (!test.networkOnly)
            await page.screenshot({
              path: resolve(shots, file),
              animations: 'disabled',
            });
          const platforms = {};
          if (engine === 'chromium' && test.route.includes('__font-proof')) {
            const cdp = await context.newCDPSession(page);
            await cdp.send('DOM.enable');
            await cdp.send('CSS.enable');
            const { root } = await cdp.send('DOM.getDocument');
            for (const selector of ['#accent', '#cjk']) {
              const { nodeId } = await cdp.send('DOM.querySelector', {
                nodeId: root.nodeId,
                selector,
              });
              if (nodeId)
                platforms[selector] = (
                  await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
                ).fonts;
            }
          }
          samples.push({
            label,
            file,
            textHash: sha(usage.text),
            layout,
            usage,
            platforms,
          });
          await context.close();
        }
      } finally {
        await caseBrowser.close();
      }
      assert.equal(
        samples[0].textHash,
        samples[1].textHash,
        `${id}: content changed`,
      );
      assert.deepEqual(
        samples[0].usage.images,
        samples[1].usage.images,
        `${id}: responsive image source changed`,
      );
      report.network.push({
        id,
        ...test,
        samples: samples.map(({ label, usage, platforms }) => ({
          label,
          preloads: usage.preloads,
          faces: usage.faces,
          resources: usage.resources,
          images: usage.images,
          bytes: usage.resources.reduce((a, r) => a + r.bytes, 0),
          platforms,
        })),
      });
      const loaded = samples[1].usage.resources.map((r) => r.file);
      const ext = loaded.filter((f) => f.includes('-extended'));
      if (
        !test.route.includes('__font-proof') ||
        /\/(core|cjk)\/$/.test(test.route)
      )
        assert.equal(ext.length, 0, `${id}: unnecessary extended download`);
      if (/\/regular\/$/.test(test.route))
        assert.deepEqual(ext, ['/fonts/inter-regular-extended.woff2']);
      if (/\/medium\/$/.test(test.route))
        assert.deepEqual(ext, ['/fonts/inter-medium-extended.woff2']);
      if (samples[1].platforms['#accent'])
        assert.ok(
          samples[1].platforms['#accent'].every((f) => f.isCustomFont),
          `${id}: accent fell back`,
        );
      if (/\/cjk\/$/.test(test.route) && engine === 'chromium')
        assert.ok(
          samples.every((s) =>
            s.platforms['#cjk'].every((f) => !f.isCustomFont),
          ),
          `${id}: CJK webfont`,
        );
      if (!test.networkOnly)
        report.comparisons.push({
          id,
          before: samples[0].file,
          after: samples[1].file,
          textHash: samples[0].textHash,
          geometryIdentical:
            JSON.stringify(samples[0].layout) ===
            JSON.stringify(samples[1].layout),
        });
      console.log(
        `${id}: ${samples[0].usage.resources.reduce((a, r) => a + r.bytes, 0)} -> ${samples[1].usage.resources.reduce((a, r) => a + r.bytes, 0)} font bytes`,
      );
    }
    await writeFile(
      resolve(output, 'browser.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    assert.deepEqual(report.errors, [], 'Browser errors');
    const result = spawnSync(
      process.env.FONT_PYTHON ?? 'python3',
      ['scripts/compare-font-pixels.py', output],
      { stdio: 'inherit' },
    );
    assert.equal(
      result.status,
      0,
      'Pixel or geometry regression; inspect browser.json and pixels.json',
    );
  }
} finally {
  await browser.close();
  before.server.close();
  after?.server.close();
}
