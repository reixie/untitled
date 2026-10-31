/* global document, window, innerWidth, getComputedStyle, performance */
import assert from 'node:assert/strict';
import console from 'node:console';
import process from 'node:process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL, URL } from 'node:url';

assert.ok(process.env.PLAYWRIGHT_MODULE, 'Set PLAYWRIGHT_MODULE');
const { chromium, webkit } = await import(
  pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href
);
const engine = process.env.COAST_BROWSER ?? 'chromium';
const browser = await (engine === 'webkit' ? webkit : chromium).launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE
    ? { executablePath: process.env.BROWSER_EXECUTABLE }
    : {}),
});
const base = process.env.VERIFY_URL ?? 'http://127.0.0.1:4321';
const output = resolve(
  process.env.COAST_EVIDENCE_DIR ?? 'docs/coastal-footer-verification',
);
await mkdir(output, { recursive: true });
const report = {
  engine,
  browser: browser.version(),
  layouts: [],
  boundaries: [],
  errors: [],
};
const routes = [
  '/',
  '/articles/design-the-second-attempt/',
  '/work/accord/',
  '/work/pascal/',
];
const twoFrames = (page) =>
  page.evaluate(
    () =>
      new Promise((done) =>
        window.requestAnimationFrame(() => window.requestAnimationFrame(done)),
      ),
  );
const showFooter = async (page) => {
  await page.locator('.coastal-footer').scrollIntoViewIfNeeded();
  await page.locator('.coastal-scene[data-ready="true"]').waitFor();
  await twoFrames(page);
};
const hash = (page) =>
  page.locator('[data-coastal-footer]').evaluate((canvas) => {
    const pixels = canvas
      .getContext('2d')
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let n = 2166136261;
    for (let i = 0; i < pixels.length; i += 7)
      n = Math.imul(n ^ pixels[i], 16777619);
    return n >>> 0;
  });

