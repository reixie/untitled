import { readFile } from 'node:fs/promises';

export const article = {
  path: '/articles/design-the-second-attempt/',
  title: 'Design the second attempt',
  date: '2026-10-23',
  dateLabel: '23 October 2026',
};

const accord = {
  id: 'accord',
  node: '42:378',
  path: '/work/accord/',
  title: 'Accord — a CRM for small teams',
  headings: 8,
  bulletItems: 8,
  orderedLists: [3, 3, 3],
  flowCount: 2,
  figures: [
    'Companies directory — Light',
    'Workspace and appearance menus — Light styling',
    'Companies directory — Dark',
  ],
  originalCount: 6,
};

const pascal = {
  id: 'pascal',
  node: '42:382',
  path: '/work/pascal/',
  title: 'Pascal — Markdown notes for macOS',
  previewText: 'Research Brief',
  headings: 4,
  bulletItems: 2,
  orderedLists: [3, 4],
  flowCount: 1,
  figures: [
    'Pascal brand artwork',
    'Notes workspace — Light',
    'Notes workspace — Dark',
    'Formatting menu — Light',
    'Command palette — Light',
    'Command palette — Dark',
  ],
  originalCount: 6,
};

export const caseStudies = [accord, pascal];
export const vocabularyNode = '42:393';
export const galleryOrder = [pascal.node, accord.node, vocabularyNode];
export const portfolioRoutes = [
  '/',
  article.path,
  ...caseStudies.map(({ path }) => path),
];

const withoutFrontmatter = (source) =>
  source.replace(/^---\n[\s\S]*?\n---\n/, '');
const paragraphs = (body) =>
  body
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) =>
      paragraph
        .replace(/^(?:##|-|\d+\.) /gm, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim(),
    );

export async function readArticleBody() {
  const source = await readFile(
    `src/content${article.path.slice(0, -1)}.md`,
    'utf8',
  );
  return paragraphs(withoutFrontmatter(source)).join(' ');
}

export async function readCaseCopy(study) {
  const source = await readFile(`src/content/work/${study.id}.mdx`, 'utf8');
  const body = withoutFrontmatter(source)
    .replace(/^import .*;\n/gm, '')
    .replace(/<(?:CaseFigure|CaseFlow|AccordHeadcount)\b[\s\S]*?\/>/g, '')
    .replace(/<CaseImageLink\b[^>]*\blabel="([^"]+)"[^>]*\/>/g, '$1')
    .replace(/<\/?a\b[^>]*>/g, '');

  return {
    paragraphs: paragraphs(body),
    hrefs: [...body.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(([, href]) => href),
    captions: [...source.matchAll(/caption="([^"]+)"/g)].map(
      ([, caption]) => caption,
    ),
  };
}
