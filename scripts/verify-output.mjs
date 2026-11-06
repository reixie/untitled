import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import console from 'node:console';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  article,
  caseStudies,
  galleryOrder,
  readArticleBody,
  readCaseCopy,
  vocabularyNode,
} from './verification/portfolio.mjs';

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? filesIn(path) : [path];
      }),
    )
  ).flat();
}

const outputFile = (path) => `dist${path}index.html`;
const articlePath = /^dist\/articles\/(?:[^/]+\/)+index\.html$/;
const files = new Set(await filesIn('dist'));
const htmlFiles = [...files].filter((path) => path.endsWith('.html'));
const articleFiles = htmlFiles.filter((file) => articlePath.test(file));
const studyByFile = new Map(
  caseStudies.map((study) => [outputFile(study.path), study]),
);
assert.ok(
  files.has(outputFile(article.path)),
  'The published reference article must build',
);
assert.deepEqual(
  htmlFiles.sort(),
  [outputFile('/'), ...articleFiles, ...studyByFile.keys()].sort(),
);

function verifyHomepage(content) {
  assert.doesNotMatch(
    content,
    /<[^>]*\shidden[\s=>]|role="tab(?:list|panel)?"/,
  );
  assert.match(content, /id="projects"/);
  assert.match(content, /id="selected-work"/);
  const writing =
    /<section\b[^>]*aria-labelledby="writing-heading"[^>]*>([\s\S]*?)<\/section>/.exec(
      content,
    )?.[1];
  assert.ok(writing, 'Writing section must exist');
  const links = [...writing.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
  const hrefs = links.map(([, attributes, label]) => {
    const href = /\bhref="([^"]+)"/.exec(attributes)?.[1];
    assert.ok(href, 'Writing links need a destination');
    assert.doesNotMatch(attributes, /\btarget=|\brel=/);
    if (href === article.path) assert.ok(label.includes(article.title));
    return href;
  });
  assert.equal([...writing.matchAll(/<li\b/g)].length, links.length);
  assert.deepEqual(
    hrefs.sort(),
    articleFiles
      .map((file) => file.slice('dist'.length, -'index.html'.length))
      .sort(),
    'Writing must link to every generated article exactly once',
  );

  assert.deepEqual(
    [...content.matchAll(/data-work="([^"]+)"/g)].map(([, node]) => node),
    galleryOrder,
  );
  const galleryItem = (node) => {
    const item = new RegExp(`data-work="${node}"[^>]*>([\\s\\S]*?)</div>`).exec(
      content,
    )?.[1];
    assert.ok(item, `Missing gallery item ${node}`);
    return item;
  };
  for (const study of caseStudies) {
    const item = galleryItem(study.node);
    assert.ok(item.includes(`href="${study.path}"`));
    assert.ok(item.includes(`aria-label="${study.title}"`));
    assert.doesNotMatch(item, /\btarget=/);
    if (study.previewText) assert.ok(item.includes(study.previewText));
  }
  assert.doesNotMatch(galleryItem(vocabularyNode), /<a\b/);
}

function readingPage(content) {
  const body = /<article\b[\s\S]*?<\/article>/.exec(content)?.[0];
  assert.ok(body, 'Reading pages must render an article');
  assert.doesNotMatch(body, /<script\b/, 'Article content remains static');
  assert.match(
    content,
    /<a\b[^>]*href="\/"[^>]*>[\s\S]*?Back to homepage<\/a>/,
  );
  return body;
}

const heading = (content) => /<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(content)?.[1];
const renderedText = (content) =>
  content
    .replace(/<\/?a\b[^>]*>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

async function verifyArticle(file, content) {
  const body = readingPage(content);
  assert.doesNotMatch(content, /id="projects"|id="selected-work"/);
  assert.match(body, /<time\b[^>]*datetime="\d{4}-\d{2}-\d{2}"/);
  if (file !== outputFile(article.path)) return;

  assert.equal(heading(body), article.title);
  const date = /<time\b[^>]*datetime="([^"]+)"[^>]*>([^<]+)<\/time>/.exec(body);
  assert.deepEqual(date?.slice(1), [article.date, article.dateLabel]);
  assert.ok(
    renderedText(body).includes(await readArticleBody()),
    'Entire Markdown body must be present in static HTML',
  );
}

