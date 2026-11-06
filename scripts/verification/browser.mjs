/* global document, innerHeight, requestAnimationFrame */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export async function launchBrowser(engine = 'chromium') {
  const modulePath = process.env.PLAYWRIGHT_MODULE;
  assert.ok(
    modulePath,
    'Set PLAYWRIGHT_MODULE to an external Playwright index.mjs',
  );
  const playwright = await import(pathToFileURL(resolve(modulePath)).href);
  const browserType = playwright[engine];
  assert.ok(
    typeof browserType?.launch === 'function',
    `Unknown Playwright browser: ${engine}`,
  );
  return browserType.launch({
    executablePath: process.env.BROWSER_EXECUTABLE || undefined,
    headless: true,
  });
}

export function decodePageImages(page, loadOffscreen = false) {
  return page.evaluate(async (loadOffscreen) => {
    const paint = () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      );
    await document.fonts.ready;
    await paint();
    const images = [...document.images].filter((img) => {
      if (!img.getAttribute('src') && !img.getAttribute('srcset')) return false;
      if (loadOffscreen || img.loading === 'eager') return true;
      const rect = img.getBoundingClientRect();
      return rect.width && rect.top < innerHeight && rect.bottom > 0;
    });
    if (loadOffscreen) {
      for (const image of images) image.loading = 'eager';
      await paint();
    }
    await Promise.all(
      images.map(async (img) => {
        const source = img.currentSrc;
        try {
          await img.decode();
        } catch (error) {
          // Resizing can cancel decode while the browser selects a new srcset candidate.
          await paint();
          if (img.currentSrc === source && img.complete) throw error;
          await img.decode();
        }
      }),
    );
    await paint();
  }, loadOffscreen);
}
