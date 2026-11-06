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

const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = await mkdtemp(join(tmpdir(), 'untitled-content-'));
const astro = join(root, 'node_modules/astro/bin/astro.mjs');
const articleDirectory = join(scratch, 'src/content/articles');

async function fixture(name, content) {
  await writeFile(join(articleDirectory, name), content);
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
  // Publication checks use independent fixtures so changes to real posts cannot mask a regression.
  await rm(articleDirectory, { recursive: true });
  await mkdir(articleDirectory);
  await mkdir(join(scratch, 'src/components'), { recursive: true });
  await writeFile(
    join(scratch, 'src/components/StaticProof.astro'),
    '<aside data-static-proof>Static component compiled in MDX</aside>',
  );
  await fixture(
    'unfinished.mdx',
    '---\nstatus: draft\n---\nUnfinished draft without dates.',
  );
  const publications = [
    {
      id: 'older',
      title: 'Older',
      format: 'md',
      date: '2026-01-01',
      body: 'Markdown body.',
    },
    ...['same-date', 'newer'].map((id) => ({
      id,
      title: id,
      format: 'mdx',
      date: '2026-02-01',
      body: "import StaticProof from '../../components/StaticProof.astro';\n\n## MDX compilation proof\n\n<StaticProof />",
    })),
  ];
  for (const { id, title, format, date, body } of publications) {
    await fixture(
      `${id}.${format}`,
      `---\nstatus: published\ntitle: ${title}\ndescription: Publication proof\npublishedAt: "${date}"\n---\n${body}`,
    );
  }

  const valid = build();
  assert.equal(valid.status, 0, valid.output);
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
  for (const { id, title, format } of publications) {
    const html = await readFile(
      join(scratch, 'dist/articles', id, 'index.html'),
      'utf8',
    );
    const article = /<article\b[\s\S]*?<\/article>/.exec(html)?.[0];
    assert.ok(article, `Missing article on ${id}`);
    assert.equal(/<h1\b[^>]*>([^<]+)<\/h1>/.exec(article)?.[1], title);
    if (format === 'mdx') {
      assert.match(article, /<h2\b[^>]*>MDX compilation proof<\/h2>/);
      assert.match(
        article,
        /<aside\b[^>]*data-static-proof[^>]*>Static component compiled in MDX<\/aside>/,
      );
    } else {
      assert.match(article, /<p\b[^>]*>Markdown body\.<\/p>/);
    }
    assert.doesNotMatch(article, /<script\b/);
    assert.doesNotMatch(html, /Unfinished draft|astro-island/);
    assert.match(html, /data-coastal-footer/);
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
    await rm(join(articleDirectory, 'invalid.mdx'));
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}