async function verifyCase(study, content) {
  const body = readingPage(content);
  assert.equal(heading(body), study.title);
  assert.doesNotMatch(content, /<time\b|id="writing-heading"/);
  const rendered = renderedText(body);
  const copy = await readCaseCopy(study);
  for (const paragraph of copy.paragraphs)
    assert.ok(rendered.includes(paragraph), `Missing case copy: ${paragraph}`);
  for (const href of copy.hrefs)
    assert.ok(body.includes(`href="${href}"`), `Missing link: ${href}`);
  for (const caption of copy.captions)
    assert.ok(rendered.includes(caption), `Missing caption: ${caption}`);

  assert.deepEqual(
    [...body.matchAll(/\bdata-case-image="([^"]+)"/g)].map(
      ([, label]) => label,
    ),
    study.figures,
  );
  assert.equal([...content.matchAll(/<dialog\b/g)].length, 1);
  assert.doesNotMatch(content, /View full-size image/);
  const images = [...body.matchAll(/<img\b([^>]+)>/g)];
  assert.equal(images.length, study.figures.length);
  for (const [i, [, attributes]] of images.entries()) {
    assert.match(attributes, /width="(?:3840|3456)"/);
    assert.match(attributes, /height="2160"/);
    assert.match(attributes, /srcset="/);
    assert.match(
      attributes,
      new RegExp(`loading="${i === 0 ? 'eager' : 'lazy'}"`),
    );
  }

  const originals = [
    ...body.matchAll(/href="([^"]+-original[^"]+\.webp)"/g),
  ].map(([, url]) => url);
  assert.equal(originals.length, study.originalCount);
  const sourceDirectory = `src/assets/images/${study.id}`;
  const sources = await filesIn(sourceDirectory);
  assert.equal(
    sources.length,
    study.originalCount,
    'Every case original should be used',
  );
  const remaining = new Set(sources.map((path) => basename(path, '.webp')));
  const hashes = new Set();
  for (const url of originals) {
    const name = /\/([\w-]+-original)\./.exec(url)?.[1];
    assert.ok(
      name && remaining.delete(name),
      `Unexpected or repeated original: ${url}`,
    );
    const source = await readFile(join(sourceDirectory, `${name}.webp`));
    const output = await readFile(join('dist', url));
    assert.ok(
      output.equals(source),
      'Full-size original must remain byte-for-byte unchanged',
    );
    hashes.add(createHash('sha256').update(source).digest('hex'));
  }
  assert.equal(
    hashes.size,
    study.originalCount,
    'Do not copy duplicate exports',
  );
}

const scripts = [...files].filter((path) => /\.[cm]?js$/.test(path));
const payloads = await Promise.all(scripts.map((path) => readFile(path)));
for (const file of [...files].filter((path) =>
  /\.(html|css|json)$/.test(path),
)) {
  const content = await readFile(file, 'utf8');
  const isHTML = file.endsWith('.html');
  const resourceMarkup = isHTML
    ? (content.match(/<[^>]+>/g) ?? []).join(' ')
    : content;
  assert.doesNotMatch(
    resourceMarkup,
    /figma\.com\/api\/mcp\/asset|__stage\d|data-static-proof|localhost:|127\.0\.0\.1:|\/Users\/alex\/Downloads/,
  );
  if (!isHTML) continue;

  assert.equal(
    [...content.matchAll(/data-coastal-footer(?:\s|>)/g)].length,
    1,
    'Every page must include one shared coastal footer',
  );
  const main = /<main\b[\s\S]*?<\/main>/.exec(content)?.[0];
  assert.ok(main, 'Every page must render its main content');
  assert.doesNotMatch(
    main,
    /data-coastal-footer/,
    'The site footer belongs after the main content',
  );
  assert.doesNotMatch(content, /astro-island|<iframe\b/);
  assert.doesNotMatch(content, /href="(?:#|javascript:[^"]*)"/);

  for (const [, attributes, body] of content.matchAll(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/g,
  )) {
    assert.match(
      attributes,
      /type="module"/,
      'Only small module controllers are permitted',
    );
    const src = /\bsrc="([^"]+)"/.exec(attributes)?.[1];
    if (src) {
      assert.match(src, /^\/_astro\/[\w.-]+\.js$/);
      assert.ok(files.has(join('dist', src)));
    } else payloads.push(Buffer.from(body));
  }

  if (file === outputFile('/')) verifyHomepage(content);
  else if (articlePath.test(file)) await verifyArticle(file, content);
  else await verifyCase(studyByFile.get(file), content);
}
for (const payload of payloads)
  assert.doesNotMatch(
    payload.toString(),
    /https?:\/\/|__stage\d|data-static-proof/,
  );
assert.equal(
  [...files].filter((path) => /\.png$/i.test(path)).length,
  0,
  'Original PNGs must not ship',
);
const rawBytes = payloads.reduce((sum, payload) => sum + payload.length, 0);
const gzipBytes = payloads.reduce(
  (sum, payload) => sum + gzipSync(payload, { level: 9 }).length,
  0,
);
assert.ok(
  gzipBytes <= 30 * 1024,
  `${gzipBytes} gzip bytes exceeds the 30 KiB budget`,
);
console.log(
  `PASS: homepage, ${articleFiles.length} published article route(s), and ${caseStudies.length} case studies. Writing routes, static content, gallery destinations, case images and originals, footer, and production assets verified. JS: ${rawBytes} raw bytes / ${gzipBytes} gzip bytes (level 9), budget 30720 bytes.`,
);
