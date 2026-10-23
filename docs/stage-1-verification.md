# Stage 1 verification

Checked locally on 2026-10-23. The repository was cloned into an empty workspace; its remote `main` had no commits. There were no repository instructions, tracked files or existing local edits to preserve. All deliverables remain local, uncommitted changes. Figma was read only; no push, deployment or remote configuration change was made.

## Completed

| Check                | Evidence                                                                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime              | Official Node.js 24.22.1 arm64 archive; SHA-256 matched published `89c682593d76cd44233fa53b1563264e7de9cbb189cad169135c5b4fadfbc0a7`. pnpm reports 12.15.0.                                                                                   |
| Clean install        | Removed generated `node_modules`, `.astro` and `dist`; installed with `pnpm install --frozen-lockfile` into a new, separate store. Lockfile remained unchanged.                                                                               |
| Astro / TypeScript   | `pnpm check`: zero errors, warnings and hints.                                                                                                                                                                                                |
| Lint                 | `pnpm lint`: zero errors or warnings.                                                                                                                                                                                                         |
| Formatting           | `pnpm format:check`: all checked files pass. Original vector/font binaries and the generated lockfile are intentionally excluded.                                                                                                             |
| Build                | `pnpm build`: `output: static`, `mode: static`, one generated page, `/index.html`.                                                                                                                                                            |
| Output contract      | `pnpm verify:output`: one HTML file, no `.js`/`.mjs`/`.cjs`, script tags, islands, iframe, temporary Figma URL or verification route. Only local font files and their license accompany the page.                                             |
| Markdown / MDX       | `pnpm verify:content`: Markdown body, MDX heading and an embedded static `.astro` component rendered successfully in an isolated temporary build. No React integration.                                                                       |
| Metadata / selection | Undated, unfinished draft validates and is excluded; published entries sort newest first with deterministic ID ties. Missing publication date/title/description and impossible `2026-02-30` each fail the build with entry/field diagnostics. |
| Source assets        | All five original PNG SHA-1 values equal their Figma `imageHash`. Source node IDs, dimensions, fill transforms, hashes and crop reconstruction are recorded in `design-sources.md` and `figma-source.json`. Local SVG is 16×16.               |
| System themes        | All 10 semantic colors match their Figma values in both Light and Dark, including fractional Border 2 channels and 0.1 Image Border alpha. Actual macOS appearance changed from Auto (resolving Light) to Dark, then was restored to Auto.    |
| Font loading         | Browser Font Loading API reports Inter 400 and 500 as `loaded`; both `document.fonts.check()` calls succeed. Resource Timing shows local WOFF2 bodies of 111,268 and 114,348 bytes.                                                           |
| Computed typography  | Name: 500, 16px/20px; role: 400, 16px/20px; both −0.176px tracking. Temporary button probe: 500, 13px/20px, −0.143px tracking.                                                                                                                |

The expected Astro `glob-loader` message about no article files is intentional: the collection is empty, with only `.gitkeep`. It is not a TypeScript diagnostic or a build failure.

Development and production preview commands were both started successfully and returned HTTP 200 for `/`. Final preview also returned HTTP 200 for both WOFF2 files; downloaded bytes matched the source SHA-256 values. All test servers were stopped afterward.

Frozen lockfile SHA-256: `bcc4650823c8a8119bcdd9497dfc5adf7885a5a55919bbc891a49599a42ce084`.

## Browser evidence and reproduction

`browser-verification.json` retains the actual computed values, comparisons against Figma floating-point values, loaded font faces and resource sizes from the Codex in-app browser. A temporary local server served the **production** HTML/CSS plus a test-only DOM probe. Its proof endpoint and script never existed in `src/pages/` or `dist/` and the server was stopped after checking.

For manual reproduction, build and preview, inspect `h1` and `p`, and switch the system appearance between Light and Dark. Restore the initial system setting afterward. Check `matchMedia('(prefers-color-scheme: dark)').matches`, both local font requests and `await document.fonts.ready` / `document.fonts.check('500 16px Inter')` (and 400). To inspect a token without legacy CSSOM rounding, use a temporary DOM element:

```js
const probe = document.createElement('span');
probe.style.color = 'color(from var(--color-border-2) srgb r g b / alpha)';
document.body.append(probe);
console.log(getComputedStyle(probe).color);
probe.remove();
```

Repeat for the ten properties in `design-sources.md`. Expected Border 2 results are `color(srgb 0.82 0.82 0.82)` and `color(srgb 0.26 0.26 0.26)`. Legacy `getComputedStyle().color` serializes RGB channels to integers even when internal values retain precision. Comparisons allowed less than 0.001 in 0–255 channel units to accommodate CSSOM serialization and Figma float noise. No theme override was added to application code.

Two issues found during verification were fixed: CSS minification rounded fractional colors/alpha to hex; inheriting computed letter spacing from body gave 13px buttons −0.176px instead of −0.143px. The final build preserves color precision and applies the em-based tracking at each form control's own font size.

## Not run / limits

- GitHub Actions and an actual Vercel build/deployment were not run: this stage must stay local. The workflow and hosting guidance are prepared, but Linux/native dependency installation on GitHub and Vercel's exact selected pnpm version need confirmation on their first authorized run.
- Browser checking used the in-app browser on macOS, not a cross-browser/device matrix. Full homepage fidelity, mobile composition, gallery behavior, article design and accessibility of future controls are outside this stage.
- Figma exposes Inter family/styles but not the exact installed font binary version. The licensed upstream Inter 4.1 files are pinned and locally verified; byte-level parity with Figma's installed font cannot be established.
- The referenced architecture report was absent. The implementation follows the architecture decisions explicitly supplied in the task.

## Decisions before Stage 2

1. Confirm the homepage copy and contact URLs, especially the terminal card's inconsistent long description; confirm publication-ready article content rather than inventing dates for Figma titles.
2. Identify the three `Case` images: project attribution, links, captions and final alt text. Confirm crop/focal positions for the intended gallery and responsive layouts.
3. Specify mobile composition, tab/gallery navigation and whether their concrete interactions warrant an island. No React, motion or 3D dependency has been introduced.
4. Decide whether a manual theme control is wanted, and confirm the avatar border's Dark-mode behavior. The current default follows the system.
5. Decide article typography (including possible italic weights), URL conventions, and any scheduling policy. Currently `status: published` is the publication gate.
6. Confirm the production domain before adding canonical URLs/social metadata; authorize GitHub/Vercel runs and deployment separately when ready.
