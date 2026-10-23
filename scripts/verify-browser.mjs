/* global document, window, innerWidth, innerHeight, getComputedStyle, PerformanceObserver, requestAnimationFrame */
import assert from 'node:assert/strict';
import console from 'node:console';
import process from 'node:process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL, URL } from 'node:url';

// Tooling stays outside package.json: point this at a temporary Playwright install.
assert.ok(
  process.env.PLAYWRIGHT_MODULE,
  'Set PLAYWRIGHT_MODULE to an external Playwright index.mjs',
);
const { chromium } = await import(
  pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href
);
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE,
  headless: true,
});
const baseURL = process.env.VERIFY_URL ?? 'http://127.0.0.1:4321';
const articlePath = '/articles/design-the-second-attempt/';
const articleURL = new URL(articlePath, baseURL).href;
const articleSource = await readFile(
  'src/content/articles/design-the-second-attempt.md',
  'utf8',
);
const articleBody = articleSource
  .replace(/^---\n[\s\S]*?\n---\n/, '')
  .replace(/^## |^- /gm, '')
  .replace(/\s+/g, ' ')
  .trim();
// New evidence stays separate from the historical Stage 1/2 captures.
const output = resolve('docs/article-verification');
await mkdir(output, { recursive: true });
const report = {
  browser: browser.version(),
  matrix: [],
  interactions: [],
  noJavaScript: [],
  article: [],
  errors: [],
  cancelledRequests: [],
};
const closeTo = (actual, expected, tolerance = 1) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} ≠ ${expected}`,
  );
const settle = async (page) => {
  await page.evaluate(() => document.fonts.ready);
  await page.locator('img').evaluateAll((images) =>
    Promise.all(
      images
        .filter((img) => {
          const rect = img.getBoundingClientRect();
          return (
            img.loading === 'eager' ||
            (rect.width && rect.top < innerHeight && rect.bottom > 0)
          );
        })
        .map((img) => img.decode()),
    ),
  );
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
};
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
      await settle(page);
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
      if (width === 1200) {
        closeTo(before.profile.y, 64);
        closeTo(before.card.y, 376);
        closeTo(before.experience.y, 840);
        closeTo(before.writing.y, 1116);
      }
      await capture(page, `${output}/${theme}-projects-${width}.png`);
      await work.click();
      await settle(page);
      assert.equal(await work.getAttribute('aria-selected'), 'true');
      const after = await geometry(page);
      assert.ok(after.pageWidth <= width);
      assert.deepEqual(after.profile, before.profile);
      assert.deepEqual(after.experience, before.experience);
      assert.deepEqual(after.writing, before.writing);
      const gallery = await page.locator('[data-gallery]').evaluate((el) => {
        const items = [...el.querySelectorAll('[data-work]')].map((item) => {
          const r = item.getBoundingClientRect();
          return { x: r.x, width: r.width, height: r.height };
        });
        return { scrollLeft: el.scrollLeft, width: el.clientWidth, items };
      });
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
        primary: getComputedStyle(document.querySelector('h1')).color,
        arrow: getComputedStyle(document.querySelector('.arrow'))
          .backgroundColor,
        fonts: [...document.fonts].map((f) => ({
          family: f.family,
          weight: f.weight,
          status: f.status,
        })),
        cls: window.__stage2LayoutShifts.reduce((sum, value) => sum + value, 0),
      }));
      assert.equal(styles.fontSize, '16px');
      assert.equal(
        styles.primary,
        theme === 'light' ? 'rgb(32, 32, 32)' : 'rgb(238, 238, 238)',
      );
      assert.equal(
        styles.arrow,
        theme === 'light' ? 'rgb(100, 100, 100)' : 'rgb(180, 180, 180)',
      );
      assert.ok(styles.fonts.every((f) => f.status === 'loaded'));
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
  await settle(page);
  closeTo(await scroll(), (327 + 16) * 2);
  await projects.click();
  await page.setViewportSize({ width: 320, height: 900 });
  await work.click();
  await settle(page);
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
  await gallery.evaluate((el) => {
    el.style.scrollSnapType = 'none';
    el.scrollLeft = 350;
  });
  await page.waitForTimeout(60);
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
  await page.waitForTimeout(150);
  assert.ok((await page.evaluate(() => window.scrollY)) > previousY);
  const previousX = await scroll();
  await gallery.hover();
  await page.mouse.wheel(-400, 0);
  await page.waitForTimeout(150);
  assert.ok(Math.abs((await scroll()) - previousX) > 10);
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
      })),
  );
  assert.deepEqual(
    links.map((link) => link.href),
    [
      'https://www.linkedin.com/in/alex-lohinov-b503683b4',
      'https://github.com/reixie',
      'https://x.com/reixxiie',
      'mailto:alex@lohinov.com',
      'https://github.com/reixie/runnel',
      'https://www.konexta.agency/',
      'https://www.valorx.com/',
      'https://roxfit.app/',
      'https://optihint.com/',
      '/articles/design-the-second-attempt/',
    ],
  );
  const writingLink = page.locator('[aria-labelledby="writing-heading"] a');
  assert.equal(await writingLink.count(), 1);
  assert.equal(await writingLink.getAttribute('target'), null);
  for (const link of await page.locator('.row[href^="https://"]').all()) {
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
  }
  report.links = links;
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

  // Retain the existing card and hover behavior as Writing becomes a real link.
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
  const canvas = page.locator('[data-pixel-flow]');
  const frame = await canvas.evaluate((el) => el.toDataURL());
  await page.waitForFunction(
    (previous) =>
      document.querySelector('[data-pixel-flow]').toDataURL() !== previous,
    frame,
  );
  await page.mouse.move(0, 0);
  assert.equal(
    await page
      .locator('[data-tilt-surface]')
      .evaluate((el) => el.style.getPropertyValue('--tilt-x')),
    '',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await settle(page);
  const stillFrame = await canvas.evaluate((el) => el.toDataURL());
  await page.waitForTimeout(150);
  assert.equal(await canvas.evaluate((el) => el.toDataURL()), stillFrame);
  await page.mouse.move(cardBounds.x + 30, cardBounds.y + 30);
  assert.equal(
    await page
      .locator('[data-tilt-surface]')
      .evaluate((el) => el.style.getPropertyValue('--tilt-x')),
    '',
  );
  await page.locator('[aria-labelledby="writing-heading"] a').hover();
  await page.waitForFunction(
    () => getComputedStyle(document.body, '::after').opacity === '0.5',
  );
  await page.mouse.move(0, 0);
  await page.waitForFunction(
    () => getComputedStyle(document.body, '::after').opacity === '0',
  );
  report.interactions.push(
    'Runnel pointer tilt/reset, animated canvas, reduced-motion still frame and disabled tilt; Writing hover fade/reset',
  );
  console.log(
    'PASS: existing pointer tilt, canvas animation, reduced motion and Writing hover.',
  );

  // Chromium's touch input protocol drives an actual swipe; no synthetic DOM scroll.
  const touchContext = await browser.newContext({
    viewport: { width: 375, height: 900 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
  });
  const touchPage = await touchContext.newPage();
  await touchPage.goto(baseURL);
  await settle(touchPage);
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
      assert.ok(
        await plain
          .locator('body')
          .innerText()
          .then(
            (text) =>
              text.includes('An intelligent feedback loop') &&
              text.includes('Design the second attempt'),
          ),
      );
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
    await noJS.close();
  }

  // Follow the real article link with the keyboard, refresh, then return home.
  await page.setViewportSize({ width: 1200, height: 1000 });
  await page.goto(baseURL);
  const articleLink = page.locator('[aria-labelledby="writing-heading"] a');
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
        // A no-JS page does not run animation-frame callbacks. Article layout
        // only needs its fonts; it has no controllers or animated content.
        await reading.evaluate(() => document.fonts.ready);
        assert.equal(
          await reading.locator('h1').innerText(),
          'Design the second attempt',
        );
        assert.equal(
          await reading.locator('time').getAttribute('datetime'),
          '2026-10-23',
        );
        assert.equal(
          await reading.locator('time').innerText(),
          '23 October 2026',
        );
        assert.equal(await reading.locator('article h2').count(), 3);
        assert.equal(await reading.locator('article li').count(), 4);
        assert.equal(
          (await reading.locator('.prose').innerText())
            .replace(/\s+/g, ' ')
            .trim(),
          articleBody,
        );
        assert.doesNotMatch(
          await reading.locator('body').innerText(),
          /Using AI as a design engineer|Less is more, more or less/,
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
        assert.equal(await reading.locator('script').count(), 0);
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
      // Even with scripting disabled, the return link loads the real homepage.
      await reading.getByRole('link', { name: 'Back to homepage' }).click();
      assert.equal(reading.url(), new URL('/', baseURL).href);
      assert.equal(
        await reading.locator('[aria-labelledby="writing-heading"] li').count(),
        1,
      );
      assert.doesNotMatch(
        await reading.locator('body').innerText(),
        /Using AI as a design engineer|Less is more, more or less/,
      );
      await reading.locator('[aria-labelledby="writing-heading"] a').click();
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
  // Enlarged text and long roles must wrap within the same gutters.
  await page.setViewportSize({ width: 320, height: 1000 });
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
  report.interactions.push(
    '320px: long role and 200% root font size wrap without page overflow',
  );
  assert.deepEqual(report.errors, []);
  await context.close();
  await writeFile(
    `${output}/browser-verification.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    `PASS: ${report.matrix.length} homepage and ${report.article.length} article theme/width/JS combinations, keyboard/pointer/touch, resize/reopen, no-JS, local resources, CLS and links. Evidence: ${output}`,
  );
} finally {
  await browser.close();
}