try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 720 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (error) => report.errors.push(error.message));
  let rendererRequests = 0;
  page.on('request', (request) => {
    if (/coastal-world[.\w-]*\.js/.test(request.url())) rendererRequests++;
  });
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  await twoFrames(page);
  assert.equal(rendererRequests, 0, 'Renderer must not load above the footer');
  await showFooter(page);
  assert.equal(rendererRequests, 1, 'Load the renderer once near the footer');
  report.lazyLoading = true;

  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const route of routes) {
      await page.goto(new URL(route, base).href);
      for (const width of [320, 375, 700, 701, 1440, 1944]) {
        await page.setViewportSize({ width, height: 900 });
        await showFooter(page);
        const state = await page.evaluate(() => {
          const footer = document.querySelector('.coastal-footer');
          const scene = footer.querySelector('.coastal-scene');
          const canvas = scene.querySelector('canvas');
          return {
            width: innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            footerWidth: footer.getBoundingClientRect().width,
            afterMain:
              footer.getBoundingClientRect().top >=
              document.querySelector('main').getBoundingClientRect().bottom - 1,
            text: footer.textContent.trim(),
            controls: footer.querySelectorAll('a,button,h1,nav').length,
            theme: scene.dataset.theme,
            rootStyle: document.documentElement.getAttribute('style'),
            background: getComputedStyle(document.documentElement)
              .backgroundColor,
            corner: Array.from(
              canvas.getContext('2d').getImageData(0, 0, 1, 1).data,
            ),
          };
        });
        assert.equal(state.scrollWidth, width);
        assert.equal(state.footerWidth, width);
        assert.equal(state.afterMain, true);
        assert.equal(state.controls, 0);
        assert.equal(state.text, '');
        assert.equal(state.theme, theme);
        assert.equal(state.rootStyle, null, 'Footer must not restyle the page');
        assert.equal(
          state.background,
          theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)',
        );
        const channel = theme === 'light' ? 255 : 0;
        assert.ok(
          state.corner
            .slice(0, 3)
            .every((value) => Math.abs(value - channel) <= 3),
          'Canvas background matches site tokens, allowing antialiased edge glyphs',
        );
        assert.equal(state.corner[3], 255);
        report.layouts.push({ route, ...state });
        if (route === '/' && [375, 1440].includes(width)) {
          await page.screenshot({
            path: `${output}/${engine}-${theme}-${width}-footer.png`,
          });
          await page.locator('.coastal-footer').screenshot({
            path: `${output}/${engine}-${theme}-${width}-art.png`,
          });
        }
      }
      console.log(`PASS: ${engine} ${theme} ${route} responsive footer.`);
    }
  }

  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto(base);
  await showFooter(page);
  const still = await hash(page);
  await page.waitForTimeout(120);
  assert.equal(await hash(page), still);
  await page.locator('[data-coastal-footer]').focus();
  await page.keyboard.press('Space');
  // Headless WebKit may defer its first RAF after reduced-motion playback.
  // Wait for an actual changed frame rather than assuming a fixed startup delay.
  for (let attempt = 0; attempt < 10 && (await hash(page)) === still; attempt++)
    await page.waitForTimeout(100);
  assert.notEqual(await hash(page), still);
  await page.keyboard.press('Space');
  const paused = await hash(page);
  await page.waitForTimeout(120);
  assert.equal(await hash(page), paused);
  report.keyboardPauseAndReducedMotion = true;
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.keyboard.press('Space');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() =>
    document
      .querySelector('[data-coastal-footer]')
      .getAttribute('aria-description')
      .startsWith('Still'),
  );
  const offscreen = await hash(page);
  await page.waitForTimeout(120);
  assert.equal(await hash(page), offscreen);
  report.offscreenSuspension = true;
  await showFooter(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForFunction(
    () => document.querySelector('.coastal-scene').dataset.theme === 'light',
  );
  report.liveThemeSwitch = true;

  // Control browser time externally; no test interface is shipped in the app.
  const clock = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await clock.addInitScript(() => {
    window.__coastTime = 0;
    window.__nativeRAF = window.requestAnimationFrame.bind(window);
    Object.defineProperty(performance, 'now', {
      value: () => window.__coastTime,
    });
    window.requestAnimationFrame = (callback) =>
      window.__nativeRAF(() => callback(window.__coastTime));
  });
  const timed = await clock.newPage();
  const frameAt = (seconds, compare = false) =>
    timed.evaluate(
      async ({ seconds, compare }) => {
        window.__coastTime = seconds * 1000;
        await new Promise((done) =>
          window.__nativeRAF(() => window.__nativeRAF(done)),
        );
        const canvas = document.querySelector('[data-coastal-footer]');
        const current = canvas
          .getContext('2d')
          .getImageData(0, 0, canvas.width, canvas.height).data;
        if (!compare) {
          window.__coastFirst = current;
          return { changedChannels: 0 };
        }
        let changedChannels = 0;
        for (let i = 0; i < current.length; i++)
          if (current[i] !== window.__coastFirst[i]) changedChannels++;
        return { changedChannels };
      },
      { seconds, compare },
    );
  for (const theme of ['light', 'dark']) {
    await timed.emulateMedia({ colorScheme: theme });
    await timed.goto(base);
    await showFooter(timed);
    await frameAt(0);
    const last = await frameAt(24.5, true);
    assert.equal(last.changedChannels, 0);
    report.boundaries.push({ theme, ...last });
  }
  await clock.close();

  const plain = await browser.newContext({ javaScriptEnabled: false });
  const noJS = await plain.newPage();
  for (const route of routes) {
    await noJS.goto(new URL(route, base).href);
    assert.equal(await noJS.locator('main').isVisible(), true);
    assert.equal(await noJS.locator('.coastal-footer').isVisible(), false);
  }
  report.noJavaScriptContentIntact = true;
  await plain.close();
  assert.equal(report.errors.length, 0);
  await writeFile(
    `${output}/${engine}-report.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(
    `PASS: ${engine}, ${report.layouts.length} route/theme/width layouts, lazy loading, site colors, motion controls, offscreen suspension, exact loop endpoints and no-JS fallback.`,
  );
} finally {
  await browser.close();
}
