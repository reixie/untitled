import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
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
  ['dist/articles/design-the-second-attempt/index.html', 'dist/index.html'],
);
const scripts = files.filter((path) => /\.[cm]?js$/.test(path));
const payloads = await Promise.all(scripts.map((path) => readFile(path)));
for (const file of files.filter((path) => /\.(html|css|json)$/.test(path))) {
  const content = await readFile(file, 'utf8');
  assert.doesNotMatch(
    content,
    /figma\.com\/api\/mcp\/asset|__stage\d|data-static-proof|localhost:|127\.0\.0\.1:/,
  );
  if (file.endsWith('.html')) {
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
    } else {
      assert.match(content, /<h1\b[^>]*>Design the second attempt<\/h1>/);
      assert.match(
        content,
        /<time\b[^>]*datetime="2026-10-23"[^>]*>23 October 2026<\/time>/,
      );
      assert.match(
        content,
        /<a\b[^>]*href="\/"[^>]*>[\s\S]*?Back to homepage<\/a>/,
      );
      assert.doesNotMatch(
        content,
        /<script\b|id="projects"|id="selected-work"/,
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
  `PASS: static homepage + article, one Writing entry, full article HTML without JS; no placeholder titles, islands, temporary URLs, original PNGs or verification routes. JS: ${rawBytes} raw bytes / ${gzipBytes} gzip bytes (level 9, sum of each emitted JS file and inline module body; conservative for inline HTML compression), budget 30720 bytes.`,
);
