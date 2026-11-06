/* global document, window, innerWidth, innerHeight, getComputedStyle, PerformanceObserver, requestAnimationFrame */
import assert from 'node:assert/strict';
import console from 'node:console';
import process from 'node:process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { URL } from 'node:url';
import { decodePageImages, launchBrowser } from './verification/browser.mjs';
import {
  article,
  caseStudies,
  galleryOrder,
  readArticleBody,
  readCaseCopy,
  vocabularyNode,
} from './verification/portfolio.mjs';

const baseURL = process.env.VERIFY_URL ?? 'http://127.0.0.1:4321';
const articleURL = new URL(article.path, baseURL).href;
const [articleBody, studies] = await Promise.all([
  readArticleBody(),
  Promise.all(
    caseStudies.map(async (study) => ({
      ...study,
      ...(await readCaseCopy(study)),
      url: new URL(study.path, baseURL).href,
    })),
  ),
]);
const output = resolve(
  process.env.BROWSER_EVIDENCE_DIR ?? 'docs/pascal-verification',
);
await mkdir(output, { recursive: true });
const browser = await launchBrowser();
const report = {
  browser: browser.version(),
  matrix: [],
  interactions: [],
  noJavaScript: [],
  article: [],
  caseStudy: [],
  errors: [],
  cancelledRequests: [],
};
const writingLinks = (page) =>
  page.locator('[aria-labelledby="writing-heading"] a');
const knownArticleLink = (page) =>
  writingLinks(page).and(page.locator(`a[href="${article.path}"]`));
