# Alex L. — personal website

Responsive static homepage and the first published Writing article, built on the preserved content foundation. The first release preserves the current design and interactions; unfinished case studies remain noninteractive and future enhancements are outside its scope.

[Website](https://untitled-bice-chi.vercel.app/) · [Design the second attempt](https://untitled-bice-chi.vercel.app/articles/design-the-second-attempt/)

## Run locally

Use Node.js **24.22.1** (`.node-version`) and pnpm **12.15.0** (`packageManager`). Install that Node version with your version manager, then install pnpm if needed:

```sh
npm install --global pnpm@12.15.0
pnpm install --frozen-lockfile
pnpm dev
```

| Command               | Purpose                                                                          |
| --------------------- | -------------------------------------------------------------------------------- |
| `pnpm dev`            | Development server                                                               |
| `pnpm check`          | Astro sync and strict TypeScript/Astro diagnostics                               |
| `pnpm lint`           | ESLint for TypeScript, JavaScript and Astro                                      |
| `pnpm format:check`   | Prettier check                                                                   |
| `pnpm format`         | Apply formatting                                                                 |
| `pnpm verify:content` | Isolated Markdown/MDX, metadata and selection integration checks                 |
| `pnpm build`          | Static production output in `dist/`                                              |
| `pnpm verify:output`  | Homepage + article HTML, no placeholders, 30 KiB gzip JS budget, no proof routes |
| `pnpm preview`        | Serve the production build on localhost                                          |

Astro 7 runs its dev/preview server in the background. Use `pnpm exec astro preview stop` (or `pnpm exec astro dev stop`) to stop it; `status` and `logs` are also available. In restricted environments, set `ASTRO_TELEMETRY_DISABLED=1` when running Astro to avoid its user-preference directory write.

`pnpm-lock.yaml` is tracked, including pnpm 12's package-manager document. Do not regenerate it with a different pnpm major. Generated `dist/`, `.astro/` and dependencies are ignored.

## Architecture

- Astro **7.4.2**, explicit `output: 'static'`, no adapter.
- Strictest Astro TypeScript preset; TypeScript **6.0.3**, compatible with the installed checker and ESLint parser.
- Scoped CSS for document/component geometry; shared CSS custom properties for colors and foundations.
- Local Markdown/MDX via Content Collections and `@astrojs/mdx` **8.1.1**. MDX uses Astro's renderer; no React integration is needed for static Astro embeds.
- System preference controls the initial theme entirely in CSS. No theme script, saved preference or manual control.
- Inter 4.1 static 400/500 WOFF2 files are self-hosted with their SIL OFL license. No font CDN or runtime external fetches.
- CSS minification is disabled because conversion to 8-bit hex rounds Figma's fractional border channels and 10% alpha. HTML remains optimized. Revisit only with a verified precision-preserving minifier.

The homepage includes the profile, biography, verified contact links, Projects / Selected work, Experience and Writing. Small Astro components share the existing tokens and local fonts. `src/data/homepage.ts` retains verified copy, confirmed company URLs and explicit null destinations for unfinished cases. These case previews remain noninteractive. Writing comes from the articles collection through `getPublishedArticles()`, the same helper used by `src/pages/articles/[...id].astro` to generate published routes. Internal ContentRow links open in the same tab; external destinations retain their new-tab behavior. The Runnel card links to its GitHub project and follows the pointer with a perspective tilt on devices with a precise hover pointer. Reduced-motion preferences disable the tilt. Its animated satin background adapts to the system's light and dark themes, pauses when hidden or offscreen, and displays a still frame with reduced motion enabled. A 0.5px outline stays above the animation.

The first article is `/articles/design-the-second-attempt/`. Its Markdown metadata supplies the homepage title, article heading, document title, description and publication date. `ArticleLayout.astro` reuses the document's 600px column, local Inter fonts, semantic colors and system theme, with reading spacing and a keyboard-accessible homepage link. Article HTML includes the full body and no JavaScript.

Tabs progressively enhance real fragment links and two readable sections with a small TypeScript controller. Projects is initially selected. CSS reserves that initial layout when scripting is enabled, preventing a cold-load shift before the controller runs. Arrow keys wrap, Home/End select the edge tabs, and Enter/Space activate. Tab enters the active panel; hidden panels cannot receive focus. No URL/history synchronization is added. With JavaScript disabled, both sections remain visible.

The native horizontal gallery preserves source order and starts with the company table in the center. Scroll, swipe, or focus the gallery and use Left/Right/Home/End. It retains its fractional position across tab reopening and viewport resizing. Gallery overflow is confined to its own full-width scroll region; other content stays within 600px with 24px minimum gutters. Both enhanced panels reserve 400px so switching does not move Experience or Writing, including on narrow screens.

Astro's image tools emit local WebP derivatives: 40/80/120px avatar/icon and 288/384/600/768/1200/1800px work images, with explicit dimensions, centered cover crops and responsive sources. Original PNGs stay in source and do not ship. The unchanged 16×16 arrow SVG is used as a mask with the Secondary token. The avatar uses the semantic Image Border token in both themes.

## Browser verification

Build and start the production preview first. Browser tooling is intentionally absent from project dependencies. Install Playwright into a temporary directory or use an available external installation, then run:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
BROWSER_EXECUTABLE=/absolute/path/to/chromium \
node scripts/verify-browser.mjs
```

`BROWSER_EXECUTABLE` is optional if that Playwright install has its matching Chromium. `VERIFY_URL` defaults to `http://127.0.0.1:4321`. The script verifies both themes at 320, 375, 768, 1200 and 1440px, pointer/keyboard/touch behavior, resize/reopen, hidden focus, no-JS fallback, local resources, actual hrefs and layout shifts. It also checks the article's full text, direct URL, same-tab navigation, refresh, return link, keyboard focus, live theme changes and 200% text at 320px. New evidence is written to `docs/article-verification/`; historical Stage 1/2 evidence is preserved. No verification route or probe ships in `dist/`.

## Content contract

Place real articles in `src/content/articles/` as `.md` or `.mdx`. `status` is required and must be `draft` or `published`; accidental omission fails validation.

An unfinished draft can contain only:

```yaml
status: draft
```

Publication requires non-empty `title` and `description`, plus `publishedAt` as a quoted, valid ISO calendar date (`"YYYY-MM-DD"`). Dates are transformed to UTC `Date` values. Drafts may omit all three fields; any field supplied is still validated.

`getPublishedArticles()` is the shared selection helper for the homepage Writing list and article `getStaticPaths()`. It excludes drafts, orders newest first, and breaks equal-date ties by ID. Explicit `published` status is authoritative; scheduled publication is not implemented. Published entries generate `/articles/{id}/`; drafts generate neither a listing entry nor an article route.

**Draft filtering only affects generated pages. Draft source remains visible in a public Git repository, including its history.** Keep private writing outside this repository.

`pnpm verify:content` copies the project to a temporary directory, creates MD/MDX entries and an embedded static Astro component, verifies rendered output, real article routes, Writing order and draft exclusion, tests invalid publication metadata, and removes the temporary project in `finally`. It never adds a verification route or fixture to this project's source or `dist/`.

## Publication

Node 24 is supported by Astro and Vercel. Local/CI patch is pinned; Vercel supports the **24.x major** and manages its minor/patch releases, so exact patch parity there cannot be promised.

The repository is [reixie/untitled](https://github.com/reixie/untitled), with `main` as the production branch. Vercel's Git integration builds future pushes; GitHub Actions runs verification only, with no separate deployment pipeline.

`vercel.json` selects Astro, `pnpm build`, output `dist`, and an install command that logs the pnpm version before `pnpm install --frozen-lockfile`. The Vercel project uses the repository root, Node `24.x`, and `ENABLE_EXPERIMENTAL_COREPACK=1` to select pnpm **12.15.0** from `packageManager`. Confirm the actual version in build logs. No server adapter is required. The first release uses the generated `vercel.app` domain.

GitHub Actions uses the pinned Node/pnpm versions and runs a frozen install, type/lint/format checks, isolated content verification, build and static-output verification. Historical verification reports describe their original local stages; they are retained as evidence, not as the current publication status.

## Sources and handoff

- [Design token and asset mapping](docs/design-sources.md)
- [Raw read-only Figma snapshot](docs/figma-source.json)
- [Stage 1 verification evidence and remaining decisions](docs/stage-1-verification.md)
- [Stage 2 verification, screenshots and Stage 3 inputs](docs/stage-2-verification.md)

Implementation sources checked on 2026-10-23: [Astro 7 installation](https://docs.astro.build/en/install-and-setup/), [Astro 7 Content Collections](https://docs.astro.build/en/guides/content-collections/), [MDX integration](https://docs.astro.build/en/guides/integrations-guide/mdx/), [Node 24 release files](https://nodejs.org/dist/v24.22.1/), [pnpm installation](https://pnpm.io/installation), [Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Vercel package-manager selection](https://vercel.com/docs/package-managers), [Vercel Corepack](https://vercel.com/docs/builds/configure-a-build#corepack), and the installed packages' manifests/peer ranges. These live Astro docs describe the selected 7.x line; do not apply the archived 5.x schema imports (`z` now comes from `astro/zod`).

The architecture report referenced in the task was not attached and was not present in the empty repository. The explicit architecture decisions in the task were used as the basis.
