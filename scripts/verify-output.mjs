import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import console from 'node:console';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

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

const files = await filesIn('dist');
assert.deepEqual(
  files.filter((path) => path.endsWith('.html')),
  [
    'dist/articles/design-the-second-attempt/index.html',
    'dist/index.html',
    'dist/work/accord/index.html',
    'dist/work/pascal/index.html',
  ],
);
const scripts = files.filter((path) => /\.[cm]?js$/.test(path));
const payloads = await Promise.all(scripts.map((path) => readFile(path)));
for (const file of files.filter((path) => /\.(html|css|json)$/.test(path))) {
  const content = await readFile(file, 'utf8');
  assert.doesNotMatch(
    content,
    /figma\.com\/api\/mcp\/asset|__stage\d|data-static-proof|localhost:|127\.0\.0\.1:|\/Users\/alex\/Downloads/,
  );
  if (file.endsWith('.html')) {
    assert.equal(
      [...content.matchAll(/data-coastal-footer(?:\s|>)/g)].length,
      1,
      'Every page must include one shared coastal footer',
    );
    assert.doesNotMatch(
      /<main\b[\s\S]*?<\/main>/.exec(content)?.[0] ?? '',
      /data-coastal-footer/,
      'The site footer belongs after the main content',
    );
    assert.doesNotMatch(
      content,
      /Using AI as a design engineer|Less is more, more or less/,
      'Placeholder Writing titles must not render',
    );
    assert.doesNotMatch(content, /astro-island|<iframe\b/);
    for (const match of content.matchAll(
      /<script\b([^>]*)>([\s\S]*?)<\/script>/g,
    )) {
      const [, attributes = '', body = ''] = match;
      assert.match(
        attributes,
        /type="module"/,
        'Only small module controllers are permitted',
      );
      const src = /\bsrc="([^"]+)"/.exec(attributes)?.[1];
      if (src) {
        assert.match(src, /^\/_astro\/[\w.-]+\.js$/);
        assert.ok(files.includes(join('dist', src)));
      } else payloads.push(Buffer.from(body));
    }
    assert.doesNotMatch(content, /href="(?:#|javascript:[^"]*)"/);
    if (file === 'dist/index.html') {
      // Unenhanced homepage HTML must expose both readable showcase panels.
      assert.doesNotMatch(
        content,
        /\shidden(?:[\s=>]|="[^"]*")|role="tab(?:list|panel)?"/,
      );
      assert.match(content, /id="projects"/);
      assert.match(content, /id="selected-work"/);
      const writing =
        /<section\b[^>]*aria-labelledby="writing-heading"[^>]*>([\s\S]*?)<\/section>/.exec(
          content,
        )?.[1];
      assert.ok(writing, 'Writing section must exist');
      const links = [...writing.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
      assert.equal(links.length, 1, 'Writing must contain exactly one article');
      assert.equal([...writing.matchAll(/<li\b/g)].length, 1);
      assert.match(
        links[0][1],
        /href="\/articles\/design-the-second-attempt\/"/,
      );
      assert.doesNotMatch(links[0][1], /\btarget=|\brel=/);
      assert.match(links[0][2], /Design the second attempt/);
      const centralWork = /data-work="42:378"[^>]*>([\s\S]*?)<\/div>/.exec(
        content,
      )?.[1];
      assert.ok(centralWork);
      assert.match(centralWork, /href="\/work\/accord\/"/);
      assert.match(centralWork, /aria-label="Accord — a CRM for small teams"/);
      assert.doesNotMatch(centralWork, /\btarget=/);
      const pascalWork = /data-work="42:382"[^>]*>([\s\S]*?)<\/div>/.exec(
        content,
      )?.[1];
      assert.ok(pascalWork);
      assert.match(pascalWork, /href="\/work\/pascal\/"/);
      assert.match(
        pascalWork,
        /aria-label="Pascal — Markdown notes for macOS"/,
      );
      assert.match(pascalWork, /Research Brief/);
      assert.doesNotMatch(pascalWork, /\btarget=/);
      const vocabularyWork = /data-work="42:393"[^>]*>([\s\S]*?)<\/div>/.exec(
        content,
      )?.[1];
      assert.ok(vocabularyWork);
      assert.doesNotMatch(vocabularyWork, /<a\b/);
      assert.deepEqual(
        [...content.matchAll(/data-work="([^"]+)"/g)].map((m) => m[1]),
        ['42:382', '42:378', '42:393'],
      );
    } else if (file.startsWith('dist/articles/')) {
      assert.match(content, /<h1\b[^>]*>Design the second attempt<\/h1>/);
      assert.match(
        content,
        /<time\b[^>]*datetime="2026-10-23"[^>]*>23 October 2026<\/time>/,
      );
      assert.match(
        content,
        /<a\b[^>]*href="\/"[^>]*>[\s\S]*?Back to homepage<\/a>/,
      );
      assert.doesNotMatch(content, /id="projects"|id="selected-work"/);
      assert.doesNotMatch(
        /<article\b[\s\S]*?<\/article>/.exec(content)?.[0] ?? '',
        /<script\b/,
        'Article content remains static; only the shared footer has a controller',
      );
      const source = await readFile(
        'src/content/articles/design-the-second-attempt.md',
        'utf8',
      );
      const body = source.replace(/^---\n[\s\S]*?\n---\n/, '');
      const expected = body
        .replace(/^## |^- /gm, '')
        .replace(/\s+/g, ' ')
        .trim();
      const rendered = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      assert.ok(
        rendered.includes(expected),
        'Entire Markdown body must be present in static HTML',
      );
    } else if (file.startsWith('dist/work/')) {
      const id = file.split('/')[2];
      const title = {
        accord: 'Accord — a CRM for small teams',
        pascal: 'Pascal — Markdown notes for macOS',
      }[id];
      assert.ok(title, `Unverified work route: ${id}`);
      assert.match(content, new RegExp(`<h1\\b[^>]*>${title}</h1>`));
      assert.doesNotMatch(content, /<time\b|id="writing-heading"/);
      assert.doesNotMatch(
        /<article\b[\s\S]*?<\/article>/.exec(content)?.[0] ?? '',
        /<script\b/,
      );
      assert.match(content, /href="\/"[^>]*>[\s\S]*?Back to homepage/);
      const source = await readFile(`src/content/work/${id}.mdx`, 'utf8');
      const body = source
        .replace(/^---\n[\s\S]*?\n---\n/, '')
        .replace(/^import .*;\n/gm, '')
        .replace(/<CaseFigure[\s\S]*?\/>/g, '');
      const rendered = content
        .replace(/<[^>]+>/g, ' ')
        .replace(/&#39;|&#x27;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ');
      for (const paragraph of body.trim().split(/\n\s*\n/)) {
        const expected = paragraph
          .replace(/^## |^- /gm, '')
          .replace(/\s+/g, ' ')
          .trim();
        assert.ok(
          rendered.includes(expected),
          `Missing case copy: ${expected}`,
        );
      }
      for (const [, caption] of source.matchAll(/caption="([^"]+)"/g))
        assert.ok(rendered.includes(caption));
      assert.equal([...content.matchAll(/<figure\b/g)].length, 6);
      const images = [...content.matchAll(/<img\b([^>]+)>/g)];
      assert.equal(images.length, 6);
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
        ...content.matchAll(/href="([^"]+-original[^"]+\.webp)"/g),
      ];
      assert.equal(originals.length, 6);
      assert.equal(new Set(originals.map(([, url]) => url)).size, 6);
      for (const [, url] of originals) {
        assert.ok(files.includes(join('dist', url)));
        const name = new RegExp(`/(${id}-[\\w-]+-original)\\.`).exec(url)?.[1];
        assert.ok(name);
        assert.ok(
          (await readFile(join('dist', url))).equals(
            await readFile(`src/assets/images/${id}/${name}.webp`),
          ),
          'Full-size original must remain byte-for-byte unchanged',
        );
      }
      if (id === 'pascal') {
        const sources = await filesIn('src/assets/images/pascal');
        assert.equal(sources.length, 6, 'Only six unique Pascal originals');
        const hashes = await Promise.all(
          sources.map(async (path) =>
            createHash('sha256')
              .update(await readFile(path))
              .digest('hex'),
          ),
        );
        assert.equal(new Set(hashes).size, 6, 'Do not copy duplicate exports');
        assert.equal(
          [...content.matchAll(/data-case-image="Command palette — Dark"/g)]
            .length,
          1,
          'Show the dark command palette once',
        );
      }
    }
  }
}
for (const payload of payloads)
  assert.doesNotMatch(
    payload.toString(),
    /https?:\/\/|__stage\d|data-static-proof/,
  );
assert.equal(
  files.filter((path) => /\.png$/i.test(path)).length,
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
  `PASS: static homepage + article + Accord/Pascal cases, one Writing entry, complete static article/case content and one shared coastal footer per page, six responsive images per case with unchanged local originals, Pascal deduplication, both gallery destinations/order; no placeholders, islands, temporary URLs, original PNGs or verification routes. JS: ${rawBytes} raw bytes / ${gzipBytes} gzip bytes (level 9), budget 30720 bytes.`,
);