const closeTo = (actual, expected, tolerance = 1) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} ≠ ${expected}`,
  );
async function verifyCaseTabOrder(page) {
  for (const link of await page.locator('main a').all()) {
    await page.keyboard.press('Tab');
    assert.equal(
      await link.evaluate((el) => el === document.activeElement),
      true,
    );
    assert.equal(
      await link.evaluate((el) => getComputedStyle(el).outlineStyle),
      'solid',
    );
  }
}
const capture = async (page, path) => {
  // Capture a page-height viewport after layout settles. This avoids the browser's
  // temporary width reset during a fullPage capture changing native scroll snap.
  const viewport = page.viewportSize();
  const height = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  await page.setViewportSize({ width: viewport.width, height });
  await page.waitForTimeout(150);
  await page.screenshot({
    path,
    caret: 'initial',
    animations: 'allow',
    timeout: 10000,
  });
  await page.setViewportSize(viewport);
  await page.waitForTimeout(50);
};
const geometry = (page) =>
  page.evaluate(() => {
    const rect = (selector) => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return {
        x: r.x,
        y: r.y + window.scrollY,
        width: r.width,
        height: r.height,
      };
    };
    return {
      viewport: innerWidth,
      pageWidth: document.documentElement.scrollWidth,
      profile: rect('header'),
      experience: rect('[aria-labelledby="experience-heading"]'),
      writing: rect('[aria-labelledby="writing-heading"]'),
      card: rect('.project-card'),
      preview: rect('.project-preview'),
      caption: rect('.project-caption'),
      tabs: rect('.tabs'),
    };
  });

try {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 1000 },
    deviceScaleFactor: 1,
  });
  context.setDefaultTimeout(10000);
  await context.addInitScript(() => {
    window.__stage2LayoutShifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        if (!entry.hadRecentInput)
          window.__stage2LayoutShifts.push(entry.value);
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error')
      report.errors.push(`${message.text()} (${message.location().url})`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400)
      report.errors.push(`${response.status()}: ${response.url()}`);
  });
  page.on('requestfailed', (request) => {
    const failure = `${request.url()}: ${request.failure()?.errorText}`;
    // Navigation/srcset changes can cancel an obsolete image request.
    if (request.failure()?.errorText === 'net::ERR_ABORTED')
      report.cancelledRequests.push(failure);
    else report.errors.push(failure);
  });
  const resources = new Set();
  page.on('request', (request) => resources.add(request.url()));

  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const width of [320, 375, 768, 1200, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(baseURL);
      await page.getByRole('tab', { name: 'Projects', exact: true }).waitFor();
      await decodePageImages(page);
      const projects = page.getByRole('tab', { name: 'Projects', exact: true });
      const work = page.getByRole('tab', {
        name: 'Selected work',
        exact: true,
      });
      assert.equal(await projects.getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('#selected-work').isVisible(), false);
      const before = await geometry(page);
      assert.ok(before.pageWidth <= width);
      closeTo(before.profile.width, Math.min(600, width - 48));
      closeTo(before.profile.x, Math.max(24, (width - 600) / 2));
      closeTo(before.card.width, Math.min(300, width - 48));
      closeTo(before.preview.height, 200);
      closeTo(before.caption.y - before.preview.y - before.preview.height, 12);
      closeTo(before.tabs.height, 32);
      closeTo(before.tabs.y - before.profile.y - before.profile.height, 32);
      closeTo(before.experience.y - before.card.y - before.card.height, 32);
      if (width === 1200) {
        closeTo(before.profile.y, 64);
        closeTo(before.card.y, 340);
        closeTo(before.experience.y, 644);
        closeTo(before.writing.y, 888);
      }
      await capture(page, `${output}/${theme}-projects-${width}.png`);
      await work.click();
      await decodePageImages(page);
      assert.equal(await work.getAttribute('aria-selected'), 'true');
      const after = await geometry(page);
      assert.ok(after.pageWidth <= width);
      assert.deepEqual(after.profile, before.profile);
      const gallery = await page.locator('[data-gallery]').evaluate((el) => {
        const items = [...el.querySelectorAll('[data-work]')].map((item) => {
          const r = item.getBoundingClientRect();
          return { x: r.x, width: r.width, height: r.height };
        });
        return {
          scrollLeft: el.scrollLeft,
          width: el.clientWidth,
          bottom: el.getBoundingClientRect().bottom + window.scrollY,
          items,
        };
      });
      closeTo(after.experience.y - gallery.bottom, 32);
      closeTo(
        after.writing.y - after.experience.y - after.experience.height,
        32,
      );
      if (width === 1200) {
        closeTo(after.experience.y, 772);
        closeTo(after.writing.y, 1016);
      }
      closeTo(gallery.items[1].x, Math.max(24, (width - 600) / 2));
      closeTo(gallery.items[1].width, Math.min(600, width - 48));
      closeTo(gallery.items[1].height, (gallery.items[1].width * 2) / 3);
      if (width >= 768) {
        assert.ok(gallery.items[0].x + gallery.items[0].width > 0);
        assert.ok(gallery.items[2].x < width);
      }
      await capture(page, `${output}/${theme}-selected-work-${width}.png`);
      const styles = await page.evaluate(() => ({
        fontSize: getComputedStyle(document.querySelector('h1')).fontSize,
        tracking: getComputedStyle(document.querySelector('h1')).letterSpacing,
        tabSize: getComputedStyle(document.querySelector('#projects-tab'))
          .fontSize,
        primary: getComputedStyle(document.querySelector('h1')).color,
        arrow: getComputedStyle(document.querySelector('.arrow'))
          .backgroundColor,
        fonts: [...document.fonts].map((f) => ({
          family: f.family,
          weight: f.weight,
          status: f.status,
          unicodeRange: f.unicodeRange,
        })),
        cls: window.__stage2LayoutShifts.reduce((sum, value) => sum + value, 0),
      }));
      assert.equal(styles.fontSize, '14px');
      assert.equal(styles.tracking, '-0.154px');
      assert.equal(styles.tabSize, '13px');
      assert.equal(
        styles.primary,
        theme === 'light' ? 'rgb(32, 32, 32)' : 'rgb(238, 238, 238)',
      );
      assert.equal(
        styles.arrow,
        theme === 'light' ? 'rgb(100, 100, 100)' : 'rgb(180, 180, 180)',
      );
      const coreFaces = styles.fonts.filter(
        (f) => f.unicodeRange === 'U+0-10FFFF',
      );
      assert.equal(coreFaces.length, 2);
      assert.ok(coreFaces.every((f) => f.status === 'loaded'));
      assert.ok(styles.cls < 0.01, `Unexpected CLS: ${styles.cls}`);
      report.matrix.push({ theme, width, before, gallery, styles });
    }
  }

  console.log(
    'PASS: responsive geometry, themes, screenshots, local fonts and CLS matrix.',
  );
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(baseURL);
  const projects = page.getByRole('tab', { name: 'Projects', exact: true });
  const work = page.getByRole('tab', { name: 'Selected work', exact: true });
  await projects.focus();
  await projects.press('ArrowLeft');
  assert.equal(
    await work.evaluate((el) => el === document.activeElement),
    true,
  );
  await work.press('ArrowRight');
  assert.equal(
    await projects.evaluate((el) => el === document.activeElement),
    true,
  );
  await projects.press('End');
  assert.equal(await work.getAttribute('aria-selected'), 'true');
  await work.press('Home');
  assert.equal(await projects.getAttribute('aria-selected'), 'true');
  await projects.press('Space');
  await projects.press('Enter');
  assert.equal(await projects.getAttribute('aria-selected'), 'true');
  await projects.press('Tab');
  assert.equal(
    await page
      .locator('#projects')
      .evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(
    await page
      .locator('#projects')
      .evaluate((el) => getComputedStyle(el).outlineStyle),
    'solid',
  );
  await page.keyboard.press('Tab');
  assert.equal(
    await page
      .getByRole('link', { name: 'Keeps on GitHub' })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await work.click();
  await work.press('Tab');
  assert.equal(
    await page
      .locator('#selected-work')
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press('Tab');
  const gallery = page.locator('[data-gallery]');
  assert.equal(
    await gallery.evaluate((el) => el === document.activeElement),
    true,
  );
  const scroll = () => gallery.evaluate((el) => el.scrollLeft);
  await gallery.press('ArrowRight');
  closeTo(await scroll(), 1232);
  await projects.click();
  await work.click();
  closeTo(await scroll(), 1232);
  await page.setViewportSize({ width: 375, height: 900 });
  await decodePageImages(page);
  closeTo(await scroll(), (327 + 16) * 2);
  await projects.click();
  await page.setViewportSize({ width: 320, height: 900 });
  await work.click();
  await decodePageImages(page);
  closeTo(await scroll(), (272 + 16) * 2);
  await gallery.press('Home');
  closeTo(await scroll(), 0);
  await gallery.press('ArrowRight');
  closeTo(await scroll(), 288);
  await gallery.press('End');
  closeTo(await scroll(), 576);
  await gallery.press('ArrowLeft');
  closeTo(await scroll(), 288);
  // Verify fractional position retention, rather than only snapped endpoints.
  await gallery.evaluate(async (el) => {
    el.style.scrollSnapType = 'none';
    const scrolled = new Promise((done) =>
      el.addEventListener('scroll', done, { once: true }),
    );
    el.scrollLeft = 350;
    await scrolled;
  });
  await projects.click();
  await work.click();
  closeTo(await scroll(), 350);
  await gallery.evaluate((el) => {
    el.style.scrollSnapType = '';
  });

  // An injected link tests the hidden-descendant contract without publishing fake destinations.
  await page.locator('#selected-work').evaluate((el) => {
    const link = document.createElement('a');
    link.href = '#projects';
    link.id = 'focus-probe';
    link.textContent = 'Test only';
    el.append(link);
    link.focus();
  });
  await projects.dispatchEvent('click');
  assert.equal(
    await projects.evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  assert.equal(
    await page
      .locator('#focus-probe')
      .evaluate((el) => el === document.activeElement),
    false,
  );
  await page.locator('#focus-probe').evaluate((el) => el.remove());
  console.log('PASS: tabs, focus, gallery keyboard, resize and reopen.');
  await page.setViewportSize({ width: 1200, height: 900 });
  await work.click();
  await gallery.hover();
  const previousY = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 250);
  await page.waitForFunction(
    (previous) => window.scrollY > previous,
    previousY,
  );
  const previousX = await scroll();
  await gallery.hover();
  await page.mouse.wheel(-400, 0);
  await page.waitForFunction(
    (previous) =>
      Math.abs(document.querySelector('[data-gallery]').scrollLeft - previous) >
      10,
    previousX,
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await gallery.focus();
  await gallery.press('End');
  await page.waitForFunction(
    () =>
      Math.abs(document.querySelector('[data-gallery]').scrollLeft - 1232) < 1,
    undefined,
    { timeout: 5000 },
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gallery.press('Home');
  closeTo(await scroll(), 0);
  assert.equal(new URL(page.url()).hash, '');
  report.interactions.push(
    'Tabs: pointer, wraparound arrows, Home/End, Space/Enter, roving tabindex, focus outline, panel entry and hidden descendant exclusion',
    'Gallery: scoped keyboard, native wheel, vertical page scrolling, reopen, fractional position, visible and hidden resize, reduced motion and smooth user navigation',
  );

  const links = await page.locator('a[href]').evaluateAll((elements) =>
    elements
      .filter((el) => !el.matches('[role="tab"]'))
      .map((el) => ({
        text: el.textContent.trim(),
        href: el.getAttribute('href'),
        writing: el.closest('[aria-labelledby="writing-heading"]') !== null,
      })),
  );
  assert.deepEqual(
    links.filter((link) => !link.writing).map((link) => link.href),
    [
      'https://www.linkedin.com/in/alex-lohinov-b503683b4',
      'https://github.com/reixie',
      'https://x.com/reixxiie',
      'mailto:alex@lohinov.com',
      'https://github.com/reixie/keeps',
      ...galleryOrder
        .map((node) => caseStudies.find((study) => study.node === node)?.path)
        .filter(Boolean),
      'https://www.konexta.agency/',
      'https://www.valorx.com/',
      'https://roxfit.app/',
      'https://optihint.com/',
    ],
  );
  assert.equal(await knownArticleLink(page).innerText(), article.title);
  for (const link of await writingLinks(page).all()) {
    assert.match(await link.getAttribute('href'), /^\/articles\/(?:[^/]+\/)+$/);
    assert.equal(await link.getAttribute('target'), null);
    assert.equal(await link.getAttribute('rel'), null);
  }
  for (const link of await page.locator('.row[href^="https://"]').all()) {
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
  }
  report.links = links.map(({ text, href }) => ({ text, href }));
  assert.ok(
    [...resources].every((url) => url.startsWith(baseURL)),
    'All loaded resources must be local',
  );
  report.resources = [...resources].sort();
  report.media = await page.locator('img').evaluateAll((images) =>
    images.map((img) => ({
      src: img.currentSrc,
      width: img.width,
      height: img.height,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      complete: img.complete,
    })),
  );
  console.log('PASS: wheel, reduced motion and verified destinations.');

  // Tilt follows the preview and resets when the pointer reaches the caption.
  await page.goto(baseURL);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const card = page.locator('[data-tilt-card]');
  await card.scrollIntoViewIfNeeded();
  const cardBounds = await card.boundingBox();
  await page.mouse.move(cardBounds.x + 30, cardBounds.y + 30);
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-tilt-surface]')
        .style.getPropertyValue('--tilt-x') !== '',
  );
  await page.locator('.project-caption').hover();
  assert.equal(
    await page
      .locator('[data-tilt-surface]')
      .evaluate((el) => el.style.getPropertyValue('--tilt-x')),
    '',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.mouse.move(cardBounds.x + 30, cardBounds.y + 30);
  assert.equal(
    await page
      .locator('[data-tilt-surface]')
      .evaluate((el) => el.style.getPropertyValue('--tilt-x')),
    '',
  );
  await knownArticleLink(page).hover();
  await page.waitForFunction(
    () => getComputedStyle(document.body, '::after').opacity === '0.5',
  );
  await page.mouse.move(0, 0);
  await page.waitForFunction(
    () => getComputedStyle(document.body, '::after').opacity === '0',
  );
  report.interactions.push(
    'Keeps preview-only tilt/reset and reduced-motion disabled tilt; Writing hover fade/reset',
  );

  // Drive the real renderer with an external RAF clock, without production test hooks.
  const clock = await browser.newContext({
    viewport: { width: 1200, height: 900 },
  });
  await clock.addInitScript(() => {
    window.__keepsTime = 0;
    const nativeRAF = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      nativeRAF(() => callback(window.__keepsTime));
    const NativeObserver = window.IntersectionObserver;
    window.IntersectionObserver = class extends NativeObserver {
      constructor(callback, options) {
        super((entries, observer) => {
          callback(entries, observer);
          for (const entry of entries) {
            if (entry.target.matches('[data-keeps-ascii]')) {
              window.__keepsVisible = entry.isIntersecting;
            }
          }
        }, options);
      }
    };
  });
  const timed = await clock.newPage();
  const canvas = timed.locator('[data-keeps-ascii]');
  const sample = (ms) =>
    timed.evaluate(async (time) => {
      window.__keepsTime = time;
      await new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      );
      return document.querySelector('[data-keeps-ascii]').toDataURL();
    }, ms);
  const waitForKeepsVisibility = (visible) =>
    timed.waitForFunction(
      (visible) => window.__keepsVisible === visible,
      visible,
    );
  const completed = {};
  for (const theme of ['light', 'dark']) {
    await timed.emulateMedia({
      colorScheme: theme,
      reducedMotion: 'no-preference',
    });
    await timed.goto(baseURL);
    await waitForKeepsVisibility(true);
    const opening = await sample(0);
    const transfers = [];
    for (const time of [2_650, 3_900, 5_150, 6_400]) {
      transfers.push(await sample(time));
    }
    completed[theme] = await sample(8_500);
    assert.equal(new Set([opening, ...transfers, completed[theme]]).size, 6);
    assert.ok(
      (await sample(11_999)) === opening,
      'Keeps ends on its opening frame',
    );
    assert.ok(
      (await sample(12_000)) === opening,
      'Keeps loops to its opening frame',
    );
    await timed.emulateMedia({ reducedMotion: 'reduce' });
    await timed.waitForFunction(
      (still) =>
        document.querySelector('[data-keeps-ascii]').toDataURL() === still,
      completed[theme],
    );
    assert.ok(
      (await sample(16_000)) === completed[theme],
      'Reduced motion keeps the completed frame',
    );
  }
  assert.notEqual(completed.light, completed.dark);

  await timed.emulateMedia({
    reducedMotion: 'no-preference',
    colorScheme: 'light',
  });
  await timed.goto(baseURL);
  await waitForKeepsVisibility(true);
  await sample(0);
  let moving = await sample(2_650);
  await timed.getByRole('tab', { name: 'Selected work' }).click();
  await waitForKeepsVisibility(false);
  assert.ok((await sample(6_000)) === moving, 'Keeps pauses in a hidden tab');
  await timed.getByRole('tab', { name: 'Projects' }).click();
  await waitForKeepsVisibility(true);
  assert.ok(
    (await sample(6_000)) === moving,
    'Keeps resumes from the hidden tab frame',
  );
  const resumed = await sample(6_200);
  assert.ok(resumed !== moving, 'Keeps advances after reopening its tab');
  moving = resumed;
  await timed.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await waitForKeepsVisibility(false);
  assert.ok((await sample(8_000)) === moving, 'Keeps pauses offscreen');
  await canvas.scrollIntoViewIfNeeded();
  await waitForKeepsVisibility(true);
  assert.ok(
    (await sample(8_000)) === moving,
    'Keeps resumes from the offscreen frame',
  );
  await timed.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      value: true,
      configurable: true,
    });
    document.dispatchEvent(new window.Event('visibilitychange'));
  });
  assert.ok(
    (await sample(10_000)) === moving,
    'Document visibility preserves the current frame',
  );
  await timed.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden');
    document.dispatchEvent(new window.Event('visibilitychange'));
  });
  assert.ok(
    (await sample(10_000)) === moving,
    'Document visibility preserves the current frame',
  );
  assert.ok(
    (await sample(10_200)) !== moving,
    'Keeps advances after document visibility returns',
  );
  await timed.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await timed.waitForFunction(
    (still) =>
      document.querySelector('[data-keeps-ascii]').toDataURL() === still,
    completed.dark,
  );
  await clock.close();

  const fallback = await browser.newPage();
  await fallback.addInitScript(() => {
    window.HTMLCanvasElement.prototype.getContext = () => null;
  });
  await fallback.goto(baseURL);
  assert.equal(await fallback.locator('.keeps-ascii svg').isVisible(), true);
  assert.equal(await fallback.locator('[data-keeps-ascii]').isVisible(), false);
  await fallback.close();
  report.interactions.push(
    'Keeps: four transfers, seamless 12s loop, pause/resume when hidden, live theme and reduced motion, static SVG without Canvas',
  );
  console.log('PASS: Keeps animation, playback and static fallback.');

  // Chromium's touch input protocol drives an actual swipe; no synthetic DOM scroll.
  const touchContext = await browser.newContext({
    viewport: { width: 375, height: 900 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
  });
  const touchPage = await touchContext.newPage();
  await touchPage.goto(baseURL);
  await decodePageImages(touchPage);
  await touchPage
    .getByRole('tab', { name: 'Selected work', exact: true })
    .tap();
  const touchGallery = touchPage.locator('[data-gallery]');
  await touchGallery.scrollIntoViewIfNeeded();
  const bounds = await touchGallery.boundingBox();
  const cdp = await touchContext.newCDPSession(touchPage);
  const point = { x: 300, y: bounds.y + bounds.height / 2 };
  const touchBefore = await touchGallery.evaluate((el) => el.scrollLeft);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [point],
  });
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: point.x - 30 * i, y: point.y }],
    });
    await touchPage.waitForTimeout(25);
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await touchPage.waitForTimeout(350);
  const touchAfter = await touchGallery.evaluate((el) => el.scrollLeft);
  assert.ok(touchAfter > touchBefore + 100);
  assert.equal(
    await touchPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  report.interactions.push({
    touch: '375px Chromium touch emulation: tap + native swipe',
    before: touchBefore,
    after: touchAfter,
  });
  await touchContext.close();
  console.log('PASS: native touch swipe.');

  for (const theme of ['light', 'dark']) {
    const noJS = await browser.newContext({
      javaScriptEnabled: false,
      colorScheme: theme,
    });
    const plain = await noJS.newPage();
    for (const width of [320, 375, 768, 1200, 1440]) {
      await plain.setViewportSize({ width, height: 1000 });
      await plain.goto(baseURL);
      assert.equal(await plain.locator('#projects').isVisible(), true);
      assert.equal(await plain.locator('#selected-work').isVisible(), true);
      assert.equal(await plain.getByRole('tab').count(), 0);
      await plain
        .getByRole('link', { name: 'Keeps on GitHub', exact: true })
        .waitFor({ state: 'visible' });
      assert.equal(await plain.locator('.keeps-ascii svg').isVisible(), true);
      assert.equal(
        await plain.locator('[data-keeps-ascii]').isVisible(),
        false,
      );
      await knownArticleLink(plain).waitFor({ state: 'visible' });
      assert.equal(
        await plain.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      report.noJavaScript.push({
        theme,
        width,
        bothPanelsReadable: true,
        overflow: false,
      });
    }
    await capture(plain, `${output}/${theme}-no-javascript-1440.png`);
    await plain
      .getByRole('link', { name: 'Selected work', exact: true })
      .click();
    assert.equal(new URL(plain.url()).hash, '#selected-work');
    await plain.getByRole('link', { name: 'Projects', exact: true }).click();
    assert.equal(new URL(plain.url()).hash, '#projects');
    await noJS.close();
  }

  await page.setViewportSize({ width: 1200, height: 1000 });
  await page.goto(baseURL);
  const articleLink = knownArticleLink(page);
  await articleLink.focus();
  await articleLink.press('Shift+Tab');
  await page.keyboard.press('Tab');
  assert.equal(
    await articleLink.evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(
    await articleLink.evaluate((el) => getComputedStyle(el).outlineStyle),
    'solid',
  );
  await articleLink.press('Enter');
  assert.equal(page.url(), articleURL);
  assert.equal(
    context.pages().length,
    1,
    'Article navigation must stay in the same tab',
  );
  assert.equal((await page.reload()).status(), 200);
  await page.keyboard.press('Tab');
  const back = page.getByRole('link', { name: 'Back to homepage' });
  assert.equal(
    await back.evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(
    await back.evaluate((el) => getComputedStyle(el).outlineStyle),
    'solid',
  );
  await back.press('Enter');
  assert.equal(page.url(), new URL('/', baseURL).href);
  await page.getByRole('tab', { name: 'Selected work', exact: true }).click();
  assert.equal(await page.locator('#selected-work').isVisible(), true);
  report.interactions.push(
    'Writing keyboard focus → same-tab article → successful refresh → focused return link → homepage tabs',
  );

  for (const theme of ['light', 'dark']) {
    for (const javaScriptEnabled of [true, false]) {
      const readingContext = await browser.newContext({
        javaScriptEnabled,
        colorScheme: theme,
        reducedMotion: 'reduce',
      });
      readingContext.setDefaultTimeout(10000);
      const reading = await readingContext.newPage();
      reading.on('pageerror', (error) => report.errors.push(error.message));
      for (const width of [320, 375, 768, 1200, 1440]) {
        await reading.setViewportSize({ width, height: 1000 });
        assert.equal((await reading.goto(articleURL)).status(), 200);
        // Font readiness also works when the page cannot run animation frames.
        await reading.evaluate(() => document.fonts.ready);
        assert.equal(await reading.locator('h1').innerText(), article.title);
        assert.equal(
          await reading.locator('time').getAttribute('datetime'),
          article.date,
        );
        assert.equal(
          await reading.locator('time').innerText(),
          article.dateLabel,
        );
        assert.equal(await reading.locator('article h2').count(), 3);
        assert.equal(await reading.locator('article li').count(), 4);
        assert.equal(
          (await reading.locator('.prose').innerText())
            .replace(/\s+/g, ' ')
            .trim(),
          articleBody,
        );
        const layout = await reading.evaluate(() => {
          const article = document.querySelector('article');
          const rect = article.getBoundingClientRect();
          return {
            width: rect.width,
            x: rect.x,
            overflow: document.documentElement.scrollWidth > innerWidth,
            color: getComputedStyle(article).color,
            background: getComputedStyle(document.documentElement)
              .backgroundColor,
            font: getComputedStyle(article).fontFamily,
            lineHeight: getComputedStyle(document.querySelector('.prose'))
              .lineHeight,
          };
        });
        closeTo(layout.width, Math.min(600, width - 48));
        closeTo(layout.x, Math.max(24, (width - 600) / 2));
        assert.equal(layout.overflow, false);
        assert.equal(
          layout.color,
          theme === 'light' ? 'rgb(32, 32, 32)' : 'rgb(238, 238, 238)',
        );
        assert.equal(
          layout.background,
          theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)',
        );
        assert.match(layout.font, /Inter/);
        assert.equal(layout.lineHeight, '26px');
        assert.equal(await reading.locator('article script').count(), 0);
        assert.equal(await reading.locator('[data-coastal-footer]').count(), 1);
        assert.equal(
          await reading
            .getByRole('link', { name: 'Back to homepage' })
            .getAttribute('href'),
          '/',
        );
        report.article.push({
          theme,
          javaScriptEnabled,
          viewport: width,
          ...layout,
        });
        if (javaScriptEnabled && [320, 1200].includes(width)) {
          await capture(reading, `${output}/${theme}-article-${width}.png`);
        }
      }
      await reading.getByRole('link', { name: 'Back to homepage' }).click();
      assert.equal(reading.url(), new URL('/', baseURL).href);
      await knownArticleLink(reading).click();
      assert.equal(reading.url(), articleURL);
      await readingContext.close();
    }
  }
  // The article follows a live system-theme change without reloading or scripting.
  await page.goto(articleURL);
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    assert.equal(
      await page.locator('h1').evaluate((el) => getComputedStyle(el).color),
      theme === 'light' ? 'rgb(32, 32, 32)' : 'rgb(238, 238, 238)',
    );
  }
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.locator('html').evaluate((el) => {
    el.style.fontSize = '200%';
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  report.interactions.push(
    'Article: direct URL, full text and return navigation with/without JS; live system themes; 320px at 200% text',
  );
  console.log(
    'PASS: article themes/mobile/no-JS matrix, same-tab navigation, refresh and keyboard return.',
  );

  for (const study of studies) {
    await page.goto(baseURL);
    await page.getByRole('tab', { name: 'Selected work', exact: true }).click();
    assert.deepEqual(
      await page
        .locator('[data-work]')
        .evaluateAll((items) => items.map((item) => item.dataset.work)),
      galleryOrder,
    );
    assert.equal(await page.locator('[data-gallery] button').count(), 0);
    assert.equal(await page.locator('[data-work] a').count(), studies.length);
    assert.equal(
      await page.locator(`[data-work="${vocabularyNode}"] a`).count(),
      0,
    );
    const caseLink = page.locator(`[data-work="${study.node}"] a`);
    assert.equal(await caseLink.getAttribute('href'), study.path);
    assert.equal(await caseLink.getAttribute('aria-label'), study.title);
    assert.equal(await caseLink.getAttribute('target'), null);
    await page.locator('[data-gallery]').focus();
    for (const node of galleryOrder.slice(
      0,
      galleryOrder.indexOf(study.node) + 1,
    )) {
      await page.keyboard.press('Tab');
      assert.equal(
        await page
          .locator(`[data-work="${node}"] a`)
          .evaluate((el) => el === document.activeElement),
        true,
      );
    }
    assert.equal(
      await caseLink.evaluate((el) => getComputedStyle(el).outlineStyle),
      'solid',
    );
    await caseLink.press('Enter');
    assert.equal(page.url(), study.url);
    assert.equal(context.pages().length, 1);
    assert.equal((await page.reload()).status(), 200);
    await page.goBack();
    assert.equal(page.url(), new URL('/', baseURL).href);
    await page.getByRole('tab', { name: 'Selected work', exact: true }).click();
    await caseLink.click();
    assert.equal(page.url(), study.url);
    await verifyCaseTabOrder(page);
    const originals = page.locator('article a[href$=".webp"]');
    assert.equal(await originals.count(), study.originalCount);
    for (const link of await originals.all()) {
      const response = await context.request.get(
        new URL(await link.getAttribute('href'), baseURL).href,
      );
      assert.equal(response.status(), 200);
      assert.match(response.headers()['content-type'], /image\/webp/);
    }
    const original = originals.first();
    await original.focus();
    const originalURL = new URL(await original.getAttribute('href'), baseURL)
      .href;
    await original.press('Enter');
    const viewer = page.getByRole('dialog');
    const enlarged = viewer.locator('img');
    await enlarged.waitFor({ state: 'visible' });
    assert.equal(page.url(), study.url);
    assert.equal(await enlarged.getAttribute('src'), originalURL);
    const close = viewer.getByRole('button', { name: 'Close image viewer' });
    assert.equal(
      await close.evaluate((el) => el === document.activeElement),
      true,
    );
    const zoom = viewer.getByRole('button', { name: 'Show actual size' });
    await close.press('Shift+Tab');
    assert.equal(
      await zoom.evaluate((el) => el === document.activeElement),
      true,
    );
    await zoom.press('Enter');
    assert.ok(
      await enlarged.evaluate((el) => el.clientWidth === el.naturalWidth),
    );
    assert.ok(
      await viewer
        .getByRole('region', { name: 'Image viewport' })
        .evaluate((el) => el.scrollLeft > 0 && el.scrollTop > 0),
    );
    await viewer.getByRole('button', { name: 'Fit to screen' }).press('Enter');
    assert.ok(
      await enlarged.evaluate((el) => el.clientWidth < el.naturalWidth),
    );
    await page.keyboard.press('Escape');
    await viewer.waitFor({ state: 'hidden' });
    assert.equal(
      await original.evaluate((el) => el === document.activeElement),
      true,
    );
    const lastOriginal = originals.last();
    await lastOriginal.click();
    await enlarged.waitFor({ state: 'visible' });
    assert.equal(
      await enlarged.getAttribute('src'),
      new URL(await lastOriginal.getAttribute('href'), baseURL).href,
    );
    await viewer.getByRole('button', { name: 'Show actual size' }).click();
    // Reopen before the native close event is delivered to exercise the pending state.
    const reopened = await original.evaluate((link) => {
      const dialog = document.querySelector('dialog');
      dialog.close();
      link.click();
      return {
        loading: dialog.querySelector('[role="status"]').textContent,
        imageHidden: dialog.querySelector('img').hidden,
        zoomDisabled: dialog.querySelector('[aria-label="Show actual size"]')
          ?.disabled,
      };
    });
    assert.deepEqual(reopened, {
      loading: 'Loading image…',
      imageHidden: true,
      zoomDisabled: true,
    });
    await enlarged.waitFor({ state: 'visible' });
    assert.equal(await enlarged.getAttribute('src'), originalURL);
    await viewer.click({ position: { x: 4, y: 4 } });
    await viewer.waitFor({ state: 'hidden' });
    await page.waitForFunction(
      (url) => document.activeElement?.href === url,
      originalURL,
    );
    await page.getByRole('link', { name: 'Back to homepage' }).last().click();
    assert.equal(page.url(), new URL('/', baseURL).href);
    report.interactions.push(
      `${study.id}: gallery → case → original-size lightbox via keyboard and pointer → Escape/backdrop close with focus return → homepage`,
    );

    for (const theme of ['light', 'dark']) {
      for (const javaScriptEnabled of [true, false]) {
        const caseContext = await browser.newContext({
          javaScriptEnabled,
          colorScheme: theme,
          reducedMotion: 'reduce',
        });
        const reading = await caseContext.newPage();
        reading.on('pageerror', (error) => report.errors.push(error.message));
        reading.on('console', (message) => {
          if (message.type() === 'error')
            report.errors.push(`${message.text()} (${message.location().url})`);
        });
        reading.on('requestfailed', (request) => {
          if (request.failure()?.errorText !== 'net::ERR_ABORTED')
            report.errors.push(
              `${request.url()}: ${request.failure()?.errorText}`,
            );
        });
        reading.on('response', (response) => {
          if (response.status() >= 400)
            report.errors.push(`${response.status()}: ${response.url()}`);
        });
        for (const width of [320, 375, 768, 1200, 1440]) {
          await reading.setViewportSize({ width, height: 900 });
          assert.equal((await reading.goto(study.url)).status(), 200);
          await reading.evaluate(() => document.fonts.ready);
          assert.equal(await reading.locator('h1').innerText(), study.title);
          assert.equal(
            await reading.locator('article h2').count(),
            study.headings,
          );
          assert.equal(
            await reading.locator('article ul > li').count(),
            study.bulletItems,
          );
          assert.deepEqual(
            await reading
              .locator('article ol')
              .evaluateAll((lists) =>
                lists.map((list) => list.children.length),
              ),
            study.orderedLists,
          );
          assert.equal(
            await reading.locator('[data-case-flow]').count(),
            study.flowCount,
          );
          if (study.id === 'accord') {
            const chart = (
              await reading.locator('[data-case-chart]').innerText()
            ).replace(/\s+/g, ' ');
            assert.match(chart, /Ramp 1,200 Stripe 8,500/);
          }
          assert.equal(
            await reading.locator('article time, article script').count(),
            0,
          );
          assert.equal(
            await reading.locator('[data-coastal-footer]').count(),
            1,
          );
          const body = (await reading.locator('article').innerText()).replace(
            /\s+/g,
            ' ',
          );
          for (const paragraph of study.paragraphs)
            assert.ok(
              body.includes(paragraph),
              `Missing case paragraph: ${paragraph}`,
            );
          for (const img of await reading.locator('article img').all()) {
            await img.scrollIntoViewIfNeeded();
            await img.evaluate((el) => el.decode());
          }
          const layout = await reading.evaluate(() => {
            const text = document.querySelector('.case-body > p');
            const r = text.getBoundingClientRect();
            return {
              textWidth: r.width,
              textX: r.x,
              overflow: document.documentElement.scrollWidth > innerWidth,
              color: getComputedStyle(text).color,
              font: getComputedStyle(text).fontFamily,
              lineHeight: getComputedStyle(text).lineHeight,
              images: [...document.querySelectorAll('article img')].map(
                (img) => {
                  const style = getComputedStyle(img);
                  const rect = img.getBoundingClientRect();
                  return {
                    src: img.currentSrc,
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                    width: rect.width,
                    height: rect.height,
                    x: rect.x,
                    outline: style.outlineColor,
                    outlineWidth: style.outlineWidth,
                    attrWidth: img.getAttribute('width'),
                    attrHeight: img.getAttribute('height'),
                    loading: img.loading,
                    alt: img.alt,
                    complete: img.complete,
                  };
                },
              ),
            };
          });
          assert.equal(layout.overflow, false);
          closeTo(layout.textWidth, Math.min(600, width - 48));
          closeTo(layout.textX, Math.max(24, (width - 600) / 2));
          assert.equal(layout.lineHeight, '26px');
          assert.match(layout.font, /Inter/);
          assert.equal(
            layout.color,
            theme === 'light' ? 'rgb(32, 32, 32)' : 'rgb(238, 238, 238)',
          );
          assert.equal(layout.images.length, study.figures.length);
          assert.equal(
            new Set(layout.images.map((img) => img.src)).size,
            study.figures.length,
          );
          assert.deepEqual(
            await reading
              .locator('[data-case-image]')
              .evaluateAll((figures) =>
                figures.map((figure) => figure.dataset.caseImage),
              ),
            study.figures,
          );
          for (const [i, img] of layout.images.entries()) {
            assert.ok(
              img.complete && img.naturalWidth > 0 && img.alt.length > 30,
            );
            assert.ok(img.src.startsWith(baseURL));
            closeTo(img.width, layout.textWidth);
            closeTo(img.x, layout.textX);
            assert.equal(img.outlineWidth, '1px');
            assert.equal(
              img.outline,
              theme === 'light'
                ? 'rgba(0, 0, 0, 0.1)'
                : 'rgba(255, 255, 255, 0.1)',
            );
            closeTo(
              img.width / img.height,
              Number(img.attrWidth) / Number(img.attrHeight),
              0.01,
            );
            closeTo(
              img.naturalWidth / img.naturalHeight,
              Number(img.attrWidth) / Number(img.attrHeight),
              0.01,
            );
            assert.equal(img.loading, i === 0 ? 'eager' : 'lazy');
          }
          report.caseStudy.push({
            id: study.id,
            theme,
            javaScriptEnabled,
            viewport: width,
            ...layout,
          });
          if (javaScriptEnabled && [375, 1200].includes(width)) {
            await reading.evaluate(() => window.scrollTo(0, 0));
            await capture(
              reading,
              `${output}/${theme}-${study.id}-${width}.png`,
            );
            await verifyCaseTabOrder(reading);
            await reading
              .locator('figure [data-case-lightbox]')
              .first()
              .click();
            const modal = reading.getByRole('dialog');
            const modalImage = modal.locator('img');
            await modalImage.waitFor({ state: 'visible' });
            assert.ok(
              await modalImage.evaluate((el) => {
                const box = el.getBoundingClientRect();
                return (
                  box.left >= 0 &&
                  box.right <= innerWidth &&
                  box.top >= 0 &&
                  box.bottom <= innerHeight
                );
              }),
            );
            await reading.screenshot({
              path: `${output}/${theme}-${study.id}-lightbox-${width}.png`,
            });
            await modal
              .getByRole('button', { name: 'Close image viewer' })
              .click();
            await modal.waitFor({ state: 'hidden' });
          }
        }
        if (!javaScriptEnabled) {
          const fallback = reading
            .locator('figure [data-case-lightbox]')
            .first();
          const href = new URL(await fallback.getAttribute('href'), baseURL)
            .href;
          await fallback.click();
          assert.equal(reading.url(), href);
          await reading.goBack();
        }
        await reading
          .getByRole('link', { name: 'Back to homepage' })
          .first()
          .click();
        assert.equal(reading.url(), new URL('/', baseURL).href);
        await caseContext.close();
      }
    }
    await page.goto(study.url);
    for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme });
      assert.equal(
        await page.locator('h1').evaluate((el) => getComputedStyle(el).color),
        theme === 'light' ? 'rgb(32, 32, 32)' : 'rgb(238, 238, 238)',
      );
    }
    await page.setViewportSize({ width: 320, height: 900 });
    await page.locator('html').evaluate((el) => {
      el.style.fontSize = '200%';
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    report.interactions.push(
      `${study.id}: complete static text, ${study.figures.length} local proportional images in order and ${study.originalCount} linked originals, five widths with/without JS, live system themes, 320px at 200% text`,
    );
    console.log(
      `PASS: ${study.id} route, full copy, local images/originals, keyboard/history, themes/mobile/no-JS matrix.`,
    );
  }
  // Enlarged text and long roles must wrap within the same gutters.
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(baseURL);
    await page
      .locator('.role')
      .first()
      .evaluate((el) => {
        el.textContent =
          'Product Designer of complex workflows and design systems';
      });
    await page.locator('html').evaluate((el) => {
      el.style.fontSize = '200%';
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    const enlarged = await geometry(page);
    assert.ok(enlarged.caption.height > 120);
    closeTo(enlarged.experience.y - enlarged.card.y - enlarged.card.height, 64);
  }
  report.interactions.push(
    '320px and 375px: long role and Keeps caption wrap at 200% root font size without page overflow',
  );
  assert.deepEqual(report.errors, []);
  await context.close();
  await writeFile(
    `${output}/browser-verification.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    `PASS: ${report.matrix.length} homepage, ${report.article.length} article and ${report.caseStudy.length} case theme/width/JS combinations, keyboard/pointer/touch, resize/reopen, no-JS, local resources, CLS and links. Evidence: ${output}`,
  );
} finally {
  await browser.close();
}
