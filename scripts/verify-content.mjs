import assert from 'node:assert/strict';
import console from 'node:console';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

// Fixtures exist only in an isolated temporary project, never in the real source/dist.
const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = await mkdtemp(join(tmpdir(), 'untitled-content-'));
const astro = join(root, 'node_modules/astro/bin/astro.mjs');

async function fixture(name, content) {
  await writeFile(join(scratch, 'src/content/articles', name), content);
}

function build() {
  const result = spawnSync(process.execPath, [astro, 'build'], {
    cwd: scratch,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', NO_COLOR: '1' },
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  return { status: result.status, output: result.stdout + result.stderr };
}

try {
  for (const path of [
    'package.json',
    'astro.config.mjs',
    'tsconfig.json',
    'src',
    'public',
  ]) {
    await cp(join(root, path), join(scratch, path), { recursive: true });
  }
  await symlink(
    join(root, 'node_modules'),
    join(scratch, 'node_modules'),
    'dir',
  );
  // Test data is independent of any real articles added after Stage 1.
  await rm(join(scratch, 'src/content/articles'), { recursive: true });
  await mkdir(join(scratch, 'src/content/articles'));
  await mkdir(join(scratch, 'src/components'), { recursive: true });
  await writeFile(
    join(scratch, 'src/components/StaticProof.astro'),
    '<aside data-static-proof>Static component compiled in MDX</aside>',
  );
  await fixture(
    'unfinished.mdx',
    '---\nstatus: draft\n---\nUnfinished draft without dates.',
  );
  await fixture(
    'older.md',
    '---\nstatus: published\ntitle: Older\ndescription: Markdown proof\npublishedAt: "2026-01-01"\n---\nMarkdown body.',
  );
  for (const id of ['newer', 'same-date']) {
    await fixture(
      `${id}.mdx`,
      `---\nstatus: published\ntitle: ${id}\ndescription: MDX proof\npublishedAt: "2026-02-01"\n---\nimport StaticProof from '../../components/StaticProof.astro';\n\n## MDX compilation proof\n\n<StaticProof />`,
    );
  }
  await writeFile(
    join(scratch, 'src/pages/stage1-verification.astro'),
    `---
import { render } from 'astro:content';
import { getPublishedArticles } from '../lib/articles';
const articles = await getPublishedArticles();
const rendered = await Promise.all(articles.map(async article => ({
  id: article.id,
  ...(await render(article)),
})));
---
<html lang="en"><body>
{rendered.map(({ id, Content }) => <article data-id={id}><Content /></article>)}
</body></html>`,
  );

  const valid = build();
  assert.equal(valid.status, 0, valid.output);
  const html = await readFile(
    join(scratch, 'dist/stage1-verification/index.html'),
    'utf8',
  );
  assert.match(html, /<h2[^>]*>MDX compilation proof<\/h2>/);
  assert.match(html, /data-static-proof/);
  assert.match(html, /Markdown body/);
  assert.doesNotMatch(html, /Unfinished draft|<script|astro-island/);
  assert.deepEqual(
    [...html.matchAll(/data-id="([^"]+)"/g)].map((match) => match[1]),
    ['newer', 'same-date', 'older'],
  );
  const homepage = await readFile(join(scratch, 'dist/index.html'), 'utf8');
  assert.deepEqual(
    [...homepage.matchAll(/href="\/articles\/([^"]+)\/"/g)].map(
      (match) => match[1],
    ),
    ['newer', 'same-date', 'older'],
    'The real Writing list must use published date/ID ordering',
  );
  const routes = await readdir(join(scratch, 'dist/articles'));
  assert.deepEqual(routes.sort(), ['newer', 'older', 'same-date']);
  for (const id of routes) {
    const article = await readFile(
      join(scratch, 'dist/articles', id, 'index.html'),
      'utf8',
    );
    assert.match(
      article,
      new RegExp(`<h1\\b[^>]*>${id === 'older' ? 'Older' : id}</h1>`),
    );
    assert.match(article, /Markdown body|data-static-proof/);
    assert.doesNotMatch(article, /Unfinished draft|astro-island/);
    assert.doesNotMatch(
      /<article\b[\s\S]*?<\/article>/.exec(article)?.[0] ?? '',
      /<script\b/,
    );
    assert.match(article, /data-coastal-footer/);
  }
  assert.doesNotMatch(homepage, /Unfinished draft|\/articles\/unfinished\//);
  console.log(
    'PASS: Markdown + MDX + static Astro component; undated draft excluded from real routes and Writing; shared date/ID ordering.',
  );

  for (const [name, metadata, expected] of [
    [
      'missing-date',
      'title: Invalid\ndescription: Missing date',
      /publishedAt/,
    ],
    [
      'invalid-date',
      'title: Invalid\ndescription: Invalid date\npublishedAt: "2026-02-30"',
      /publishedAt/,
    ],
    [
      'missing-title',
      'description: Missing title\npublishedAt: "2026-01-01"',
      /title/,
    ],
    [
      'missing-description',
      'title: Invalid\npublishedAt: "2026-01-01"',
      /description/,
    ],
  ]) {
    await fixture(
      'invalid.mdx',
      `---\nstatus: published\n${metadata}\n---\nInvalid.`,
    );
    const invalid = build();
    assert.notEqual(invalid.status, 0, `${name} should fail validation`);
    assert.match(invalid.output, /invalid\.mdx|invalid/);
    assert.match(invalid.output, expected);
    console.log(`PASS: ${name} rejected with entry and field diagnostics.`);
    await rm(join(scratch, 'src/content/articles/invalid.mdx'));
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}
